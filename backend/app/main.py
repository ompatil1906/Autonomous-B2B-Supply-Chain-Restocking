"""FastAPI server for the AP2-Bounded Restocking Agent demo."""
from __future__ import annotations

import asyncio
import json
import os

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.agent.graph import run_agent
from app.audit import read_all, verify_chain
from app.config import settings
from app.services import approvals as approvals_store
from app.services import reserve_pay, warehouse
from app.services.razorpay_mcp import RazorpayMcpClient

DATA_DIR = os.path.join("backend", "data")
LAST_RUN_FILE = os.path.join(DATA_DIR, "last_run.json")

app = FastAPI(title="AP2-Bounded Restocking Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    scenario: str = Field("happy", pattern="^(happy|failure)$")
    sku: str = "SKU-404"
    override_quantity: int | None = None
    reset_inventory: bool = True


class _Hub:
    """Broadcasts run events to connected WebSocket clients."""

    def __init__(self):
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket):
        self.clients.discard(ws)

    async def broadcast(self, payload: dict):
        msg = json.dumps(payload, ensure_ascii=False, default=str)
        for ws in list(self.clients):
            try:
                await ws.send_text(msg)
            except Exception:
                self.clients.discard(ws)


hub = _Hub()
_runs: list[dict] = []

# Single-flight: concurrent /api/run calls queue instead of racing the gate and
# the reserve balance (the concurrency/idempotency answer, made demonstrable).
_run_lock = asyncio.Lock()


def _persist_last_run(result: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        with open(LAST_RUN_FILE, "w", encoding="utf-8") as fh:
            json.dump(result, fh, ensure_ascii=False, default=str)
    except OSError:
        pass


def _load_last_run() -> None:
    """Restore the last run across restarts so a page refresh keeps state."""
    if os.path.exists(LAST_RUN_FILE):
        try:
            with open(LAST_RUN_FILE, encoding="utf-8") as fh:
                _runs.append(json.load(fh))
        except (json.JSONDecodeError, OSError):
            pass


_load_last_run()


async def _run_scenario(req: RunRequest) -> dict:
    async def on_update(node: str, data: dict) -> None:
        await hub.broadcast(
            {
                "type": "node",
                "node": node,
                "scenario": req.scenario,
                "update": {k: v for k, v in data.items() if k != "steps"},
            }
        )

    await hub.broadcast({"type": "run_started", "scenario": req.scenario})
    try:
        result = await run_agent(
            sku=req.sku,
            scenario=req.scenario,
            override_quantity=req.override_quantity,
            reset_inventory=req.reset_inventory,
            on_update=on_update,
        )
    except Exception as exc:
        await hub.broadcast({"type": "run_failed", "scenario": req.scenario, "error": str(exc)})
        raise exc
    _runs.append(result)
    _persist_last_run(result)
    await hub.broadcast({"type": "run_completed", "scenario": req.scenario, "result": result})
    return result


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "razorpay_mode": settings.razorpay_mode, "llm_provider": settings.agent_llm_provider}


@app.get("/api/status")
async def status() -> dict:
    return {
        "razorpay_mode": settings.razorpay_mode,
        "razorpay_mcp_url": settings.razorpay_mcp_url,
        "agent_llm_provider": settings.agent_llm_provider,
        "agent_llm_model": settings.agent_llm_model,
        "ap2_limit_inr": settings.ap2_mandate_limit_inr,
        "ap2_sku": settings.ap2_mandate_sku,
        "ap2_max_qty": settings.ap2_mandate_max_qty,
        "ap2_max_unit_price": settings.ap2_mandate_max_unit_price,
        "supplier_name": settings.supplier_name,
        "merchant_name": settings.merchant_name,
        "merchant_phone": settings.merchant_phone,
        "intent_expiry_hours": settings.ap2_intent_expiry_hours,
    }


@app.get("/api/inventory")
async def inventory() -> dict:
    return {"catalog": warehouse.catalog(), "stock": warehouse.stock_levels()}


@app.get("/api/reserve")
async def reserve() -> dict:
    return {"blocks": [reserve_pay.to_dict(b) for b in reserve_pay.active_blocks()]}


@app.get("/api/audit")
async def audit() -> dict:
    return {"records": read_all()}


@app.get("/api/audit/verify")
async def audit_verify() -> dict:
    return verify_chain()


@app.get("/api/approvals")
async def approvals() -> dict:
    return approvals_store.list_all()


@app.post("/api/approvals/{approval_id}/approve", response_model=dict)
async def approve_approval(approval_id: str) -> JSONResponse:
    rec = approvals_store.get(approval_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Unknown approval {approval_id}")
    if rec["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Approval already {rec['status']}")

    # If the run already produced a live Razorpay link, reuse THAT one — the
    # console, WhatsApp message and approvals tab all point to a single URL,
    # and approval is instant (no second MCP round-trip, no fallback drift).
    existing = rec.get("payment_link") or {}
    if existing.get("short_url") and not existing.get("simulated"):
        updated = approvals_store.approve(approval_id, existing, reused=True)
        await hub.broadcast({"type": "approval_updated"})
        return JSONResponse(updated)

    # No usable link from the run (or it was only simulated) — try a live
    # creation now; the simulator still covers us if the MCP is unreachable.
    client = RazorpayMcpClient()
    link = await client.create_payment_link(
        amount_inr=rec["total_inr"],
        description=f"Manual override — {rec['sku']} × {rec['quantity']} "
                    f"({settings.supplier_name} {rec['quote_ref']})",
        reference_id=f"OVR-{rec['quote_ref']}",
        notes={"approval_id": approval_id, "sku": rec["sku"]},
    )
    updated = approvals_store.approve(approval_id, link)
    await hub.broadcast({"type": "approval_updated"})
    return JSONResponse(updated)


@app.post("/api/approvals/{approval_id}/reject", response_model=dict)
async def reject_approval(approval_id: str) -> JSONResponse:
    try:
        updated = approvals_store.reject(approval_id, note="Rejected from dashboard")
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown approval {approval_id}")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await hub.broadcast({"type": "approval_updated"})
    return JSONResponse(updated)


@app.get("/api/runs")
async def runs() -> dict:
    return {"runs": _runs}


@app.get("/api/runs/latest")
async def latest_run() -> dict:
    return {"latest": _runs[-1] if _runs else None}


@app.post("/api/run", response_model=dict)
async def start_run(req: RunRequest) -> JSONResponse:
    async with _run_lock:  # serialize runs — no double-spend races
        result = await _run_scenario(req)
    return JSONResponse(result)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(ws)
    except Exception:
        hub.disconnect(ws)
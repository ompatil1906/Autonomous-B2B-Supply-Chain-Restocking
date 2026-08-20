"""FastAPI server for the AP2-Bounded Restocking Agent demo."""
from __future__ import annotations

import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.agent.graph import run_agent
from app.audit import read_all
from app.config import settings
from app.services import reserve_pay, warehouse

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


@app.get("/api/runs")
async def runs() -> dict:
    return {"runs": _runs}


@app.get("/api/runs/latest")
async def latest_run() -> dict:
    return {"latest": _runs[-1] if _runs else None}


@app.post("/api/run", response_model=dict)
async def start_run(req: RunRequest) -> JSONResponse:
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
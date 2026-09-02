"""FastAPI server for the Autonomous Revenue Protection Agent demo."""
from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.agent.graph import run_agent, normalize_scenario
from app.agent.llm import llm_provider_name
from app.audit import clear as clear_audit
from app.audit import read_all, verify_chain
from app.auth import require_writer_token
from app.config import settings
from app.products import PRODUCTS
from app.services import approvals as approvals_store
from app.services import (
    decisions,
    execution,
    idempotency,
    outcomes,
    reconciliation,
    reserve_pay,
    warehouse,
    webhook_store,
)
from app.services import webhooks as webhook_svc
from app.services.live_ops import LiveOps
from app.services.razorpay_mcp import RazorpayMcpClient
from app.services.suppliers import SUPPLIERS
from app.ws import hub
from app.paths import DATA_DIR, LAST_RUN_FILE


@asynccontextmanager
async def lifespan(_: FastAPI):
    warehouse.reset()
    await live.start()
    yield
    await live.stop_festival()


app = FastAPI(title="AP2-Bounded Restocking Agent", version="0.1.0", lifespan=lifespan)

# The Live Ops orchestrator: demand simulation → predictive triggers → gated
# autonomous purchasing, all broadcast over the shared WS hub.
live = LiveOps(hub.broadcast)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://warden-ebon.vercel.app", 
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    scenario: str = Field(
        "happy",
        pattern="^(happy|failure|price_attack|hallucinate|rogue_ai|do_not_buy|multi_supplier|do_nothing)$",
    )
    sku: str = "SKU-404"
    override_quantity: int | None = None
    reset_inventory: bool = True


class WebhookSimulateRequest(BaseModel):
    decision_id: str
    amount_inr: float
    captured: bool = True


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

    await hub.broadcast({"type": "run_started", "scenario": req.scenario, "sku": req.sku})
    try:
        result = await run_agent(
            sku=req.sku,
            scenario=req.scenario,
            override_quantity=req.override_quantity,
            reset_inventory=req.reset_inventory,
            on_update=on_update,
        )
    except Exception as exc:
        await hub.broadcast({"type": "run_failed", "scenario": req.scenario, "sku": req.sku, "error": str(exc)})
        raise exc

    # Closed loop: in simulation mode the Razorpay webhook is synthesized with the
    # SAME signature path so the reconciliation record (already MATCHED at capture
    # commit) is re-confirmed. In remote_test the reconciliation is already MATCHED
    # from the authoritative capture, so we still surface it to the result.
    decision_id = result.get("decision_id")
    if result.get("status") == "executed" and decision_id:
        if settings.execution_mode != "remote_test":
            amount = round((result.get("execution") or {}).get("amount_inr") or 0.0, 2)
            if amount > 0:
                try:
                    webhook_svc.simulate_webhook(decision_id=decision_id, amount_inr=amount)
                except Exception as exc:
                    result.setdefault("webhook_error", str(exc)[:120])
        result["reconciliation"] = reconciliation.get_by_decision(decision_id)

    _runs.append(result)
    _persist_last_run(result)
    await hub.broadcast({"type": "run_completed", "scenario": req.scenario, "sku": req.sku, "result": result})
    return result


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health() -> dict:
    return {
        "ok": True,
        "razorpay_mode": settings.razorpay_mode,
        "razorpay_execution_mode": settings.execution_mode,
        "llm_provider": llm_provider_name(),
    }


@app.get("/api/status")
async def status() -> dict:
    return {
        "razorpay_mode": settings.razorpay_mode,
        "razorpay_execution_mode": settings.execution_mode,
        "razorpay_mcp_url": settings.razorpay_mcp_url,
        "agent_llm_provider": llm_provider_name(),
        "agent_llm_model": settings.agent_llm_model,
        "app_env": settings.app_env,
        "api_token_configured": bool(settings.api_token),
        "ap2_limit_inr": settings.ap2_mandate_limit_inr,
        "ap2_sku": settings.ap2_mandate_sku,
        "ap2_max_qty": settings.ap2_mandate_max_qty,
        "ap2_max_unit_price": settings.ap2_mandate_max_unit_price,
        "ap2_daily_ceiling_inr": settings.ap2_daily_ceiling_inr,
        "supplier_name": settings.supplier_name,
        "merchant_name": settings.merchant_name,
        "merchant_phone": settings.merchant_phone,
        "intent_expiry_hours": settings.ap2_intent_expiry_hours,
        # the full portfolio the agent is chartered to manage
        "portfolio": [
            {
                "sku": p.sku,
                "name": p.name,
                "price_inr": p.price_inr,
                "restock_qty": p.restock_qty,
                "ceiling_inr": p.ceiling_inr,
                "max_unit_price_inr": p.max_unit_price_inr,
                "festival": p.festival,
            }
            for p in PRODUCTS.values()
        ],
        "suppliers": [
            {"id": s.id, "name": s.name, "price_multiplier": s.price_multiplier,
             "lead_time_s": s.lead_time_s, "reliability": s.reliability, "did": s.did}
            for s in SUPPLIERS.values()
        ],
    }


@app.get("/api/inventory")
async def inventory() -> dict:
    return {"catalog": warehouse.catalog(), "stock": warehouse.stock_levels()}


@app.get("/api/reserve")
async def reserve() -> dict:
    return {"blocks": [reserve_pay.to_dict(b) for b in reserve_pay.active_blocks()]}


@app.post("/api/reserve/reset", dependencies=[Depends(require_writer_token)])
async def reserve_reset() -> dict:
    """Operator-initiated replenishment of the shared daily reserve pool.

    Money-consequential → authenticated with X-Warden-Token. Opens a freshly
    funded block and records the manual reset in the audit journal.
    """
    block = reserve_pay.replenish_daily_block(settings.ap2_daily_ceiling_inr)
    return {"block": reserve_pay.to_dict(block), "summary": reserve_pay.daily_summary()}


@app.post("/api/system/reset", dependencies=[Depends(require_writer_token)])
async def system_reset() -> dict:
    """Full demo reset — wipe every runtime artifact and restart the live sim.

    Called from the landing page the moment a new visitor hits "Go to
    Dashboard", so each fresh session starts on a clean slate: empty ledger,
    no decisions/approvals/reconciliations/webhooks/executions/learning, reseeded
    warehouse, and a zero-spend daily reserve pool. Authenticated with
    X-Warden-Token because it destroys persisted state.
    """
    global _runs
    await live.reset()
    warehouse.reset()
    reserve_pay.reset_shared()
    clear_audit()
    approvals_store.clear()
    decisions.clear()
    reconciliation.clear()
    webhook_store.clear()
    execution.clear()
    idempotency.clear()
    outcomes.clear_learned()
    if os.path.exists(LAST_RUN_FILE):
        os.remove(LAST_RUN_FILE)
    _runs = []
    _load_last_run()
    return {"reset": True}


@app.get("/api/audit")
async def audit() -> dict:
    return {"records": read_all()}


@app.get("/api/audit/verify")
async def audit_verify() -> dict:
    return verify_chain()


@app.get("/api/approvals")
async def approvals() -> dict:
    return approvals_store.list_all()


@app.get("/api/decisions")
async def decisions_list() -> dict:
    return decisions.list_decisions()


@app.get("/api/decisions/{decision_id}")
async def decision_detail(decision_id: str) -> dict:
    d = decisions.get_decision(decision_id)
    if d is None:
        raise HTTPException(status_code=404, detail=f"Unknown decision {decision_id}")
    return {"decision": d, "reconciliation": reconciliation.get_by_decision(decision_id)}


@app.get("/api/revenue-risk")
async def revenue_risk() -> dict:
    latest = decisions.list_decisions(limit=1)["decisions"]
    return {"latest": latest[0] if latest else None, "model": {
        "window_s": 90.0, "margin_model": "45% blended gross margin",
        "formula": "expected_lost_units × selling_price; expected_lost_units = max(0, velocity×window − stock)",
    }}


@app.get("/api/outcomes")
async def outcomes_list() -> dict:
    return outcomes.summarize_learning()


@app.get("/api/learning")
async def learning() -> dict:
    return outcomes.summarize_learning()


@app.get("/api/reconciliations")
async def reconciliations() -> dict:
    return reconciliation.list_all()


@app.get("/api/suppliers")
async def suppliers() -> dict:
    return {
        "suppliers": [
            {"id": s.id, "name": s.name, "price_multiplier": s.price_multiplier,
             "lead_time_s": s.lead_time_s, "reliability": s.reliability,
             "moq": s.moq, "max_qty": s.max_qty, "did": s.did}
            for s in SUPPLIERS.values()
        ]
    }


# ---------------------------------------------------------------- Razorpay webhooks

@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request) -> JSONResponse:
    """Razorpay webhook endpoint. Signature verification is done per-call; this
    endpoint is deliberately NOT behind the Warden bearer token (Razorpay sends
    its own X-Razorpay-Signature, which we verify against the configured secret)."""
    raw = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    event = webhook_svc.process_payment_webhook(raw, signature)
    if event.get("status") in ("invalid_signature", "malformed"):
        raise HTTPException(status_code=400, detail=event.get("error", "invalid webhook"))
    await hub.broadcast({"type": "webhook", "event": event})
    return JSONResponse(event)


@app.post("/api/webhooks/simulate", dependencies=[Depends(require_writer_token)])
async def simulate_webhook(req: WebhookSimulateRequest) -> dict:
    """Synthesize a signed Razorpay webhook for a decision (simulation mode)."""
    event = webhook_svc.simulate_webhook(
        decision_id=req.decision_id, amount_inr=req.amount_inr, captured=req.captured
    )
    await hub.broadcast({"type": "webhook", "event": event})
    rec = reconciliation.get_by_decision(req.decision_id)
    return {"event": event, "reconciliation": rec}


@app.get("/api/webhooks/events")
async def webhook_events() -> dict:
    from app.services import webhook_store

    return {"events": webhook_store.list_events()}


@app.get("/api/razorpay/activity")
async def razorpay_activity() -> dict:
    """Unified view: execution legs + reconciliations + webhook events."""
    return {
        "executions": list_executions(),
        "reconciliations": reconciliation.list_all()["reconciliations"],
        "webhooks": webhook_store_events(),
    }


def list_executions() -> list[dict]:
    from app.paths import EXECUTIONS_FILE

    if os.path.exists(EXECUTIONS_FILE):
        try:
            with open(EXECUTIONS_FILE, encoding="utf-8") as fh:
                data = json.load(fh)
                return data[-50:]
        except (json.JSONDecodeError, OSError):
            return []
    return []


def webhook_store_events() -> list[dict]:
    from app.services import webhook_store

    return webhook_store.list_events()


@app.get("/api/razorpay/live-proof")
async def razorpay_live_proof() -> dict:
    """The receipts tab: every real/simulated Razorpay object created."""
    return {
        "orders": [e for e in list_executions() if e.get("order_id")],
        "captures": [e for e in list_executions() if e.get("payment_id")],
        "links": [e.get("payment_link", {}) for e in list_executions() if e.get("payment_link")],
    }


@app.post("/api/approvals/{approval_id}/approve", response_model=dict, dependencies=[Depends(require_writer_token)])
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


@app.post("/api/approvals/{approval_id}/reject", response_model=dict, dependencies=[Depends(require_writer_token)])
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


# ---------------------------------------------------------------- Live Ops API

class FestivalRequest(BaseModel):
    delay_s: float = Field(10.0, ge=0, le=120)


@app.get("/api/live/state")
async def live_state() -> dict:
    """Bootstrap snapshot for the Live Ops screen (then everything streams over WS)."""
    return live.snapshot_state()


@app.post("/api/festival/start", dependencies=[Depends(require_writer_token)])
async def festival_start(req: FestivalRequest) -> dict:
    return await live.start_festival(delay_s=req.delay_s)


@app.post("/api/festival/stop", dependencies=[Depends(require_writer_token)])
async def festival_stop() -> dict:
    await live.stop_festival()
    return {"stopped": True}


@app.post("/api/live/probe/{sku}", dependencies=[Depends(require_writer_token)])
async def live_probe(sku: str) -> dict:
    """Dev-panel probe: force a SKU through the same gated pipeline (budget-breach demo)."""
    trigger = live.force_trigger(sku)
    if trigger is None:
        raise HTTPException(status_code=409, detail=f"SKU {sku} is not visible or already restocking")
    return trigger


@app.post("/api/run", response_model=dict, dependencies=[Depends(require_writer_token)])
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
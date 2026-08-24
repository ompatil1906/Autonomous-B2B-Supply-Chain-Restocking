"""LangGraph orchestration for the restocking agent.

The LLM is only used in `negotiate`. The critical `evaluate_gate` node is pure
deterministic code — it CANNOT be influenced by the LLM. This is what guarantees the
merchant can never lose more than the ₹10,000 Reserve Pay block, even if the LLM
hallucinates.
"""
from __future__ import annotations

import asyncio
import operator
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, StateGraph

from app.agent.llm import negotiate_quantity
from app.ap2.gate import evaluate_gate
from app.ap2.keys import get_role_did
from app.ap2.signer import issue_intent_mandate, issue_payment_mandate, mandate_to_json
from app.config import settings
from app.audit import append
from app.models.mandates import CartMandate, IntentMandate, PaymentMandate
from app.services import approvals, notifications, reserve_pay, supplier, warehouse
from app.services.razorpay_mcp import RazorpayMcpClient


class AgentState(TypedDict, total=False):
    sku: str
    scenario: str  # "happy" | "failure"
    override_quantity: int | None
    # Live Ops extensions:
    limits: dict | None          # per-SKU AP2 bounds (overrides settings defaults)
    staged: bool                 # sleep between nodes so the cycle is visible
    portfolio: dict | None       # {"spent": ₹, "ceiling": ₹} for the daily cap check
    trigger_reason: str | None   # predictive_velocity | hard_floor

    intent: IntentMandate | None
    reserve_block: Any  # ReserveBlock
    quantity: int | None
    cart: CartMandate | None
    gate: dict | None
    payment_mandate: PaymentMandate | None
    capture_result: dict | None
    payment_link: dict | None
    escalation_id: str | None
    whatsapp_message: dict | None
    status: str
    summary: dict | None
    steps: Annotated[list[dict], operator.add]


def _step(state: AgentState, kind: str, **payload: Any) -> list[dict]:
    return [{"kind": kind, **payload}]


def _bounds(state: AgentState) -> dict:
    """Per-SKU mandate bounds — live runs carry explicit limits; the classic
    single-SKU flow falls back to the settings defaults."""
    limits = state.get("limits") or {}
    return {
        "amount_max_inr": float(limits.get("amount_max_inr", settings.ap2_mandate_limit_inr)),
        "allowed_skus": list(limits.get("allowed_skus", [settings.ap2_mandate_sku])),
        "max_quantity_per_sku": int(limits.get("max_quantity_per_sku", settings.ap2_mandate_max_qty)),
        "max_unit_price_inr": float(limits.get("max_unit_price_inr", settings.ap2_mandate_max_unit_price)),
    }


async def node_pre_compute(state: AgentState) -> dict:
    """Human Authorization: UPI Reserve Pay block + signed AP2 IntentMandate."""
    sku = state["sku"]
    b = _bounds(state)
    amount_max = b["amount_max_inr"]
    intent = issue_intent_mandate(
        merchant_did=get_role_did("merchant"),
        agent_did=get_role_did("agent"),
        purpose=f"Autonomous restock of {sku}",
        intent_note=f"Allow the inventory AI agent to autonomously reorder {sku} when stock "
                    f"drops below threshold, up to ₹{amount_max:,.0f}, "
                    f"{b['max_quantity_per_sku']} units max, unit price ≤ ₹{b['max_unit_price_inr']:,.0f}.",
        amount_max_inr=amount_max,
        allowed_skus=b["allowed_skus"],
        max_quantity_per_sku=b["max_quantity_per_sku"],
        max_unit_price_inr=b["max_unit_price_inr"],
        valid_for_hours=settings.ap2_intent_expiry_hours,
        user_cart_confirmation_required=False,
        supplier_dids=[get_role_did("supplier")],
    )
    # One portfolio-level Reserve Pay pool per day — every autonomous restock
    # debits against it, which is what makes the DAILY ceiling enforceable.
    block = reserve_pay.get_or_create_daily_block(settings.ap2_daily_ceiling_inr)
    return {
        "intent": intent,
        "reserve_block": block,
        "steps": _step(
            state,
            "pre_compute",
            message=f"Human pre-authorized ₹{amount_max:,.0f} for {sku} (IntentMandate signed; "
                    f"debits draw from the ₹{settings.ap2_daily_ceiling_inr:,.0f} daily Reserve Pay block)",
            intent=mandate_to_json(intent),
            reserve_block=reserve_pay.to_dict(block),
        ),
    }


async def node_detect(state: AgentState) -> dict:
    sku = state["sku"]
    s = warehouse.get(sku)
    if s is None:
        return {"status": "no_action", "steps": _step(state, "detect", message=f"SKU {sku} unknown")}
    below = warehouse.below_threshold(sku)
    reason = state.get("trigger_reason")
    if reason == "predictive_velocity":
        msg = (f"Predictive trigger: projected time-to-stockout inside the 90s agent "
               f"lead time → acting BEFORE the shelf is empty ({s.stock} units left)")
    elif reason == "hard_floor":
        msg = f"Hard-floor safety net fired at {s.stock} units"
    else:
        msg = (f"Stock for {sku} = {s.stock}, threshold = {s.reorder_threshold} → "
               f"{'RESTOCK TRIGGERED' if below else 'no action needed'}")
    return {
        "steps": _step(
            state,
            "detect",
            sku=sku,
            stock=s.stock,
            threshold=s.reorder_threshold,
            below_threshold=below,
            message=msg,
        ),
    }


async def node_negotiate(state: AgentState) -> dict:
    sku = state["sku"]
    s = warehouse.get(sku)
    b = _bounds(state)
    cat = supplier.catalog_entry(sku)
    neg = negotiate_quantity(
        sku=sku,
        stock=s.stock,
        threshold=s.reorder_threshold,
        unit_price=cat["unit_price_inr"],
        suggested_qty=s.reorder_qty,
        max_qty=b["max_quantity_per_sku"],
        max_unit_price=b["max_unit_price_inr"],
        override_quantity=state.get("override_quantity"),
    )
    cart = supplier.build_cart_mandate(
        sku=sku,
        quantity=neg.quantity,
        scenario="price_hike" if state["scenario"] == "failure" else "normal",
        prev_mandate_id=state["intent"].id,
    )
    append("agent.negotiated", {"sku": sku, "quantity": neg.quantity, "scenario": state["scenario"]})
    return {
        "quantity": neg.quantity,
        "cart": cart,
        "steps": _step(
            state,
            "negotiate",
            message=f"Negotiated {neg.quantity} units of {sku} with {settings.supplier_name} "
                    f"(LLM backend: {neg.provider})",
            llm_reasoning=neg.reasoning,
            llm_provider=neg.provider,
            cart=mandate_to_json(cart),
        ),
    }


async def node_gate(state: AgentState) -> dict:
    intent: IntentMandate = state["intent"]
    cart: CartMandate = state["cart"]
    verdict = evaluate_gate(intent, cart, portfolio=state.get("portfolio"))
    append("agent.gate", {"passed": verdict.passed, "summary": verdict.summary})
    return {"gate": verdict.to_dict(), "steps": _step(state, "gate", **verdict.to_dict())}


def route_after_gate(state: AgentState) -> str:
    return "execute" if state["gate"]["passed"] else "escalate"


async def node_execute(state: AgentState) -> dict:
    cart: CartMandate = state["cart"]
    block = state["reserve_block"]
    amount = round(cart.credentialSubject.total_inr, 2)

    # Debit against the pre-blocked UPI Reserve Pay pool (no PIN).
    auth_payment = reserve_pay.synthetic_authorized_payment(block, amount)
    payment_id = settings.razorpay_authorized_payment_id or auth_payment["id"]

    # A synthetic block id can never exist on the real sandbox — capture it with
    # the deterministic simulator instead of burning a doomed remote MCP call.
    client = RazorpayMcpClient(
        force_mock=False if settings.razorpay_authorized_payment_id else True
    )
    capture = await client.capture_payment(payment_id, amount)

    block = reserve_pay.debit(block, amount, capture)

    # Sign the PaymentMandate (the non-repudiable receipt).
    pm = issue_payment_mandate(
        agent_did=get_role_did("agent"),
        amount_inr=amount,
        checkout_hash=cart.id,
        reserve_pay_block_id=block.block_id,
        prev_mandate_id=cart.id,
        payment_id=capture.get("id") or payment_id,
        status="executed",
    )
    warehouse.apply_restock(state["sku"], state["quantity"])
    append("agent.executed", {"sku": state["sku"], "amount_inr": amount, "payment_id": capture.get("id")})
    return {
        "payment_mandate": pm,
        "capture_result": capture,
        "status": "executed",
        "steps": _step(
            state,
            "execute",
            message=f"GATE PASSED → capture_payment ₹{amount:,.2f} via UPI Reserve Pay block "
                    f"(Razorpay backend: {client.backend})",
            amount_inr=amount,
            payment_id=capture.get("id"),
            razorpay_backend=client.backend,
            capture_result=capture,
            payment_mandate=mandate_to_json(pm),
        ),
    }


async def node_escalate(state: AgentState) -> dict:
    cart: CartMandate = state["cart"]
    amount = round(cart.credentialSubject.total_inr, 2)
    intent_cap = round(state["intent"].credentialSubject.constraints.amount_max_inr, 2)
    client = RazorpayMcpClient()

    failed_checks = [c["name"] for c in (state.get("gate") or {}).get("checks", []) if not c.get("passed")]
    block_reason = (
        "daily_portfolio_cap_exceeded"
        if "daily_portfolio_cap" in failed_checks
        else "gate_blocked_ceiling_exceeded"
    )

    link = await client.create_payment_link(
        amount_inr=amount,
        description=f"Boundary override required — {settings.supplier_name} {cart.credentialSubject.quote_ref}",
        reference_id=f"OVR-{cart.credentialSubject.quote_ref}",
        notes={"sku": state["sku"], "cart_mandate_id": cart.id},
    )

    if block_reason == "daily_portfolio_cap_exceeded":
        day_spent = float((state.get("portfolio") or {}).get("spent", 0.0))
        message = (
            f"Action Blocked. Approving ₹{amount:,.2f} for {state['sku']} would push today's "
            f"autonomous spend (₹{day_spent:,.2f}) past the ₹{settings.ap2_daily_ceiling_inr:,.0f} "
            f"daily portfolio ceiling. Please approve manually via this secure link."
        )
    else:
        message = (
            f"Action Blocked. {settings.supplier_name} raised prices; cart total is "
            f"₹{amount:,.2f}, which exceeds my ₹{intent_cap:,.0f} AP2 limit for {state['sku']}. "
            f"Please approve manually via this secure link."
        )
    sent = notifications.send_whatsapp(
        to=settings.merchant_phone,
        message=message,
        link=link.get("short_url"),
    )

    # PaymentMandate recorded as ABORTED — a receipt proving the agent refused.
    pm = issue_payment_mandate(
        agent_did=get_role_did("agent"),
        amount_inr=amount,
        checkout_hash=cart.id,
        reserve_pay_block_id=state["reserve_block"].block_id,
        prev_mandate_id=cart.id,
        status="aborted",
    )

    # Register the escalation in the merchant's approval inbox (persisted).
    esc = approvals.register(
        sku=state["sku"],
        quantity=state["quantity"],
        total_inr=amount,
        ceiling_inr=intent_cap,
        cart_mandate=mandate_to_json(cart),
        quote_ref=cart.credentialSubject.quote_ref,
        reason=block_reason,
        payment_link=link,
    )

    append("agent.blocked", {"sku": state["sku"], "amount_inr": amount, "payment_link_id": link.get("id")})
    return {
        "payment_mandate": pm,
        "payment_link": link,
        "escalation_id": esc["id"],
        "whatsapp_message": sent,
        "status": "blocked",
        "steps": _step(
            state,
            "escalate",
            message=f"GATE BLOCKED → created Payment Link ₹{amount:,.2f} and messaged the merchant "
                    f"(Razorpay backend: {client.backend})",
            amount_inr=amount,
            razorpay_backend=client.backend,
            payment_link=link,
            escalation_id=esc["id"],
            whatsapp_message=sent,
            payment_mandate=mandate_to_json(pm),
        ),
    }


async def node_finish(state: AgentState) -> dict:
    summary = {
        "status": state["status"],
        "scenario": state["scenario"],
        "sku": state["sku"],
        "quantity": state["quantity"],
        "trigger_reason": state.get("trigger_reason"),
        "intent": mandate_to_json(state["intent"]),
        "cart": mandate_to_json(state["cart"]),
        "gate": state["gate"],
        "payment_mandate": mandate_to_json(state["payment_mandate"]),
        "capture_result": state.get("capture_result"),
        "payment_link": state.get("payment_link"),
        "escalation_id": state.get("escalation_id"),
        "whatsapp_message": state.get("whatsapp_message"),
        "reserve_block": reserve_pay.to_dict(state["reserve_block"]),
        "stock_after": warehouse.stock_levels(),
    }
    append("agent.completed", {"status": state["status"], "scenario": state["scenario"], "sku": state["sku"]})
    return {"summary": summary, "steps": _step(state, "finish", message=f"Run complete → {state['status']}")}


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("pre_compute", node_pre_compute)
    g.add_node("detect", node_detect)
    g.add_node("negotiate", node_negotiate)
    g.add_node("gate", node_gate)
    g.add_node("execute", node_execute)
    g.add_node("escalate", node_escalate)
    g.add_node("finish", node_finish)

    g.set_entry_point("pre_compute")
    g.add_edge("pre_compute", "detect")
    g.add_edge("detect", "negotiate")
    g.add_edge("negotiate", "gate")
    g.add_conditional_edges("gate", route_after_gate, {"execute": "execute", "escalate": "escalate"})
    g.add_edge("execute", "finish")
    g.add_edge("escalate", "finish")
    g.add_edge("finish", END)
    return g.compile()


async def run_agent(
    *,
    sku: str = "SKU-404",
    scenario: str = "happy",
    override_quantity: int | None = None,
    reset_inventory: bool = True,
    on_update=None,
    limits: dict | None = None,
    staged: bool = False,
    portfolio: dict | None = None,
    trigger_reason: str | None = None,
) -> dict:
    """Execute the agent. `on_update(node_name, node_update)` is awaited after every node.

    Live Ops passes `limits` (per-SKU AP2 bounds), `staged=True` (sleep between
    nodes so a ~35s cycle is visible on stage) and `portfolio` (today's committed
    spend vs the daily ceiling, enforced by the gate).
    """
    if reset_inventory:
        warehouse.reset()
    initial = AgentState(
        sku=sku,
        scenario=scenario,
        override_quantity=override_quantity,
        steps=[],
        limits=limits,
        staged=staged,
        portfolio=portfolio,
        trigger_reason=trigger_reason,
    )
    app = build_graph()
    summary: dict | None = None
    steps: list[dict] = []
    async for update in app.astream(initial, stream_mode="updates"):
        for node, data in update.items():
            if on_update is not None:
                await on_update(node, data)
            if node == "finish" and data.get("summary"):
                summary = data["summary"]
            if isinstance(data, dict) and data.get("steps"):
                steps.extend(data["steps"])
            if staged and node != "finish":
                await asyncio.sleep(settings.live_node_delay_s)
    if summary is None:
        raise RuntimeError("Agent run finished without a summary")
    return summary | {"steps": steps}
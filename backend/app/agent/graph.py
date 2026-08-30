"""LangGraph orchestration for the Autonomous Revenue Protection agent.

Pipeline:
  pre_compute → detect → calculate_risk → evaluate_economics →
      search_supplier → negotiate → gate →
          execute → reconcile → measure → learn → finish
          |-> escalate (boundary override)         -> finish
          |-> do_not_buy (hostile / disallowed)    -> finish

The LLM appears only in `search_supplier` (advisory strategy) and `negotiate`
(explanation). Every critical decision — `evaluate_gate`, `calculate_risk`,
`resolve_negotiation`, `ExecutionCoordinator` — is pure deterministic code that
CANNOT be influenced by the LLM. That is the guarantee the merchant can never lose
more than the reserved bound, no matter how the model hallucinates.
"""
from __future__ import annotations

import asyncio
import operator
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, StateGraph

from app.agent.llm import llm_provider_name
from app.ap2.gate import evaluate_gate
from app.ap2.keys import get_role_did
from app.ap2.signer import (
    issue_intent_mandate,
    issue_payment_mandate,
    mandate_to_json,
    new_id,
)
from app.config import settings
from app.audit import append
from app.models.mandates import CartMandate, IntentMandate, PaymentMandate
from app.services import (
    approvals,
    decisions,
    notifications,
    outcomes,
    reserve_pay,
    warehouse,
)
from app.services import reconciliation
from app.services import revenue_risk as revenue_risk_svc
from app.services import negotiation as negotiation_svc
from app.services import suppliers as suppliers_svc
from app.services.execution import ExecutionCoordinator
from app.services.razorpay_mcp import RazorpayMcpClient

SCENARIO_ALIASES = {"failure": "price_attack", "hallucinate": "rogue_ai"}
VALID_SCENARIOS = {"happy", "price_attack", "rogue_ai", "do_not_buy", "multi_supplier", "do_nothing"}


def normalize_scenario(scenario: str) -> str:
    s = SCENARIO_ALIASES.get(scenario, scenario)
    return s if s in VALID_SCENARIOS else "happy"


def _critical_default_velocity(current_stock: int, window_s: float = 90.0) -> float:
    """Classic single-run default: the SKU is already at the trigger point, so
    treat forward demand as draining current stock within half the window."""
    if current_stock <= 0:
        return 10.0
    return round(current_stock * 60.0 / (window_s / 2.0), 2)


class AgentState(TypedDict, total=False):
    sku: str
    scenario: str
    override_quantity: int | None
    limits: dict | None
    staged: bool
    portfolio: dict | None
    trigger_reason: str | None
    velocity_units_per_min: float | None
    do_not_buy: bool | None

    intent: IntentMandate | None
    reserve_block: Any
    quantity: int | None
    requested_quantity: int | None
    cart: CartMandate | None
    gate: dict | None
    decision_id: str
    decision: dict | None
    revenue_risk: dict | None
    quotes: list | None
    llm_strategy: dict | None
    negotiation: dict | None
    payment_mandate: PaymentMandate | None
    capture_result: dict | None
    payment_link: dict | None
    order_id: str | None
    execution: dict | None
    reconciliation: dict | None
    outcome: dict | None
    money_moved_inr: float
    escalation_id: str | None
    whatsapp_message: dict | None
    status: str
    summary: dict | None
    steps: Annotated[list[dict], operator.add]


def _step(state: AgentState, kind: str, **payload: Any) -> list[dict]:
    return [{"kind": kind, **payload}]


def _bounds(state: AgentState) -> dict:
    limits = state.get("limits") or {}
    return {
        "amount_max_inr": float(limits.get("amount_max_inr", settings.ap2_mandate_limit_inr)),
        "allowed_skus": list(limits.get("allowed_skus", [settings.ap2_mandate_sku])),
        "max_quantity_per_sku": int(limits.get("max_quantity_per_sku", settings.ap2_mandate_max_qty)),
        "max_unit_price_inr": float(limits.get("max_unit_price_inr", settings.ap2_mandate_max_unit_price)),
    }


# ---------------------------------------------------------------- nodes

async def node_pre_compute(state: AgentState) -> dict:
    sku = state["sku"]
    b = _bounds(state)
    amount_max = b["amount_max_inr"]
    supplier_dids = [s.did for s in suppliers_svc.active_suppliers()]
    intent = issue_intent_mandate(
        merchant_did=get_role_did("merchant"),
        agent_did=get_role_did("agent"),
        purpose=f"Autonomous revenue-protection restock of {sku}",
        intent_note=f"Allow the inventory AI agent to autonomously reorder {sku} when stock "
                    f"drops below threshold, up to ₹{amount_max:,.0f}, "
                    f"{b['max_quantity_per_sku']} units max, unit price ≤ ₹{b['max_unit_price_inr']:,.0f}, "
                    f"from any of the merchant's registered suppliers.",
        amount_max_inr=amount_max,
        allowed_skus=b["allowed_skus"],
        max_quantity_per_sku=b["max_quantity_per_sku"],
        max_unit_price_inr=b["max_unit_price_inr"],
        valid_for_hours=settings.ap2_intent_expiry_hours,
        user_cart_confirmation_required=False,
        supplier_dids=supplier_dids,
    )
    block = reserve_pay.get_or_create_daily_block(settings.ap2_daily_ceiling_inr)
    return {
        "intent": intent,
        "reserve_block": block,
        "decision_id": new_id("dec"),
        "money_moved_inr": 0.0,
        "steps": _step(
            state,
            "pre_compute",
            message=(
                f"Human pre-authorized ₹{amount_max:,.0f} for {sku} — IntentMandate signed; "
                f"debits draw from the shared ₹{settings.ap2_daily_ceiling_inr:,.0f} daily "
                f"Reserve Pay block; suppliers on the allow-list: {', '.join(d[:18] for d in supplier_dids)}"
            ),
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
        msg = (f"Predictive trigger: projected time-to-stockout inside the agent lead "
               f"time → acting BEFORE the shelf is empty ({s.stock} units left)")
    elif reason == "hard_floor":
        msg = f"Hard-floor safety net fired at {s.stock} units"
    else:
        msg = (f"Stock for {sku} = {s.stock}, threshold = {s.reorder_threshold} → "
               f"{'RESTOCK TRIGGERED' if below else 'audit pass — not below threshold'}")
    return {
        "steps": _step(
            state,
            "detect",
            sku=sku,
            stock=s.stock,
            threshold=s.reorder_threshold,
            below_threshold=below,
            reason=reason,
            message=msg,
        ),
    }


async def node_calculate_risk(state: AgentState) -> dict:
    sku = state["sku"]
    s = warehouse.get(sku)
    velocity = state.get("velocity_units_per_min")
    if velocity is None:
        velocity = _critical_default_velocity(s.stock if s else 0)
    risk = revenue_risk_svc.compute_revenue_risk(
        sku=sku,
        current_stock=s.stock if s else 0,
        units_per_minute=velocity,
    )
    risk_dict = risk.model_dump()
    append("agent.risk", {"sku": sku, **risk_dict})
    return {
        "revenue_risk": risk_dict,
        "steps": _step(
            state,
            "calculate_risk",
            message=(
                f"Revenue-at-risk model → {risk_dict['expected_lost_units']:.1f} units in the "
                f"{risk_dict['risk_window_s']:.0f}s window = ₹{risk_dict['revenue_at_risk_inr']:,.2f} "
                f"revenue at risk, ₹{risk_dict['contribution_at_risk_inr']:,.2f} contribution at risk"
            ),
            revenue_risk=risk_dict,
        ),
    }


async def node_evaluate_economics(state: AgentState) -> dict:
    risk = state["revenue_risk"]
    scenario = state["scenario"]
    risk_model = revenue_risk_svc.RevenueRiskResult.model_validate(risk)

    if scenario == "do_not_buy" or state.get("do_not_buy"):
        decision = {
            "action": "DO_NOT_BUY",
            "quantity": None,
            "rationale": "Merchant policy forbids autonomous procurement in this cycle.",
            "factors": ["DO_NOT_BUY mandated by demo scenario / merchant policy"],
        }
    elif scenario == "rogue_ai":
        hostile_qty = int(state.get("override_quantity") or (int(settings.ap2_mandate_max_qty) * 100))
        decision = {
            "action": "BUY",
            "quantity": hostile_qty,
            "rationale": "Hostile mandate injection detected — attempting the requested lot so the gate can refuse it with evidence.",
            "factors": [f"override_quantity {hostile_qty} exceeds per-SKU cap → gate refusal (₹0 moved)"],
        }
    elif scenario == "do_nothing":
        decision = {
            "action": "WAIT",
            "quantity": None,
            "rationale": "Low-traffic window — projected stockout risk ~0%; stand down, zero spend.",
            "factors": ["do_nothing scenario: no protective buy warranted"],
        }
    else:
        decision = revenue_risk_svc.evaluate_decision(risk_model)

    decision["decision_id"] = state["decision_id"]
    decision["sku"] = state["sku"]
    decision["revenue_at_risk_inr"] = risk.get("revenue_at_risk_inr") or 0.0
    decision["contribution_at_risk_inr"] = risk.get("contribution_at_risk_inr") or 0.0
    decision["contribution_protected_inr"] = risk.get("contribution_protected_inr") or 0.0
    decision["procurement_cost_inr"] = risk.get("procurement_cost_inr") or 0.0
    decisions.record_decision(decision)

    append("agent.decision", {"decision_id": state["decision_id"], "action": decision["action"]})
    status = "no_action" if decision["action"] == "WAIT" else state.get("status")
    return {
        "decision": decision,
        "status": status,
        "steps": _step(
            state,
            "evaluate_economics",
            message=f"Growth Engine decision → {decision['action']}",
            decision=decision,
        ),
    }


def route_after_economics(state: AgentState) -> str:
    action = (state.get("decision") or {}).get("action")
    if action in ("WAIT", "DO_NOT_BUY"):
        return "do_not_buy" if action == "DO_NOT_BUY" else "finish"
    if action == "ESCALATE":
        return "escalate"
    return "search_supplier"


async def node_search_supplier(state: AgentState) -> dict:
    sku = state["sku"]
    b = _bounds(state)
    # Operator override (rogue-AI / demo injection) wins over the decision engine's
    # proposal so the gate can be exercised with the hostile lot itself.
    if state.get("override_quantity") is not None:
        quantity = int(state["override_quantity"])
    else:
        quantity = int((state.get("decision") or {}).get("quantity") or 100)

    quotes = negotiation_svc._eligible(sku, b, None, set())
    strategy = negotiation_svc.llm_strategy_statement(
        sku=sku, quotes=[{k: v for k, v in q.items() if k != "quote_valid_until"} for q in quotes],
        intent_bounds=b, quantity=quantity,
    )
    return {
        "quotes": quotes,
        "llm_strategy": strategy,
        "requested_quantity": quantity,
        "quantity": quantity,
        "steps": _step(
            state,
            "search_supplier",
            message=f"Quoted {len(quotes)} eligible suppliers (all within IntentMandate bounds & delivery window)",
            quotes=quotes,
            llm_strategy=strategy,
            llm_provider=llm_provider_name(),
            quantity=quantity,
        ),
    }


async def node_negotiate(state: AgentState) -> dict:
    sku = state["sku"]
    b = _bounds(state)
    scenario = state["scenario"]
    result = negotiation_svc.resolve_negotiation(
        sku=sku,
        quantity=int(state.get("requested_quantity") or 0),
        intent_bounds=b,
        scenario=scenario,
        do_not_buy=(state.get("decision") or {}).get("action") == "DO_NOT_BUY" or scenario == "do_not_buy",
        prev_mandate_id=state["intent"].id,
    )
    cart = result.get("cart")
    append(
        "agent.negotiated",
        {"sku": sku, "action": result.get("action"), "supplier_id": result.get("supplier_id"),
         "quantity": result.get("quantity"), "scenario": scenario},
    )
    payload = dict(result)
    payload["cart"] = mandate_to_json(cart) if cart else None
    return {
        "negotiation": result,
        "cart": cart,
        "quantity": result.get("quantity"),
        "steps": _step(
            state,
            "negotiate",
            message=f"Negotiated {result.get('quantity')} units → {result.get('supplier_name')} "
                    f"(action: {result.get('action')})",
            negotiation=payload,
        ),
    }


def route_after_negotiate(state: AgentState) -> str:
    neg = state.get("negotiation") or {}
    if neg.get("cart") is None:
        return "do_not_buy" if neg.get("action") == "DO_NOT_BUY" else "escalate"
    return "gate"


async def node_gate(state: AgentState) -> dict:
    intent: IntentMandate = state["intent"]
    cart: CartMandate = state["cart"]
    verdict = evaluate_gate(intent, cart, portfolio=state.get("portfolio"))
    append("agent.gate", {"decision_id": state["decision_id"], "passed": verdict.passed,
                          "summary": verdict.summary})
    return {"gate": verdict.to_dict(), "steps": _step(state, "gate", **verdict.to_dict())}


def route_after_gate(state: AgentState) -> str:
    gate = state.get("gate") or {}
    if gate.get("passed"):
        return "execute"
    failed = {c["name"] for c in gate.get("checks", []) if not c.get("passed")}
    hostile = bool(failed & {"quantity_caps", "skus_allowed", "unit_price_caps", "cart_total_integrity"})
    if hostile or state["scenario"] == "rogue_ai":
        return "do_not_buy"
    return "escalate"


async def node_execute(state: AgentState) -> dict:
    cart: CartMandate = state["cart"]
    block = state["reserve_block"]
    amount = round(cart.credentialSubject.total_inr, 2)

    exec_result = await ExecutionCoordinator().execute(
        decision_id=state["decision_id"],
        cart=cart,
        reserve_block=block,
        amount_inr=amount,
        mandate_chain_hash=cart.id,
        sku=state["sku"],
    )
    if exec_result.get("status") == "FAILED":
        return {
            "execution": exec_result,
            "status": "blocked",
            "steps": _step(state, "execute", message="Execution FAILED — no money moved", execution=exec_result),
        }

    warehouse.apply_restock(state["sku"], state["quantity"])
    append("agent.executed", {"decision_id": state["decision_id"], "sku": state["sku"],
                              "amount_inr": amount, "order_id": exec_result.get("order_id")})
    return {
        "execution": exec_result,
        "payment_mandate": exec_result.get("payment_mandate"),
        "capture_result": (
            {"id": exec_result.get("payment_id"), "status": "captured", "simulated": exec_result.get("mode") == "simulation"}
        ),
        "order_id": exec_result.get("order_id"),
        "payment_link": exec_result.get("payment_link"),
        "money_moved_inr": amount,
        "status": "executed",
        "steps": _step(
            state,
            "execute",
            message=f"GATE PASSED → executed ₹{amount:,.2f} via Razorpay "
                    f"(mode: {exec_result.get('mode')}, backend: {exec_result.get('razorpay_backend')})",
            amount_inr=amount,
            order_id=exec_result.get("order_id"),
            payment_id=exec_result.get("payment_id"),
            razorpay_backend=exec_result.get("razorpay_backend"),
            execution=exec_result,
            payment_mandate=exec_result.get("payment_mandate"),
        ),
    }


async def node_reconcile(state: AgentState) -> dict:
    rec = state.get("reconciliation")
    exec_result = state.get("execution") or {}
    decision_id = state["decision_id"]
    if rec is None:
        rec = reconciliation.get_by_decision(decision_id)
    order_id = exec_result.get("order_id")
    if order_id and exec_result.get("razorpay_backend") == "remote-mcp":
        try:
            order = await RazorpayMcpClient().fetch_order(order_id)
            append("reconciliation.order_check", {"decision_id": decision_id, "order": order})
        except Exception as exc:  # fetch is best-effort during reconcile
            append("reconciliation.order_check_failed", {"decision_id": decision_id, "error": str(exc)[:120]})
    return {
        "reconciliation": rec,
        "steps": _step(
            state,
            "reconcile",
            message=f"Reconciliation record open — awaiting Razorpay webhook match (state={rec.get('state') if rec else 'n/a'})",
            reconciliation=rec,
        ),
    }


async def node_measure(state: AgentState) -> dict:
    summary_parts = _summary_skeleton(state)
    outcome = outcomes.record_outcome_from_summary(summary_parts, state.get("reconciliation"))
    return {"outcome": outcome, "steps": _step(state, "measure", message="Outcome measured (predicted vs observed)", outcome=outcome)}


async def node_learn(state: AgentState) -> dict:
    outcomes.update_learning(_summary_skeleton(state))
    return {"steps": _step(state, "learn", message="Learning loop closed — lead-time corrections persisted")}


async def node_do_not_buy(state: AgentState) -> dict:
    cart = state.get("cart")
    amount = round(cart.credentialSubject.total_inr, 2) if cart else 0.0
    pm = issue_payment_mandate(
        agent_did=get_role_did("agent"),
        amount_inr=amount,
        checkout_hash=cart.id if cart else "no-cart-denied",
        reserve_pay_block_id=state["reserve_block"].block_id,
        prev_mandate_id=cart.id if cart else state["intent"].id,
        status="aborted",
    )
    decisions.record_decision({**(state["decision"] or {}), "action": "DO_NOT_BUY",
                               "rationale": "Refused by gate / merchant policy with evidence."})
    append("agent.denied", {"decision_id": state["decision_id"], "sku": state["sku"],
                            "amount_inr": amount, "reason": "gate_refusal"})
    return {
        "payment_mandate": pm,
        "status": "blocked",
        "steps": _step(
            state,
            "do_not_buy",
            message=f"GATE BLOCKED → refused ₹{amount:,.2f} (0 moved). Required human consent to proceed.",
            amount_inr=amount,
            payment_mandate=mandate_to_json(pm),
            denied=True,
        ),
    }


async def node_escalate(state: AgentState) -> dict:
    cart = state.get("cart")
    amount = round(cart.credentialSubject.total_inr, 2) if cart else 0.0
    intent_cap = round(state["intent"].credentialSubject.constraints.amount_max_inr, 2)
    client = RazorpayMcpClient()

    failed_checks = [c["name"] for c in (state.get("gate") or {}).get("checks", []) if not c.get("passed")]
    block_reason = (
        "daily_portfolio_cap_exceeded"
        if "daily_portfolio_cap" in failed_checks
        else "gate_blocked_ceiling_exceeded"
    )

    link = await client.create_payment_link(
        amount_inr=amount or 1.0,
        description=(
            f"Boundary override required — {cart.credentialSubject.supplier_name} "
            f"{cart.credentialSubject.quote_ref}" if cart else
            f"Boundary override required — {state['sku']} (no valid supplier quote)"
        ),
        reference_id=f"OVR-{state['decision_id'][-8:]}",
        notes={"warden_decision_id": state["decision_id"], "sku": state["sku"], "cart_mandate_id": cart.id if cart else ""},
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
            f"Action Blocked. No supplier is within the merchant's bounds; cart total is "
            f"₹{amount:,.2f}, above the ₹{intent_cap:,.0f} AP2 limit for {state['sku']}. "
            f"Please approve manually via this secure link."
        )
    sent = notifications.send_whatsapp(
        to=settings.merchant_phone,
        message=message,
        link=link.get("short_url"),
    )

    pm = issue_payment_mandate(
        agent_did=get_role_did("agent"),
        amount_inr=amount,
        checkout_hash=cart.id if cart else "no-cart-override",
        reserve_pay_block_id=state["reserve_block"].block_id,
        prev_mandate_id=cart.id if cart else state["intent"].id,
        status="aborted",
    )

    esc = approvals.register(
        sku=state["sku"],
        quantity=state.get("quantity") or 0,
        total_inr=amount,
        ceiling_inr=intent_cap,
        cart_mandate=mandate_to_json(cart) if cart else {"note": "no valid supplier quote within bounds"},
        quote_ref=cart.credentialSubject.quote_ref if cart else "NONE",
        reason=block_reason,
        payment_link=link,
    )

    append("agent.blocked", {"decision_id": state["decision_id"], "sku": state["sku"],
                             "amount_inr": amount, "payment_link_id": link.get("id")})
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


def _summary_skeleton(state: AgentState) -> dict:
    return {
        "decision_id": state.get("decision_id", ""),
        "status": state.get("status"),
        "scenario": state.get("scenario"),
        "sku": state.get("sku"),
        "quantity": state.get("quantity"),
        "decision": state.get("decision"),
        "revenue_risk": state.get("revenue_risk"),
        "negotiation": state.get("negotiation"),
        "capture_result": state.get("capture_result"),
    }


async def node_finish(state: AgentState) -> dict:
    negotiation = state.get("negotiation")
    if negotiation and negotiation.get("cart") is not None:
        negotiation = {**negotiation, "cart": mandate_to_json(negotiation["cart"])}
    cart = state.get("cart")
    summary = {
        **{
            "status": state["status"],
            "scenario": state["scenario"],
            "sku": state["sku"],
            "quantity": state.get("quantity"),
            "trigger_reason": state.get("trigger_reason"),
            "decision_id": state["decision_id"],
            "decision": state.get("decision"),
            "revenue_risk": state.get("revenue_risk"),
            "negotiation": negotiation,
            "quotes": state.get("quotes"),
            "llm_strategy": state.get("llm_strategy"),
            "llm_provider": state.get("llm_strategy", {}).get("provider") if state.get("llm_strategy") else llm_provider_name(),
            "intent": mandate_to_json(state["intent"]),
            "cart": mandate_to_json(cart) if cart else None,
            "gate": state.get("gate"),
            "payment_mandate": mandate_to_json(state["payment_mandate"]) if state.get("payment_mandate") else None,
            "capture_result": state.get("capture_result"),
            "payment_link": state.get("payment_link"),
            "order_id": state.get("order_id"),
            "escalation_id": state.get("escalation_id"),
            "whatsapp_message": state.get("whatsapp_message"),
            "reserve_block": reserve_pay.to_dict(state["reserve_block"]),
            "stock_after": warehouse.stock_levels(),
            "execution": state.get("execution"),
            "reconciliation": state.get("reconciliation"),
            "outcome": state.get("outcome"),
            "money_moved_inr": state.get("money_moved_inr", 0.0),
        }
    }
    append("agent.completed", {"status": state["status"], "scenario": state["scenario"], "sku": state["sku"]})
    return {"summary": summary, "steps": _step(state, "finish", message=f"Run complete → {state['status']}")}


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("pre_compute", node_pre_compute)
    g.add_node("detect", node_detect)
    g.add_node("calculate_risk", node_calculate_risk)
    g.add_node("evaluate_economics", node_evaluate_economics)
    g.add_node("search_supplier", node_search_supplier)
    g.add_node("negotiate", node_negotiate)
    g.add_node("gate", node_gate)
    g.add_node("execute", node_execute)
    g.add_node("reconcile", node_reconcile)
    g.add_node("measure", node_measure)
    g.add_node("learn", node_learn)
    g.add_node("do_not_buy", node_do_not_buy)
    g.add_node("escalate", node_escalate)
    g.add_node("finish", node_finish)

    g.set_entry_point("pre_compute")
    g.add_edge("pre_compute", "detect")
    g.add_edge("detect", "calculate_risk")
    g.add_edge("calculate_risk", "evaluate_economics")

    g.add_conditional_edges(
        "evaluate_economics",
        route_after_economics,
        {"search_supplier": "search_supplier", "do_not_buy": "do_not_buy",
         "escalate": "escalate", "finish": "finish"},
    )
    g.add_edge("search_supplier", "negotiate")
    g.add_conditional_edges(
        "negotiate",
        route_after_negotiate,
        {"gate": "gate", "do_not_buy": "do_not_buy", "escalate": "escalate"},
    )
    g.add_conditional_edges("gate", route_after_gate, {"execute": "execute", "do_not_buy": "do_not_buy", "escalate": "escalate"})
    g.add_edge("execute", "reconcile")
    g.add_edge("reconcile", "measure")
    g.add_edge("measure", "learn")
    g.add_edge("learn", "finish")

    g.add_edge("do_not_buy", "finish")
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
    velocity_units_per_min: float | None = None,
    do_not_buy: bool | None = None,
) -> dict:
    """Execute the agent. `on_update(node_name, node_update)` is awaited after every node."""
    scenario = normalize_scenario(scenario)
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
        velocity_units_per_min=velocity_units_per_min,
        do_not_buy=do_not_buy,
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
"""Structured supplier negotiation.

Deterministic, bounded procurement policy:

  * quote every eligible registered supplier (id, price, lead, reliability, MOQ)
  * eligibility = within IntentMandate caps AND delivery inside the agent window
  * incumbent-stable: keep the current supplier while it is compliant; switch only
    when it breaks a bound (price attack) or is suppressed (incident / reliability)
  * otherwise reduce quantity to the largest lot that still fits the cap
  * otherwise DO_NOT_BUY / ESCALATE

The LLM never decides a price or authorizes money — it only explains the tradeoff
after the fact (narrative), while every boundary stays with this deterministic code.
"""
from __future__ import annotations

import json

from app.config import settings
from app.models.finance import EconomicDecision
from app.services.suppliers import (
    SUPPLIERS,
    active_suppliers,
    build_cart_mandate,
    estimate_lead_time,
    quote_expiry_s,
    unit_price_for,
)
from app.services.revenue_risk import AGENT_LEAD_WINDOW_S

INCUMBENT = "SUP-A"


def _eligible(sku: str, intent_bounds: dict, learned: dict | None, excluded: set[str]) -> list[dict]:
    """Quote + filter suppliers into eligible options."""
    learned = learned or {}
    out = []
    max_unit = float(intent_bounds["max_unit_price_inr"])
    for sup in active_suppliers():
        if sup.id in excluded:
            continue
        price = round(unit_price_for(sup.id, sku, "normal"), 2)
        lead = estimate_lead_time(sup.id, learned)
        if price > max_unit:
            continue
        # risk-adjusted delivery: a slow OR unreliable supplier that cannot
        # land within the window with margin is not a viable option no matter
        # how cheap it is (SUP-C at 85s/76% → effective 112s → excluded).
        risk_adjusted_lead = lead / max(sup.reliability, 0.001)
        if risk_adjusted_lead > AGENT_LEAD_WINDOW_S:
            continue
        out.append(
            {
                "supplier_id": sup.id,
                "name": sup.name,
                "unit_price_inr": price,
                "lead_time_s": round(lead, 1),
                "reliability": sup.reliability,
                "moq": sup.moq,
                "max_qty": sup.max_qty,
                "quote_valid_until": quote_expiry_s(sup.id, sku).isoformat(timespec="seconds"),
            }
        )
    out.sort(key=lambda q: (q["unit_price_inr"], q["lead_time_s"]))
    return out


def resolve_negotiation(
    *,
    sku: str,
    quantity: int,
    intent_bounds: dict,
    scenario: str,
    learned: dict | None = None,
    excluded: set[str] | None = None,
    do_not_buy: bool = False,
    prev_mandate_id: str | None = None,
) -> dict:
    """Choose the supplier and final cart; returns a negotiation-result dict."""
    excluded = set(excluded or [])
    quotes = _eligible(sku, intent_bounds, learned, excluded)
    amount_cap = float(intent_bounds["amount_max_inr"])
    max_qty = int(intent_bounds["max_quantity_per_sku"])

    scenario_flags: list[str] = []
    if scenario == "price_attack":
        scenario_flags.append("incumbent SUP-A inflated unit price above cap")
    if scenario == "multi_supplier":
        # suppress the incumbent (simulated logistics incident) to force honest search
        excluded.add(INCUMBENT)
        scenario_flags.append("incumbent SUP-A suppressed by logistics incident")
    if scenario == "rogue_ai":
        scenario_flags.append("run originated with a rogue over-quantity mandate")

    # deterministic quote reaction: build cart mandatelike payload candidates
    supplier_id = None
    unit_price = None
    action = "NEGOTIATE"
    rationale = ""
    factors: list[str] = []

    if do_not_buy:
        return {
            "action": "DO_NOT_BUY",
            "supplier_id": None,
            "quantity": 0,
            "unit_price_inr": None,
            "rationale": "Merchant policy forbids autonomous procurement in this cycle.",
            "factors": [s for s in scenario_flags] + ["DO_NOT_BUY mandated by merchant policy"],
            "quotes": quotes,
            "cart": None,
        }

    if not quotes:
        return {
            "action": "ESCALATE",
            "supplier_id": None,
            "quantity": 0,
            "unit_price_inr": None,
            "rationale": "No supplier is within IntentMandate bounds and delivery window — nothing to buy.",
            "factors": [s for s in scenario_flags] + ["no eligible supplier quote"],
            "quotes": quotes,
            "cart": None,
        }

    best = quotes[0]
    incumbent_quote = next((q for q in quotes if q["supplier_id"] == INCUMBENT), None)

    # incumbent-stable: prefer incumbent while compliant
    if incumbent_quote and scenario not in ("price_attack", "multi_supplier"):
        chosen = incumbent_quote
        unit_price = incumbent_quote["unit_price_inr"]
        supplier_id = chosen["supplier_id"]
    else:
        chosen = best
        unit_price = best["unit_price_inr"]
        supplier_id = best["supplier_id"]
        action = "SWITCH_SUPPLIER" if INCUMBENT in {q["supplier_id"] for q in quotes} or scenario == "multi_supplier" or scenario == "price_attack" else "NEGOTIATE"

    # Rogue-injection guard: a requested lot ABOVE the per-SKU policy cap is NOT
    # trimmed here. It passes through to the gate untouched so the gate can refuse
    # it with full evidence (quantity_caps + total_within_limit) and ₹0 moves.
    if quantity > max_qty:
        total = round(quantity * unit_price, 2)
        cart = build_cart_mandate(
            supplier_id=supplier_id, sku=sku, quantity=quantity,
            scenario="price_attack" if (scenario == "price_attack" and supplier_id == INCUMBENT) else "normal",
            prev_mandate_id=prev_mandate_id,
        )
        return {
            "action": "ESCALATE",
            "supplier_id": supplier_id,
            "supplier_name": chosen["name"],
            "quantity": quantity,
            "unit_price_inr": unit_price,
            "total_inr": total,
            "rationale": (
                f"Requested lot {quantity} exceeds the per-SKU cap {max_qty} — refusing to "
                f"auto-reduce a hostile request; the gate will reject it with evidence (₹0 will move)."
            ),
            "factors": [s for s in scenario_flags] + [f"requested {quantity} > cap {max_qty}"],
            "quotes": quotes,
            "cart": cart,
        }

    # fit the cap: maximize the largest lot whose cost stays within the intent.
    max_allowed = min(quantity, max_qty, chosen["max_qty"])
    max_allowed = max(max_allowed, 0)
    qty = int(amount_cap / unit_price) if unit_price > 0 else 0
    qty = min(max_allowed, max(0, qty))
    total = round(qty * unit_price, 2)

    if qty < max(0, chosen["moq"]):
        return {
            "action": "ESCALATE",
            "supplier_id": supplier_id,
            "quantity": 0,
            "unit_price_inr": unit_price,
            "rationale": f"{chosen['name']} only serves {chosen['moq']}+ units; a compliant lot is unavailable.",
            "factors": [s for s in scenario_flags] + [f"min order {chosen['moq']} > affordable {qty}"],
            "quotes": quotes,
            "cart": None,
        }

    if qty == 0:
        return {
            "action": "ESCALATE",
            "supplier_id": supplier_id,
            "quantity": 0,
            "unit_price_inr": unit_price,
            "rationale": "No affordable quantity within the intent cap — human override required.",
            "factors": [s for s in scenario_flags] + ["cart cost would exceed the intent cap"],
            "quotes": quotes,
            "cart": None,
        }

    if qty < max_allowed:
        action = "REDUCE_QUANTITY" if action != "SWITCH_SUPPLIER" else action
        rationale = f"Trimmed {quantity} → {qty} units so the cart fits the ₹{amount_cap:,.2f} intent cap."
        factors.extend([
            f"chosen {chosen['name']} @ ₹{unit_price:,.2f}/unit",
            f"cart best fit = ₹{total:,.2f} <= ₹{amount_cap:,.2f}",
        ])
    else:
        rationale = (
            f"{chosen['name']} quoted ₹{unit_price:,.2f}/unit inside the ₹{amount_cap:,.2f} cap; "
            f"{quantity} units @ ₹{total:,.2f}."
        )
        factors.extend([
            f"{q['supplier_id']} ₹{q['unit_price_inr']:,.2f}/unit l={q['lead_time_s']:.0f}s r={q['reliability']:.0%}"
            for q in quotes[:3]
        ])

    cart = None
    if qty > 0:
        cart = build_cart_mandate(
            supplier_id=supplier_id,
            sku=sku,
            quantity=qty,
            scenario="price_attack" if (scenario == "price_attack" and supplier_id == INCUMBENT) else "normal",
            prev_mandate_id=prev_mandate_id,
        )

    result = {
        "action": action,
        "supplier_id": supplier_id,
        "supplier_name": chosen["name"],
        "quantity": qty,
        "unit_price_inr": unit_price,
        "total_inr": total,
        "rationale": rationale,
        "factors": factors,
        "quotes": quotes,
        "cart": cart,
    }
    return result


def llm_strategy_statement(*, sku: str, quotes: list[dict], intent_bounds: dict, quantity: int) -> dict:
    """Advisory narrative from the LLM — never money-impacting.

    Returns {"strategy": str, "provider": str, "advisory": bool} — the actual cart
    is chosen by the deterministic engine above.
    """
    if not settings.llm_available:
        return {"strategy": "N/A (LLM unavailable — deterministic policy)", "provider": "mock", "advisory": False}

    prompt = (
        "You are a procurement analyst. Given the supplier quotes below and a hard "
        f"max cart of ₹{intent_bounds['amount_max_inr']:,.2f}, state your recommendation "
        "in ONE sentence. Do not output JSON or numbers you cannot justify."
    )
    try:
        import litellm

        kwargs = dict(
            model=settings.agent_llm_model,
            messages=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        {"sku": sku, "requested_quantity": quantity, "quotes": quotes},
                        default=str,
                    ),
                },
            ],
            timeout=12,
        )
        if "gemini-3" not in settings.agent_llm_model:
            kwargs["temperature"] = 0
        resp = litellm.completion(**kwargs)
        return {
            "strategy": resp.choices[0].message.content.strip()[:300],
            "provider": settings.agent_llm_provider,
            "advisory": True,
        }
    except Exception as exc:  # advisory never breaks the pipeline
        return {"strategy": f"LLM unavailable ({exc}) — deterministic policy", "provider": "fallback", "advisory": True}
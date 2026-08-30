"""Revenue-at-risk machine (Appx-44B / Analytical-Value-Machine, §20 + §45).

Deterministic, auditable model of the revenue a stockout would destroy:

    expected_lost_units   = projected demand inside the replenishment window that
                            stock on hand cannot serve
    revenue_at_risk       = expected_lost_units × selling price
    contribution_at_risk  = expected_lost_units × unit contribution margin

The Growth Engine compares `contribution/protection` economics and makes a
procurement decision; the AP2 gate separately verifies the money path. Numbers are
bounded and formula-driven so the demo is deterministic and provable.
"""
from __future__ import annotations

import math

from app.config import settings
from app.models.finance import RevenueRiskInput, RevenueRiskResult
from app.products import PRODUCTS

# Hard rule: an agent pipeline must arrive before this absolute window. Used to
# score supplier lead time against the merchant policy (AP2-OR revenue protection).
AGENT_LEAD_WINDOW_S = 90.0


def contribution_margin_per_unit(sku: str) -> float:
    p = PRODUCTS[sku]
    return round(p.price_inr - p.price_inr * 0.55, 2)  # ~45% blended gross margin


def compute_revenue_risk(
    *,
    sku: str,
    current_stock: int,
    units_per_minute: float,
    supplier_lead_time_s: float | None = None,
    risk_window_s: float | None = None,
) -> RevenueRiskResult:
    p = PRODUCTS[sku]
    selling_price = p.price_inr
    procurement_cost = p.price_inr  # catalog price ≈ merchant's buy-in (parity)
    margin = contribution_margin_per_unit(sku)

    lead_s = float(supplier_lead_time_s or AGENT_LEAD_WINDOW_S)
    window_s = float(risk_window_s or AGENT_LEAD_WINDOW_S)

    units_per_second = max(0.0, units_per_minute / 60.0)
    time_to_stockout = (
        (current_stock / units_per_second) if units_per_second > 1e-9 else math.inf
    )

    # Demand projected inside the risk window while the replenishment pipeline runs.
    expected_demand = max(0.0, units_per_second * window_s)
    # Units the on-hand stock CANNOT serve inside that window (floored at zero).
    lost_units = max(0.0, expected_demand - current_stock)

    revenue_at_risk = round(lost_units * selling_price, 2)
    contribution_at_risk = round(lost_units * margin, 2)

    # The protective BUY restores coverage for the window, so the protected
    # contribution equals the contribution on the units the restock guarantees:
    # min(restock coverage, demand that would otherwise be lost).
    proposed_quantity = int(p.restock_qty)
    protected_units = min(proposed_quantity, max(lost_units, expected_demand))
    contribution_protected = round(protected_units * margin, 2)
    procurement_cost = round(proposed_quantity * procurement_cost, 2)
    spend_ratio = (
        round(contribution_protected / procurement_cost, 4) if procurement_cost > 0 else 0.0
    )

    return RevenueRiskResult(
        sku=sku,
        time_to_stockout_s=(
            round(time_to_stockout, 1) if time_to_stockout != math.inf else None
        ),
        supplier_lead_time_s=lead_s,
        risk_window_s=window_s,
        expected_demand_in_window=round(expected_demand, 2),
        available_stock=current_stock,
        expected_lost_units=round(lost_units, 2),
        revenue_at_risk_inr=revenue_at_risk,
        contribution_at_risk_inr=contribution_at_risk,
        proposed_quantity=proposed_quantity,
        procurement_cost_inr=procurement_cost,
        contribution_protected_inr=contribution_protected,
        protection_spend_ratio=spend_ratio,
        assumptions={
            "risk_window": f"{window_s:.0f}s ({AGENT_LEAD_WINDOW_S:.0f}s agent pipeline)",
            "velocity_source": "live velocity engine (units/min)",
            "margin_model": "45% blended gross margin",
        },
    )


def evaluate_decision(risk: RevenueRiskResult) -> dict:
    """AP2-OR Growth Engine decision logic (deterministic).

    Returns an EconomicDecision-shaped dict plus the factor list explaining WHY
    (each factor is rendered as evidence, not marketing).
    """
    from app.services.decisions import record_decision

    decision: dict = {}

    demand_pressure = risk.expected_lost_units > 0
    time_pressure = risk.time_to_stockout_s is None or risk.time_to_stockout_s <= risk.risk_window_s

    if risk.time_to_stockout_s is not None and risk.time_to_stockout_s <= 0:
        decision = {
            "action": "ESCALATE",
            "quantity": None,
            "rationale": "Already sold out — buying now cannot recover the window; surface human override.",
            "factors": [
                "actual stock 0 within the agent risk window",
                "expected lost units exceed on-hand stock",
                "buy alone cannot protect the window → ESCALATE",
            ],
        }
    elif demand_pressure and time_pressure:
        decision = {
            "action": "BUY",
            "quantity": risk.proposed_quantity,
            "rationale": (
                f"Revenue protection is economically justified: protection ratio "
                f"{risk.protection_spend_ratio:.2f} (contribution protected ₹{risk.contribution_protected_inr:,.2f} "
                f"per ₹{risk.procurement_cost_inr:,.2f} spent)."
            ),
            "factors": [
                f"expected lost units in {risk.risk_window_s:.0f}s window: {risk.expected_lost_units:.1f}",
                f"time to stockout {risk.time_to_stockout_s:.1f}s <= {risk.risk_window_s:.0f}s window"
                if risk.time_to_stockout_s is not None
                else "time to stockout > window — no breach",
                f"revenue at risk ₹{risk.revenue_at_risk_inr:,.2f} vs procurement ₹{risk.procurement_cost_inr:,.2f}",
                f"contribution protected ₹{risk.contribution_protected_inr:,.2f} (ratio {risk.protection_spend_ratio:.2f})",
            ],
        }
    elif not demand_pressure:
        decision = {
            "action": "WAIT",
            "quantity": None,
            "rationale": "No projected stockout inside the risk window — no spend and no risk.",
            "factors": [
                f"expected lost units = {risk.expected_lost_units:.2f}",
                "projected demand within window is fully covered by on-hand stock",
            ],
        }
    else:
        decision = {
            "action": "WAIT",
            "quantity": None,
            "rationale": "Demand is elevated but the window is not breached; watch next cycle.",
            "factors": [
                f"time to stockout {risk.time_to_stockout_s:.1f}s exceeds window {risk.risk_window_s:.0f}s",
                "no imminent revenue loss — defer spend",
            ],
        }

    record_decision({
        "decision_id": f"dec_{risk.sku}_{0}",  # caller overwrites with the real id on commit
        "sku": risk.sku,
        "revenue_at_risk_inr": risk.revenue_at_risk_inr,
        "contribution_at_risk_inr": risk.contribution_at_risk_inr,
        "contribution_protected_inr": risk.contribution_protected_inr,
        "procurement_cost_inr": risk.procurement_cost_inr,
        "protection_spend_ratio": risk.protection_spend_ratio,
        **decision,
    })
    return decision
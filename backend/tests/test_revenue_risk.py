"""Revenue-at-risk machine: the usable, money-relevant numbers behind the
autonomous spend. Every value is formula-bound, so the tests pin them down."""
import pytest

from app.services.decisions import list_decisions
from app.services.revenue_risk import (
    AGENT_LEAD_WINDOW_S,
    compute_revenue_risk,
    contribution_margin_per_unit,
)
from app.services.negotiation import resolve_negotiation


def test_zero_velocity_means_zero_risk():
    risk = compute_revenue_risk(sku="SKU-404", current_stock=12, units_per_minute=0.0)
    assert risk.time_to_stockout_s is None  # ∞
    assert risk.expected_demand_in_window == 0.0
    assert risk.expected_lost_units == 0.0
    assert risk.revenue_at_risk_inr == 0.0


def test_risk_scales_with_velocity_and_price():
    r1 = compute_revenue_risk(sku="SKU-404", current_stock=12, units_per_minute=30.0)
    r2 = compute_revenue_risk(sku="SKU-404", current_stock=12, units_per_minute=60.0)
    assert r2.expected_lost_units > r1.expected_lost_units
    # revenue at risk = lost units × ₹98 selling price
    assert r1.revenue_at_risk_inr == pytest.approx(r1.expected_lost_units * 98.0, abs=0.01)


def test_lost_units_floor_at_zero_when_stock_covers_window():
    risk = compute_revenue_risk(sku="SKU-404", current_stock=400, units_per_minute=60.0)
    # window demand = 90s × 1 unit/s = 90 units << 400 on hand
    assert risk.expected_lost_units == 0.0
    assert risk.revenue_at_risk_inr == 0.0
    assert risk.time_to_stockout_s == pytest.approx(400.0)


def test_contribution_margin_is_the_protected_value():
    margin = contribution_margin_per_unit("SKU-404")
    assert margin == pytest.approx(98.0 * 0.45, abs=0.01)
    risk = compute_revenue_risk(sku="SKU-404", current_stock=12, units_per_minute=60.0)
    assert risk.contribution_at_risk_inr == pytest.approx(risk.expected_lost_units * margin, abs=0.01)
    assert risk.contribution_protected_inr > 0.0


def test_protection_spend_ratio_is_bounded_above_zero():
    risk = compute_revenue_risk(sku="SKU-404", current_stock=12, units_per_minute=60.0)
    assert risk.procurement_cost_inr > 0
    assert 0.0 < risk.protection_spend_ratio <= 1.0


def test_decision_matrix():
    # Sold out → ESCALATE (buying cannot recover an already-lost window).
    sold_out = compute_revenue_risk(sku="SKU-404", current_stock=0, units_per_minute=60.0)
    from app.services.revenue_risk import evaluate_decision

    assert evaluate_decision(sold_out)["action"] == "ESCALATE"

    # Healthy stock → WAIT, no spend.
    healthy = compute_revenue_risk(sku="SKU-404", current_stock=400, units_per_minute=60.0)
    assert evaluate_decision(healthy)["action"] == "WAIT"

    # Breach → BUY with the proposed quantity.
    breach = compute_revenue_risk(sku="SKU-404", current_stock=12, units_per_minute=60.0)
    decision = evaluate_decision(breach)
    assert decision["action"] == "BUY"
    assert decision["quantity"] == breach.proposed_quantity

    # Every decision was persisted to the decision ledger.
    decisions = list_decisions()["decisions"]
    assert any(d["sku"] == "SKU-404" for d in decisions)


@pytest.mark.asyncio
async def test_velocity_wiring_through_full_pipeline():
    """The velocity from the live engine is the risk machine's demand input end-
    to-end: at ~18 units/min inside the 90s window, restock is justified."""
    result = await _run_supplier_context(units_per_minute=18.0)
    assert result["status"] == "executed"
    assert result["revenue_risk"]["expected_lost_units"] > 0


@pytest.mark.asyncio
async def test_economics_baseline_velocity_wiring():
    """Feedback: the risk machine itself rejects the request when there is no
    projected loss — the WAIT answer is what protects the reserve budget."""
    result = await _run_supplier_context(units_per_minute=0.2)
    assert result["status"] == "no_action"


async def _run_supplier_context(units_per_minute: float):
    from app.agent.graph import run_agent

    return await run_agent(
        scenario="happy",
        reset_inventory=True,
        velocity_units_per_min=units_per_minute,
    )
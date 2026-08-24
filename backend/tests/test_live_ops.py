"""Live Ops tests: velocity math, hysteresis, festival curves, portfolio cap."""
import asyncio

import pytest

from app.ap2.gate import evaluate_gate  # noqa: F401  (kept for parity with flows)
from app.agent.graph import run_agent
from app.audit import clear as clear_audit
from app.products import limits_for, velocity_at
from app.services import approvals as approvals_store
from app.services import reserve_pay, warehouse
from app.services.live_ops import LiveOps
from app.services.velocity_engine import (
    TRIGGER_LEAD_TIME_SECONDS,
    VelocityEngine,
)

from app.paths import APPROVALS_FILE as APPROVALS_FILE


@pytest.fixture(autouse=True)
def clean_state():
    clear_audit()
    reserve_pay._blocks.clear()
    reserve_pay._daily_block_id = None
    warehouse.reset()
    import os

    if os.path.exists(APPROVALS_FILE):
        os.remove(APPROVALS_FILE)
    yield


# --------------------------------------------------------------------- engine

def test_predictive_fires_well_before_hard_floor():
    """High demand: the prediction crosses the lead time while stock is still high."""
    t = [1000.0]
    eng = VelocityEngine(lambda: t[0])
    # 2 units/sec sustained across the whole 30s window → 120/min
    for i in range(30):
        eng.record_sale("X", 2, t[0] - 30 + i)
    snap = eng.snapshot("X", stock=200)
    assert snap["unitsPerMinute"] == pytest.approx(120.0)
    # predicted = 200 / 120 * 60 = 100s — just outside the lead time
    assert snap["predictedSecondsToStockout"] == pytest.approx(100.0)
    fire, reason = eng.should_trigger("X", 200)
    assert not fire
    # A little faster or less stock → fires PREDICTIVELY far above the floor
    fire, reason = eng.should_trigger("X", 150)
    assert fire and reason == "predictive_velocity"
    assert 150 > 3  # provably not the hard floor


def test_hard_floor_is_the_safety_net_without_demand():
    t = [1000.0]
    eng = VelocityEngine(lambda: t[0])
    fire, reason = eng.should_trigger("Y", 3)
    assert fire and reason == "hard_floor"
    # Zero stock must ALSO be rescuable — no product is ever left sold out.
    fire, reason = eng.should_trigger("Y", 0)
    assert fire and reason == "hard_floor"


def test_window_pruning_kills_stale_velocity():
    t = [1000.0]
    eng = VelocityEngine(lambda: t[0])
    eng.record_sale("Z", 50, t[0] - 5)
    assert eng.snapshot("Z", 10)["unitsPerMinute"] == pytest.approx(100.0)
    t[0] += 120  # everything aged out of the 30s window
    snap = eng.snapshot("Z", 10)
    assert snap["unitsPerMinute"] == 0.0
    assert snap["predictedSecondsToStockout"] is None


def test_festival_curve_interpolation():
    curve = ((0, 48.0), (30, 48.0), (32, 150.0))
    assert velocity_at(curve, -5) == 48.0
    assert velocity_at(curve, 15) == 48.0
    assert velocity_at(curve, 31) == pytest.approx(99.0)  # mid-ramp between knots
    assert velocity_at(curve, 600) == 150.0  # held at last knot


# ------------------------------------------------------------------ hysteresis

@pytest.mark.asyncio
async def test_no_duplicate_trigger_while_restocking():
    sent: list[dict] = []

    async def fake_broadcast(payload: dict):
        sent.append(payload)

    t = [1000.0]
    ops = LiveOps(fake_broadcast, clock=lambda: t[0])
    ops.launched_at_ms["SKU-F1"] = 1.0  # make the festival SKU visible

    # Heavy demand on F1 → critical within one window
    for i in range(30):
        ops._ingest_sale("SKU-F1", 2)
        t[0] += 0.9
    t[0] += 1.0

    async def slow_pipeline(trigger: dict):
        await asyncio.sleep(0.05)
        trigger["outcome"] = "executed"
        ops._cooldown_until["SKU-F1"] = t[0] + 60.0  # mirrors the real pipeline's finally

    ops._run_pipeline = slow_pipeline  # type: ignore[method-assign]

    await ops._tick_once()
    first = ops.trigger_for_sku("SKU-F1")
    assert first is not None and first["reason"] == "predictive_velocity"

    # Keep selling hard — the busy pipeline must suppress any second trigger.
    for _ in range(3):
        ops._ingest_sale("SKU-F1", 3)
        t[0] += 1.0
        await ops._tick_once()
    assert len([tr for tr in ops.triggers if tr["sku"] == "SKU-F1"]) == 1

    # Pipeline finishes → 60s cooldown blocks an immediate re-fire…
    await asyncio.sleep(0.08)
    assert ops.trigger_for_sku("SKU-F1") is None
    ops._ingest_sale("SKU-F1", 3)
    t[0] += 1.0
    await ops._tick_once()
    assert len([tr for tr in ops.triggers if tr["sku"] == "SKU-F1"]) == 1  # still cooling down

    # …but after the cooldown expires AND demand persists, it may fire again.
    t[0] += 61.0
    for i in range(30):
        ops._ingest_sale("SKU-F1", 2)
        t[0] += 0.9
    await ops._tick_once()
    assert len([tr for tr in ops.triggers if tr["sku"] == "SKU-F1"]) == 2


# ------------------------------------------------------------- portfolio cap

@pytest.mark.asyncio
async def test_daily_portfolio_cap_blocks_and_escalates():
    """Once today's committed spend fills the ceiling, the next restock must be
    blocked by the gate and escalated — even though ITS OWN intent allows it."""
    block = reserve_pay.get_or_create_daily_block(100_000.0)
    auth = reserve_pay.synthetic_authorized_payment(block, 95_000.0)
    reserve_pay.debit(block, 95_000.0, auth)  # ₹95k already autonomously spent today

    # SKU-203 cart = ₹199 × 60 = ₹11,940 → 95,000 + 11,940 > 1,00,000 ceiling.
    result = await run_agent(
        sku="SKU-203",
        scenario="happy",
        reset_inventory=False,
        limits=limits_for("SKU-203"),
        portfolio={"spent": 95_000.0, "ceiling": 100_000.0},
    )
    assert result["status"] == "blocked"
    assert result["gate"]["passed"] is False
    cap_check = next(c for c in result["gate"]["checks"] if c["name"] == "daily_portfolio_cap")
    assert cap_check["passed"] is False
    assert result["capture_result"] is None

    esc_id = result["escalation_id"]
    assert esc_id and esc_id.startswith("appr_")
    row = next(p for p in approvals_store.list_all()["pending"] if p["id"] == esc_id)
    assert row["reason"] == "daily_portfolio_cap_exceeded"
    assert row["sku"] == "SKU-203"
    assert verify_chain_valid()


def verify_chain_valid() -> bool:
    from app.audit import verify_chain

    return verify_chain()["valid"] is True

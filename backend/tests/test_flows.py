import asyncio

import pytest

from app.agent.graph import run_agent
from app.audit import clear as clear_audit
from app.services import reserve_pay, warehouse


@pytest.fixture(autouse=True)
def clean_state():
    clear_audit()
    reserve_pay._blocks.clear()
    warehouse.reset()
    yield


@pytest.mark.asyncio
async def test_happy_path_autonomous_capture():
    result = await run_agent(scenario="happy")
    assert result["status"] == "executed"
    assert result["gate"]["passed"] is True
    assert result["cart"]["credentialSubject"]["total_inr"] == 9800.0
    assert result["capture_result"]["status"] == "captured"
    assert result["reserve_block"]["remaining_inr"] == pytest.approx(200.0)
    assert result["stock_after"]["SKU-404"] == 112  # 12 + 100


@pytest.mark.asyncio
async def test_failure_path_graceful_escalation():
    result = await run_agent(scenario="failure")
    assert result["status"] == "blocked"
    assert result["gate"]["passed"] is False
    assert result["cart"]["credentialSubject"]["total_inr"] == 11000.0
    assert result["capture_result"] is None
    assert result["payment_link"]["amount"] == 1_100_000  # ₹11,000 in paise
    assert "exceeds my" in result["whatsapp_message"]["message"]
    assert "https://rzp.io/l/" in result["payment_link"]["short_url"]
    assert result["stock_after"]["SKU-404"] == 12  # untouched


@pytest.mark.asyncio
async def test_hallucinated_quantity_is_blocked_by_gate():
    """Even if the LLM proposes 10,000 units, the deterministic gate must refuse."""
    result = await run_agent(scenario="happy", override_quantity=10000)
    assert result["status"] == "blocked"
    assert result["gate"]["passed"] is False
    qty_check = next(c for c in result["gate"]["checks"] if c["name"] == "quantity_caps")
    assert qty_check["passed"] is False
    assert result["capture_result"] is None


@pytest.mark.asyncio
async def test_audit_trail_is_append_only_and_chained():
    result = await run_agent(scenario="happy")
    from app.audit import read_all

    records = read_all()
    kinds = {r["kind"] for r in records}
    assert "reserve_pay.blocked" in kinds
    assert "agent.gate" in kinds
    assert "agent.executed" in kinds
    assert "razorpay.tool" in kinds

    # The mandate chain must be linked: intent -> cart -> payment
    intent = result["intent"]
    cart = result["cart"]
    payment = result["payment_mandate"]
    assert cart["credentialSubject"]["prev_mandate_id"] == intent["id"]
    assert payment["credentialSubject"]["prev_mandate_id"] == cart["id"]
    assert payment["credentialSubject"]["payment_id"] == result["capture_result"]["id"]
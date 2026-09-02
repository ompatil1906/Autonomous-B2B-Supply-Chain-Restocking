import asyncio
import os

import pytest

from app.agent.graph import run_agent
from app.audit import clear as clear_audit
from app.audit import read_all, verify_chain
from app.services import approvals as approvals_store
from app.services import reserve_pay, warehouse
from app.services.razorpay_mcp import RazorpayMcpClient

from app.paths import APPROVALS_FILE as APPROVALS_FILE


@pytest.fixture(autouse=True)
def clean_state():
    clear_audit()
    reserve_pay._blocks.clear()
    reserve_pay._daily_block_id = None
    warehouse.reset()
    if os.path.exists(APPROVALS_FILE):
        os.remove(APPROVALS_FILE)
    yield


@pytest.mark.asyncio
async def test_happy_path_autonomous_capture():
    result = await run_agent(scenario="happy")
    assert result["status"] == "executed"
    assert result["gate"]["passed"] is True
    assert result["cart"]["credentialSubject"]["total_inr"] == 9800.0
    assert result["capture_result"]["status"] == "captured"
    # Debits draw from the shared ₹1,00,000 portfolio-level daily Reserve Pay block.
    assert result["reserve_block"]["reserved_inr"] == pytest.approx(100_000.0)
    assert result["reserve_block"]["remaining_inr"] == pytest.approx(90_200.0)
    assert result["stock_after"]["SKU-404"] == 112  # 12 + 100
    assert verify_chain()["valid"] is True


@pytest.mark.asyncio
async def test_price_attack_switches_supplier_autonomously():
    """Mode B: the incumbent inflates its unit price above the merchant cap; the
    agent switches to a cheaper eligible supplier instead of escalating."""
    result = await run_agent(scenario="failure")  # legacy alias → price_attack
    assert result["status"] == "executed"
    assert result["gate"]["passed"] is True
    assert result["negotiation"]["action"] == "SWITCH_SUPPLIER"
    # incumbent SUP-A was inflated (₹110 > ₹100 cap); Vertex Wholesale (SUP-B) is taken.
    assert result["negotiation"]["supplier_id"] == "SUP-B"
    assert result["negotiation"]["unit_price_inr"] < 100.0
    assert result["cart"]["credentialSubject"]["total_inr"] == pytest.approx(
        100 * result["negotiation"]["unit_price_inr"], abs=0.02
    )
    assert result["money_moved_inr"] == pytest.approx(result["cart"]["credentialSubject"]["total_inr"])
    assert result["stock_after"]["SKU-404"] == 112  # restock landed
    assert result["escalation_id"] is None
    # the run still flowed through the full gated chain, now with per-supplier identity
    assert result["cart"]["issuer"].startswith("did:ap2:")


@pytest.mark.asyncio
async def test_price_attack_with_no_viable_supplier_escalates():
    """Daily portfolio ceiling breach → the gate blocks and the agent escalates
    with a payment link instead of paying out of mandate."""
    result = await run_agent(
        scenario="happy",
        portfolio={"spent": 96_000.0, "ceiling": 100_000.0},
    )
    assert result["status"] == "blocked"
    assert result["money_moved_inr"] == 0.0
    assert result["escalation_id"] and result["escalation_id"].startswith("appr_")
    assert result["payment_link"] is not None
    assert result["payment_link"]["amount"] == pytest.approx(9800.0 * 100)  # paise


@pytest.mark.asyncio
async def test_hallucinated_quantity_is_blocked_by_gate():
    """Even if the LLM proposes 10,000 units, the deterministic gate must refuse."""
    result = await run_agent(scenario="happy", override_quantity=10000)
    assert result["status"] == "blocked"
    assert result["gate"]["passed"] is False
    qty_check = next(c for c in result["gate"]["checks"] if c["name"] == "quantity_caps")
    assert qty_check["passed"] is False
    total_check = next(c for c in result["gate"]["checks"] if c["name"] == "total_within_limit")
    assert total_check["passed"] is False
    assert result["money_moved_inr"] == 0.0
    assert result["capture_result"] is None
    assert result["execution"] is None


@pytest.mark.asyncio
async def test_persisted_decision_carries_negotiated_pricing():
    """The restock pipeline must show unit price + total truthfully, so the
    persisted decision (initially recorded pre-supplier) is backfilled with the
    negotiated cart pricing when the run completes."""
    from app.services import decisions as decisions_store

    result = await run_agent(scenario="happy")
    assert result["status"] == "executed"

    persisted = decisions_store.get_decision(result["decision_id"])
    assert persisted is not None
    assert persisted["action"] == "BUY"
    assert persisted["total_inr"] == pytest.approx(9800.0)
    assert persisted["unit_price_inr"] == pytest.approx(98.0)  # 9800 / 100 units
    assert persisted["quantity"] == 100
    assert persisted["supplier_id"]


@pytest.mark.asyncio
async def test_audit_trail_is_append_only_and_chained():
    result = await run_agent(scenario="happy")
    records = read_all()
    kinds = {r["kind"] for r in records}
    assert "reserve_pay.blocked" in kinds
    assert "agent.gate" in kinds
    assert "agent.executed" in kinds
    assert "razorpay.tool" in kinds

    # Every row is hash-chained to the one before it.
    for rec in records:
        assert rec["prev_hash"] and len(rec["hash"]) == 64
    genesis = "0" * 64
    assert records[0]["prev_hash"] == genesis
    for prev_rec, rec in zip(records, records[1:]):
        assert rec["prev_hash"] == prev_rec["hash"]

    # Tampering with any historical field must break the chain.
    tampered = dict(records[2])
    tampered["amount_inr"] = 1.0
    import hashlib, json as _json

    from app.audit import _canonical

    body = {k: v for k, v in tampered.items() if k not in ("seq", "prev_hash", "hash")}
    expected = hashlib.sha256((tampered["prev_hash"] + _canonical(body)).encode()).hexdigest()
    assert expected != tampered["hash"]

    # The mandate chain must be linked: intent -> cart -> payment
    intent = result["intent"]
    cart = result["cart"]
    payment = result["payment_mandate"]
    assert cart["credentialSubject"]["prev_mandate_id"] == intent["id"]
    assert payment["credentialSubject"]["prev_mandate_id"] == cart["id"]
    assert payment["credentialSubject"]["payment_id"] == result["capture_result"]["id"]


@pytest.mark.asyncio
async def test_reconciliation_matures_to_matched_at_capture():
    """Option B: an executed restock must yield a MATCHED reconciliation (money
    genuinely moved via the reserve-block debit) rather than a stale PENDING —
    even before any webhook, and regardless of execution_mode."""
    from app.services import reconciliation as reconciliation_store

    result = await run_agent(scenario="happy")
    assert result["status"] == "executed"

    decision_id = result["decision_id"]
    rec = reconciliation_store.get_by_decision(decision_id)
    assert rec is not None
    assert rec["state"] == "MATCHED"
    assert rec["actual_amount_inr"] == pytest.approx(
        (result.get("cart") or {}).get("credentialSubject", {}).get("total_inr")
    )
    assert rec["expected_amount_inr"] == pytest.approx(rec["actual_amount_inr"])
    assert "capture.confirmed" in rec["events"]
    assert rec["payment_id"] == result["capture_result"]["id"]
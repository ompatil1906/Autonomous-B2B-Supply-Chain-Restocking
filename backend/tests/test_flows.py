import asyncio
import os

import pytest

from app.agent.graph import run_agent
from app.audit import clear as clear_audit
from app.audit import read_all, verify_chain
from app.services import approvals as approvals_store
from app.services import reserve_pay, warehouse
from app.services.razorpay_mcp import RazorpayMcpClient

APPROVALS_FILE = "backend/data/approvals.json"


@pytest.fixture(autouse=True)
def clean_state():
    clear_audit()
    reserve_pay._blocks.clear()
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
    assert result["reserve_block"]["remaining_inr"] == pytest.approx(200.0)
    assert result["stock_after"]["SKU-404"] == 112  # 12 + 100
    assert verify_chain()["valid"] is True


@pytest.mark.asyncio
async def test_failure_path_graceful_escalation():
    result = await run_agent(scenario="failure")
    assert result["status"] == "blocked"
    assert result["gate"]["passed"] is False
    assert result["cart"]["credentialSubject"]["total_inr"] == 11000.0
    assert result["capture_result"] is None
    assert result["payment_link"]["amount"] == 1_100_000  # ₹11,000 in paise
    assert "exceeds my" in result["whatsapp_message"]["message"]
    assert "https://rzp.io/" in result["payment_link"]["short_url"]
    assert result["stock_after"]["SKU-404"] == 12  # untouched

    # The blocked purchase must be sitting in the merchant's approval inbox.
    esc_id = result["escalation_id"]
    assert esc_id and esc_id.startswith("appr_")
    pending = approvals_store.list_all()["pending"]
    assert any(p["id"] == esc_id for p in pending)
    row = next(p for p in pending if p["id"] == esc_id)
    assert row["over_by"] == 1000.0  # ₹11,000 vs ₹10,000 ceiling

    # Approving creates a fresh link (mock here) and resolves the escalation.
    link = await RazorpayMcpClient(force_mock=True).create_payment_link(
        11000.0, "Manual override", f"OVR-{row['quote_ref']}"
    )
    updated = approvals_store.approve(esc_id, link)
    assert updated["status"] == "approved"
    assert updated["resolved_link"]["short_url"] == link["short_url"]
    kinds = {r["kind"] for r in read_all()}
    assert "approval.requested" in kinds
    assert "approval.granted" in kinds


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
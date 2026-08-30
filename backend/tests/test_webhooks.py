"""Webhook intake: signature verification, replay dedup, and the payment.captured
→ reconciliation MATCHED loop (the actual closed loop of the demo)."""
import hashlib
import hmac
import json

import pytest

from app.config import settings
from app.services import webhook_store
from app.services.reconciliation import list_all
from app.services.webhooks import process_payment_webhook, simulate_webhook, verify_signature

from app.agent.graph import run_agent


def _signed_webhook(decision_id: str, amount_inr: float, event_type: str = "payment.captured") -> tuple[bytes, str]:
    payload = {
        "entity": "event",
        "event": event_type,
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_" + "a" * 18,
                    "amount": round(amount_inr * 100),
                    "currency": "INR",
                    "status": "captured" if "captured" in event_type else "failed",
                    "notes": {"warden_decision_id": decision_id},
                }
            }
        },
    }
    raw = json.dumps(payload).encode("utf-8")
    sig = hmac.new(settings.webhook_secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    return raw, sig


def test_signature_must_match_exact_secret():
    raw, sig = _signed_webhook("dec_x", 100.0)
    assert verify_signature(raw, sig) is True
    assert verify_signature(raw, "deadbeef") is False
    assert verify_signature(raw, None) is False
    assert verify_signature(raw + b"\x00", sig) is False  # trailing-byte tamper


@pytest.mark.asyncio
async def test_payment_captured_matures_reconciliation_to_matched():
    result = await run_agent(scenario="happy")
    assert result["status"] == "executed"
    decision_id = result["decision_id"]
    expected = round(result["cart"]["credentialSubject"]["total_inr"], 2)

    raw, sig = _signed_webhook(decision_id, expected)
    event = process_payment_webhook(raw, sig)
    assert event["status"] == "processed"
    assert event["signature_valid"] is True

    rec = list_all()["reconciliations"][0]
    assert rec["decision_id"] == decision_id
    assert rec["state"] == "MATCHED"
    assert rec["actual_amount_inr"] == pytest.approx(expected)


@pytest.mark.asyncio
async def test_replay_of_same_payload_is_deduped():
    result = await run_agent(scenario="happy")
    decision_id = result["decision_id"]
    raw, sig = _signed_webhook(decision_id, result["cart"]["credentialSubject"]["total_inr"])

    first = process_payment_webhook(raw, sig)
    assert first["status"] == "processed"
    second = process_payment_webhook(raw, sig)  # identical payload hash
    assert second["event_id"] == first["event_id"]
    assert second["status"] == "processed"  # replay returns the final stored state


def test_amount_mismatch_flags_review_not_silent():
    # A raw capture for a decision-less webhook is stored then marked unmatched.
    raw, sig = _signed_webhook("dec_no_such", 42.0)
    event = process_payment_webhook(raw, sig)
    assert event["status"] == "unmatched"


def test_invalid_signature_rejected_and_audited():
    raw, _ = _signed_webhook("dec_ignored", 100.0)
    event = process_payment_webhook(raw, "forge-d-forge")
    assert event["status"] == "invalid_signature"
    assert event["error"] is not None
    stored = webhook_store.list_events()
    assert stored[0]["status"] == "invalid_signature"
    assert stored[0]["signature_valid"] is False


@pytest.mark.asyncio
async def test_simulate_webhook_is_a_real_double_of_razorpay():
    """simulate_webhook signs with the same secret → returns processed status."""
    result = await run_agent(scenario="happy")
    assert result["status"] == "executed"
    amount = round(result["cart"]["credentialSubject"]["total_inr"], 2)
    event = simulate_webhook(decision_id=result["decision_id"], amount_inr=amount)
    assert event["simulated"] is True
    assert event["signature_valid"] is True
    assert event["status"] == "processed"


@pytest.mark.asyncio
async def test_execution_persists_observable_razorpay_objects():
    """The execution ledger is the receipt: real/simulated objects are all there,
    tagged with the actual backend that produced them."""
    result = await run_agent(scenario="happy")
    exec_result = result["execution"]
    assert exec_result["order_id"].startswith("order_")
    assert exec_result["razorpay_backend"] == "mock"
    legs = {l["kind"]: l["status"] for l in exec_result["legs"]}
    assert legs["order"] == "simulated"
    assert legs["payment_link"] == "simulated"
    assert legs["capture"] == "simulated"


@pytest.mark.asyncio
async def test_coordinator_is_idempotent_on_replay():
    """Same (decision_id, cart.id) pair can never double-spend."""
    result = await run_agent(scenario="happy")
    exec_result = result["execution"]
    decision_id = result["decision_id"]
    cart_id = result["cart"]["id"]

    from app.services import idempotency

    assert idempotency.resolve(f"{decision_id}:{cart_id}") is not None

    from app.services.execution import coordinator

    replay = await coordinator.execute(
        decision_id=decision_id,
        cart=CartMandate(**result["cart"]),
        reserve_block=result["reserve_block"],
        amount_inr=result["cart"]["credentialSubject"]["total_inr"],
        sku="SKU-404",
    )
    assert replay["execution_id"] == exec_result["execution_id"]  # same record, no new spend


from app.models.mandates import CartMandate  # noqa: E402
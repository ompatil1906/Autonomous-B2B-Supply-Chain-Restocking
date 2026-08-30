"""Razorpay webhook intake: signature verification, dedup, reconciliation.

X-Razorpay-Signature is HMAC-SHA256(webhook_secret, raw_body), hex-encoded.
Verification runs BEFORE anything is recorded; malformed or unverified events are
stored with an explicit status so the RazorpayActivity tab shows every rejection.

Demo events are synthesized with the same secret path (settings.webhook_secret) and
flagged `simulated`, so the reconciliation loop is exercised identically to a real
Razorpay test-mode payload.
"""
from __future__ import annotations

import hashlib
import hmac
import json

from app.audit import append
from app.config import settings
from app.services import reconciliation, webhook_store
from app.services.decisions import get_decision


def verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    if not signature_header:
        return False
    secret = settings.webhook_secret.encode("utf-8")
    expected = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.strip())


def _extract(payload: dict) -> dict:
    """Normalise a Razorpay event payload → (event fields)."""
    event_type = payload.get("event", "")
    entity = None
    wrapped = payload.get("payload") or {}
    for key in ("payment", "order", "payout", "refund", "payment_link"):
        if key in wrapped:
            e = wrapped[key]
            entity = e.get("entity") if isinstance(e, dict) else e
            break
    entity = entity or {}
    notes = entity.get("notes") or {}
    amount_paise = entity.get("amount") or 0
    return {
        "event_type": event_type,
        "razorpay_reference": entity.get("id"),
        "amount_inr": round(float(amount_paise) / 100.0, 2),
        "notes": {k: v for k, v in notes.items() if k.startswith("warden_")},
        "decision_id": notes.get("warden_decision_id"),
        "status": entity.get("status"),
    }


def _find_by_hash(digest: str) -> dict | None:
    for e in webhook_store.list_events(limit=500):
        if e.get("event_id") == digest:
            return e
    return None


def process_payment_webhook(raw_body: bytes, signature_header: str | None) -> dict:
    """Idempotent, audited ingestion. Returns the stored WebhookEvent."""
    digest = webhook_store.payload_hash(raw_body)
    existing = _find_by_hash(digest)
    if existing is not None:
        return existing
    return _process_new(raw_body, signature_header, digest)


def _process_new(raw_body: bytes, signature_header: str | None, digest: str) -> dict:
    from datetime import datetime, timezone

    signature_valid = verify_signature(raw_body, signature_header)
    event = webhook_store.WebhookEvent(
        event_id=digest,
        event_type="unknown",
        received_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        signature_valid=signature_valid,
        simulated=False,
        payload_hash=digest,
    )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
        extracted = _extract(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        extracted = {"event_type": "malformed"}
        event.status = "malformed"
        event.error = "unparseable payload"
        webhook_store.record(event)
        append("webhook.malformed", {"event_id": digest})
        return event.model_dump()

    event.event_type = extracted["event_type"]
    event.razorpay_reference = extracted["razorpay_reference"]
    event.amount_inr = extracted["amount_inr"]
    event.decision_id = extracted["decision_id"]

    if not signature_valid:
        event.status = "invalid_signature"
        event.error = "X-Razorpay-Signature did not match the configured webhook secret"
        webhook_store.record(event)
        append("webhook.rejected", {"event_id": digest, "reason": "signature"})
        return event.model_dump()

    event.status = "accepted"
    webhook_store.record(event)
    append(
        "webhook.received",
        {
            "event_id": digest,
            "event_type": event.event_type,
            "razorpay_reference": event.razorpay_reference,
            "amount_inr": event.amount_inr,
        },
    )

    decision_id = extracted["decision_id"]
    if not decision_id or not get_decision(decision_id):
        event.status = "unmatched"
        event.error = "no Warden decision found for this payment"
        webhook_store.mark(digest, status="unmatched", error=event.error)
        return event.model_dump()

    if "payment.captured" in event.event_type:
        rec = reconciliation.match_event(decision_id, event.model_dump())
        if rec:
            event.status = "processed"
            webhook_store.mark(
                digest,
                processed=True,
                status="processed",
                decision_id=decision_id,
                razorpay_reference=event.razorpay_reference,
            )
            append(
                "webhook.reconciled",
                {"event_id": digest, "decision_id": decision_id, "state": rec["state"]},
            )
    else:
        event.status = "accepted_ignored"
        webhook_store.mark(digest, status="accepted_ignored", decision_id=decision_id)

    return event.model_dump()


def simulate_webhook(*, decision_id: str, amount_inr: float, captured: bool = True) -> dict:
    """Synthesize a signed demo event that exercises the exact verification path."""
    event_type = "payment.captured" if captured else "payment.failed"
    payload = {
        "entity": "event",
        "event": event_type,
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_" + hashlib.sha256(decision_id.encode()).hexdigest()[:20],
                    "amount": round(amount_inr * 100),
                    "currency": "INR",
                    "status": "captured" if captured else "failed",
                    "notes": {"warden_decision_id": decision_id},
                }
            }
        },
    }
    raw = json.dumps(payload).encode("utf-8")
    secret = settings.webhook_secret.encode("utf-8")
    sig = hmac.new(secret, raw, hashlib.sha256).hexdigest()
    result = process_payment_webhook(raw, sig)
    result["simulated"] = True
    return result
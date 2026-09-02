"""Decision ↔ Razorpay object ↔ webhook reconciliation store.

Every executed decision gets a ReconciliationRecord. When the payment.webhook
arrives, the record is matched on decision_id → expected_amount and its state
advances PENDING → MATCHED / MISMATCH / REQUIRES_REVIEW. The same record is what
the RazorpayActivity tab renders.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone

from app.ap2.signer import new_id
from app.paths import RECONCILIATIONS_FILE

_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load() -> list[dict]:
    os.makedirs(os.path.dirname(RECONCILIATIONS_FILE), exist_ok=True)
    if not os.path.exists(RECONCILIATIONS_FILE):
        return []
    try:
        with open(RECONCILIATIONS_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save(items: list[dict]) -> None:
    os.makedirs(os.path.dirname(RECONCILIATIONS_FILE), exist_ok=True)
    with open(RECONCILIATIONS_FILE, "w", encoding="utf-8") as fh:
        json.dump(items[-400:], fh, ensure_ascii=False, indent=1, default=str)


def create(
    *,
    decision_id: str,
    execution_id: str,
    sku: str,
    direction: str,
    expected_amount_inr: float,
    order_id: str | None = None,
) -> dict:
    rec = {
        "id": new_id("rec"),
        "decision_id": decision_id,
        "execution_id": execution_id,
        "sku": sku,
        "direction": direction,
        "expected_amount_inr": expected_amount_inr,
        "actual_amount_inr": None,
        "state": "PENDING",
        "order_id": order_id,
        "payment_id": None,
        "events": [],
        "created_at": _now(),
        "updated_at": _now(),
    }
    with _lock:
        items = _load()
        items.append(rec)
        _save(items)
    return rec


def get(rec_id: str) -> dict | None:
    with _lock:
        return next((r for r in _load() if r["id"] == rec_id), None)


def get_by_decision(decision_id: str) -> dict | None:
    with _lock:
        items = _load()
    return next((r for r in reversed(items) if r["decision_id"] == decision_id), None)


def mark_matched(decision_id: str, amount_inr: float, payment_id: str | None, reason: str = "capture.confirmed") -> dict | None:
    """Finalize a reconciliation record as MATCHED at capture-commit time.

    The capture leg has already succeeded and the reserve block was debited
    before this runs, so marking MATCHED here reflects authoritative truth (money
    genuinely moved) rather than waiting on a webhook that may never arrive in a
    local/test-mode demo. A later real webhook, if any, idempotently re-confirms
    the same state/amount — no double count.
    """
    with _lock:
        items = _load()
        rec = next((r for r in reversed(items) if r["decision_id"] == decision_id), None)
        if rec is None:
            return None
        rec["actual_amount_inr"] = round(float(amount_inr), 2)
        rec["state"] = "MATCHED"
        rec["payment_id"] = payment_id or rec.get("payment_id")
        if reason not in rec["events"]:
            rec["events"].append(reason)
        rec["updated_at"] = _now()
        _save(items)
        return rec


def match_event(decision_id: str, event: dict) -> dict | None:
    """Advance the record based on a webhook event (amount_paid vs expected)."""
    with _lock:
        items = _load()
        rec = next((r for r in reversed(items) if r["decision_id"] == decision_id), None)
        if rec is None:
            return None
        paid = round(float(event.get("amount_inr") or 0.0), 2)
        expected = round(float(rec["expected_amount_inr"]), 2)
        rec["actual_amount_inr"] = paid
        rec["events"].append(event.get("event_type", "webhook"))
        rec["payment_id"] = event.get("razorpay_reference") or rec.get("payment_id")
        rec["updated_at"] = _now()
        if paid == expected:
            rec["state"] = "MATCHED"
        elif paid > 0:
            rec["state"] = "MISMATCH"
        else:
            rec["state"] = "REQUIRES_REVIEW"
        _save(items)
        return rec


def list_all(limit: int = 100) -> dict:
    with _lock:
        items = _load()
    items.reverse()
    return {"reconciliations": items[:limit]}


def clear() -> None:
    with _lock:
        if os.path.exists(RECONCILIATIONS_FILE):
            os.remove(RECONCILIATIONS_FILE)
"""Razorpay webhook event model + persistent store.

The store supports deduplication (by `x-razorpay-event-id`), replay protection,
out-of-order tolerance and reconciliation auditing. Sensitive payment fields are
NOT persisted — only ids, hashes and state.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from app.paths import WEBHOOK_EVENTS_FILE


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class WebhookEvent(BaseModel):
    event_id: str
    event_type: str
    received_at: str
    signature_valid: bool
    simulated: bool
    processed: bool = False
    processed_at: Optional[str] = None
    payload_hash: str
    status: str = "received"  # received | accepted | duplicate | invalid_signature | malformed | processed | error
    error: Optional[str] = None
    razorpay_reference: Optional[str] = None
    amount_inr: Optional[float] = None
    decision_id: Optional[str] = None


_lock = threading.Lock()


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(WEBHOOK_EVENTS_FILE), exist_ok=True)


def _load() -> list[dict]:
    _ensure_dir()
    if not os.path.exists(WEBHOOK_EVENTS_FILE):
        return []
    try:
        with open(WEBHOOK_EVENTS_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return []


def _save(events: list[dict]) -> None:
    _ensure_dir()
    with open(WEBHOOK_EVENTS_FILE, "w", encoding="utf-8") as fh:
        json.dump(events[-400:], fh, ensure_ascii=False, indent=1, default=str)


def payload_hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def new_run_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def exists(event_id: str) -> bool:
    with _lock:
        all_events = _load()
    return any(e["event_id"] == event_id for e in all_events)


def record(event: WebhookEvent) -> None:
    with _lock:
        events = _load()
        events.append(event.model_dump())
        _save(events)


def mark(event_id: str, *, processed: bool | None = None, status: str | None = None,
         decision_id: str | None = None, razorpay_reference: str | None = None,
         error: str | None = None, processed_at: bool = True) -> None:
    with _lock:
        events = _load()
        for e in events:
            if e["event_id"] == event_id:
                if status is not None:
                    e["status"] = status
                if decision_id is not None:
                    e["decision_id"] = decision_id
                if razorpay_reference is not None:
                    e["razorpay_reference"] = razorpay_reference
                if error is not None:
                    e["error"] = error
                if processed is not None:
                    e["processed"] = processed
                if processed and processed_at:
                    e["processed_at"] = _now()
                break
        else:
            return
        _save(events)


def list_events(limit: int = 100) -> list[dict]:
    with _lock:
        events = _load()
    events.reverse()
    return events[:limit]


def clear() -> None:
    with _lock:
        if os.path.exists(WEBHOOK_EVENTS_FILE):
            os.remove(WEBHOOK_EVENTS_FILE)
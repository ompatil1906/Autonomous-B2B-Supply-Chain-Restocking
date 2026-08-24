"""Persistent escalation inbox.

When the gate blocks a purchase, the agent registers a pending approval here.
The merchant approves or rejects it from the dashboard; approving creates the
Razorpay payment link live (wired in main.py) and lands `approval.granted` in
the hash-chained ledger. State persists across restarts via a JSON file so the
demo never "resets on refresh".
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone

from app.audit import append
from app.paths import APPROVALS_FILE

_lock = threading.Lock()


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(APPROVALS_FILE), exist_ok=True)


def _load() -> list[dict]:
    _ensure_dir()
    if not os.path.exists(APPROVALS_FILE):
        return []
    try:
        with open(APPROVALS_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return []


def _save(items: list[dict]) -> None:
    _ensure_dir()
    with open(APPROVALS_FILE, "w", encoding="utf-8") as fh:
        json.dump(items, fh, ensure_ascii=False, indent=1, default=str)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def register(
    sku: str,
    quantity: int,
    total_inr: float,
    ceiling_inr: float,
    cart_mandate: dict,
    quote_ref: str,
    reason: str,
    payment_link: dict | None = None,
) -> dict:
    """Record a blocked purchase awaiting human approval."""
    rec = {
        "id": f"appr_{uuid.uuid4().hex[:10]}",
        "status": "pending",
        "sku": sku,
        "quantity": quantity,
        "total_inr": total_inr,
        "ceiling_inr": ceiling_inr,
        "over_by": round(total_inr - ceiling_inr, 2),
        "quote_ref": quote_ref,
        "reason": reason,
        "cart_mandate": cart_mandate,
        "payment_link": payment_link,
        "created_at": _now(),
        "resolved_at": None,
        "resolved_link": None,
    }
    with _lock:
        items = _load()
        items.append(rec)
        _save(items)
    append(
        "approval.requested",
        {
            "approval_id": rec["id"],
            "sku": sku,
            "quantity": quantity,
            "total_inr": total_inr,
            "over_by": rec["over_by"],
            "reason": reason,
        },
    )
    return rec


def get(approval_id: str) -> dict | None:
    with _lock:
        for rec in _load():
            if rec["id"] == approval_id:
                return rec
    return None


def approve(approval_id: str, payment_link: dict, reused: bool = False) -> dict:
    with _lock:
        items = _load()
        rec = next((r for r in items if r["id"] == approval_id), None)
        if rec is None:
            raise KeyError(f"Unknown approval {approval_id}")
        if rec["status"] != "pending":
            raise ValueError(f"Approval {approval_id} is already {rec['status']}")
        rec["status"] = "approved"
        rec["resolved_at"] = _now()
        rec["resolved_link"] = payment_link
        rec["link_reused"] = reused
        _save(items)
    append(
        "approval.granted",
        {
            "approval_id": approval_id,
            "sku": rec["sku"],
            "total_inr": rec["total_inr"],
            "payment_link_id": payment_link.get("id"),
            "short_url": payment_link.get("short_url"),
            "link_reused": reused,
        },
    )
    return rec


def reject(approval_id: str, note: str = "") -> dict:
    with _lock:
        items = _load()
        rec = next((r for r in items if r["id"] == approval_id), None)
        if rec is None:
            raise KeyError(f"Unknown approval {approval_id}")
        if rec["status"] != "pending":
            raise ValueError(f"Approval {approval_id} is already {rec['status']}")
        rec["status"] = "rejected"
        rec["resolved_at"] = _now()
        if note:
            rec["reject_note"] = note
        _save(items)
    append(
        "approval.rejected",
        {"approval_id": approval_id, "sku": rec["sku"], "total_inr": rec["total_inr"], "note": note},
    )
    return rec


def list_all() -> dict:
    with _lock:
        items = _load()
    pending = [r for r in items if r["status"] == "pending"]
    resolved = [r for r in items if r["status"] != "pending"]
    # newest first in both lists
    pending.reverse()
    resolved.reverse()
    return {"pending": pending, "resolved": resolved}

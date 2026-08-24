"""Simulated UPI Reserve Pay.

In production, NPCI Reserve Pay blocks funds against a single PIN entry and lets an
agent debit multiple times with no further authentication. Razorpay's sandbox does not
expose Reserve Pay, so we model the 'block' as an authorised Razorpay payment that can
be captured via the `capture_payment` MCP tool.

If RAZORPAY_AUTHORIZED_PAYMENT_ID is set (real sandbox), capture will be attempted against
that real authorised payment. Otherwise a synthetic authorised payment is produced.
"""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone

from app.config import settings
from app.audit import append


class ReserveBlock:
    def __init__(self, block_id: str, reserved_inr: float, mandate_id: str):
        self.block_id = block_id
        self.reserved_inr = reserved_inr
        self.remaining_inr = reserved_inr
        self.mandate_id = mandate_id
        self.created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.debits: list[dict] = []


_lock = threading.Lock()
_blocks: dict[str, ReserveBlock] = {}
_daily_block_id: str | None = None


def create_block(reserved_inr: float, mandate_id: str, agent_purpose: str = "Inventory AI") -> ReserveBlock:
    with _lock:
        block = ReserveBlock(f"rbp_{uuid.uuid4().hex[:12]}", reserved_inr, mandate_id)
        _blocks[block.block_id] = block
        append(
            "reserve_pay.blocked",
            {
                "block_id": block.block_id,
                "reserved_inr": reserved_inr,
                "agent_purpose": agent_purpose,
                "intent_mandate_id": mandate_id,
                "simulated": settings.razorpay_mode != "remote",
            },
        )
        return block


def get_or_create_daily_block(ceiling_inr: float) -> ReserveBlock:
    """One UPI Reserve Pay block per day, shared by every autonomous restock.

    In production NPCI Reserve Pay blocks once and the agent debits repeatedly —
    modeling it as a single portfolio-level pool (instead of a block per run)
    is both more faithful and what makes the DAILY ceiling enforceable.
    """
    global _daily_block_id
    with _lock:
        if _daily_block_id and _daily_block_id in _blocks:
            return _blocks[_daily_block_id]
        from datetime import date

        block = ReserveBlock(
            f"rbp_daily_{date.today().isoformat()}", ceiling_inr, "DAILY-PORTFOLIO-CAP"
        )
        _blocks[block.block_id] = block
        _daily_block_id = block.block_id
        append(
            "reserve_pay.blocked",
            {
                "block_id": block.block_id,
                "reserved_inr": ceiling_inr,
                "agent_purpose": "Portfolio daily cap (all SKUs)",
                "intent_mandate_id": "DAILY-PORTFOLIO-CAP",
                "simulated": settings.razorpay_mode != "remote",
            },
        )
        return block


def daily_summary() -> dict:
    """DailyBudget for the wire; zeroed shape before any run today."""
    with _lock:
        b = _blocks.get(_daily_block_id) if _daily_block_id else None
        if b is None:
            return {
                "block_id": None,
                "ceilingRupees": settings.ap2_daily_ceiling_inr,
                "spentRupees": 0.0,
            }
        return {
            "block_id": b.block_id,
            "ceilingRupees": round(b.reserved_inr, 2),
            "spentRupees": round(b.reserved_inr - b.remaining_inr, 2),
        }


def get_block(block_id: str) -> ReserveBlock | None:
    return _blocks.get(block_id)


def synthetic_authorized_payment(block: ReserveBlock, amount_inr: float) -> dict:
    """Produce a Razorpay-shaped 'authorised' payment that capture_payment can debit."""
    import hashlib

    pay_id = "pay_" + hashlib.sha256(f"{block.block_id}:{amount_inr}".encode()).hexdigest()[:22]
    return {
        "id": pay_id,
        "entity": "payment",
        "amount": round(amount_inr * 100),
        "currency": "INR",
        "status": "authorized",
        "method": "upi",
        "description": "AP2 autonomous restock (UPI Reserve Pay block)",
        "notes": {"reserve_pay_block_id": block.block_id, "mandate_id": block.mandate_id},
    }


def debit(block: ReserveBlock, amount_inr: float, payment: dict) -> ReserveBlock:
    with _lock:
        if amount_inr > block.remaining_inr + 1e-6:
            raise ValueError(
                f"Debit ₹{amount_inr:,.2f} exceeds reserve balance ₹{block.remaining_inr:,.2f}"
            )
        payment_id = (
            payment.get("id")
            or f"unattributed_{uuid.uuid4().hex[:10]}"
        )
        block.remaining_inr = round(block.remaining_inr - amount_inr, 2)
        block.debits.append(
            {
                "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "amount_inr": amount_inr,
                "payment_id": payment_id,
            }
        )
        append(
            "reserve_pay.debit",
            {
                "block_id": block.block_id,
                "amount_inr": amount_inr,
                "remaining_inr": block.remaining_inr,
                "payment_id": payment_id,
            },
        )
        return block


def active_blocks() -> list[ReserveBlock]:
    return list(_blocks.values())


def to_dict(block: ReserveBlock) -> dict:
    return {
        "block_id": block.block_id,
        "reserved_inr": block.reserved_inr,
        "remaining_inr": block.remaining_inr,
        "created_at": block.created_at,
        "mandate_id": block.mandate_id,
        "debits": block.debits,
    }
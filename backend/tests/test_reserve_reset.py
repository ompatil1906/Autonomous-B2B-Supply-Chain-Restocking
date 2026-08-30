"""Operator-initiated Reserve Pay reset — a fully-funded block must replace the
spent one without rewriting history, and the audit journal must record it."""
import asyncio
import os

import pytest

from app.audit import clear as clear_audit
from app.audit import read_all, verify_chain
from app.services import reserve_pay


@pytest.fixture(autouse=True)
def clean_state():
    clear_audit()
    reserve_pay._blocks.clear()
    reserve_pay._daily_block_id = None
    yield


def test_replenish_daily_block_after_spend():
    block = reserve_pay.get_or_create_daily_block(100_000.0)
    reserve_pay.debit(block, 9_800.0, {"id": "pay_before_reset"})
    assert reserve_pay.daily_summary()["spentRupees"] == pytest.approx(9_800.0)

    fresh = reserve_pay.replenish_daily_block(100_000.0)

    assert fresh.block_id != block.block_id
    assert fresh.remaining_inr == pytest.approx(100_000.0)
    assert reserve_pay.daily_summary()["spentRupees"] == pytest.approx(0.0)
    # the original block is untouched — history is never rewritten
    assert reserve_pay.get_block(block.block_id).remaining_inr == pytest.approx(90_200.0)
    assert verify_chain()["valid"] is True

    events = read_all()
    assert any(e["kind"] == "reserve_pay.reset" for e in events)
    reset = next(e for e in events if e["kind"] == "reserve_pay.reset")
    assert reset["previous_block_id"] == block.block_id
    assert reset["unspent_at_reset_inr"] == pytest.approx(90_200.0)
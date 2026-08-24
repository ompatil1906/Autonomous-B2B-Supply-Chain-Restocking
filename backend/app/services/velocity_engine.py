"""Predictive trigger engine — the intelligence that separates this from a
threshold-toy.

Per SKU we keep a sliding-window ring buffer of sale events and compute:

    units_per_minute = (window_qty / WINDOW_SECONDS) * 60
    predicted_seconds_to_stockout = stock / units_per_minute * 60   (∞ if upm == 0)

A SKU is `critical` when its PREDICTED time-to-stockout falls inside the agent's
lead time (TRIGGER_LEAD_TIME_SECONDS) — the trigger fires while there is still
enough runway for a full restock cycle to complete before zero. HARD_FLOOR_UNITS
remains as a pure safety net. Numeric classification lives here; lifecycle
overlay (triggered/restocking/escalated/cooldown/sold_out) lives in live_ops.
"""
from __future__ import annotations

import time
from collections import deque

WINDOW_SECONDS = 30.0
TRIGGER_LEAD_TIME_SECONDS = 90.0
HARD_FLOOR_UNITS = 3
# Short by design: duplicate-pipeline prevention comes from the one-task-per-SKU
# guard, not from this window. A long cooldown only widens the gap in which a
# fast-selling SKU can drain back to zero before the next trigger may fire.
COOLDOWN_SECONDS = 15.0


def units_per_minute(window_qty: float, window_seconds: float = WINDOW_SECONDS) -> float:
    return (window_qty / window_seconds) * 60.0


def predicted_seconds_to_stockout(stock: int, upm: float) -> float | None:
    """None ⇒ no measurable demand (∞)."""
    if stock <= 0:
        return 0.0
    if upm <= 0:
        return None
    return (stock / upm) * 60.0


def classify(stock: int, upm: float) -> str:
    """Numeric status band from demand alone: healthy | watch | critical."""
    p = predicted_seconds_to_stockout(stock, upm)
    if p is None or p > 3 * TRIGGER_LEAD_TIME_SECONDS:
        return "healthy"
    if p <= TRIGGER_LEAD_TIME_SECONDS:
        return "critical"
    return "watch"


class VelocityEngine:
    """Ring buffers of (ts, qty) per SKU + pure math over them."""

    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._events: dict[str, deque] = {}

    def record_sale(self, sku: str, qty: int, ts: float | None = None) -> None:
        buf = self._events.setdefault(sku, deque())
        buf.append((ts if ts is not None else self._clock(), qty))

    def _pruned(self, sku: str) -> list[tuple[float, int]]:
        now = self._clock()
        buf = self._events.get(sku)
        if not buf:
            return []
        while buf and now - buf[0][0] > WINDOW_SECONDS:
            buf.popleft()
        return list(buf)

    def snapshot(self, sku: str, stock: int) -> dict:
        """VelocitySnapshot dict for the wire."""
        events = self._pruned(sku)
        window_qty = sum(q for _, q in events)
        upm = round(units_per_minute(window_qty), 2)
        pred = predicted_seconds_to_stockout(stock, upm)
        pred = None if pred is None else round(pred, 1)
        return {
            "sku": sku,
            "unitsPerMinute": upm,
            "windowSeconds": WINDOW_SECONDS,
            "predictedSecondsToStockout": pred,
        }

    def should_trigger(self, sku: str, stock: int) -> tuple[bool, str]:
        """(fire?, reason) — reason only meaningful when fire is True.

        The floor includes stock == 0 on purpose: a SKU that hit zero outside an
        active pipeline (or during a cooldown) must still be rescuable — no
        product is ever allowed to stay sold out.
        """
        snap = self.snapshot(sku, stock)
        pred = snap["predictedSecondsToStockout"]
        by_velocity = pred is not None and pred <= TRIGGER_LEAD_TIME_SECONDS
        by_floor = stock <= HARD_FLOOR_UNITS
        if by_floor:
            return True, "hard_floor"
        if by_velocity:
            return True, "predictive_velocity"
        return False, ""

    def reset(self) -> None:
        self._events.clear()

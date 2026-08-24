"""Festival Mode — the demand-side simulator.

Simulates at the EVENT-SOURCE layer only: synthetic SaleEvents flow through the
exact same `record_sale` pipeline real traffic would use, so the velocity engine,
predictive triggers, mandate chain and ledger downstream are all real.

Three tuned drop products:
  * SKU-F1 — velocity ramps to 60/min: the predictive estimate crosses the 90s
    lead time while ~45% of stock remains → agent wins the race.
  * SKU-F2 — comfortable mid-seller → normal executed outcome.
  * SKU-F3 — a late 150/min spike outruns the staged (~35s) restock cycle → the
    shelf hits zero first (`sold_out`), then recovers when the purchase lands.

Ambient evergreen demand runs continuously so the shop floor is never dead.
"""
from __future__ import annotations

import asyncio
import random

from app.products import AMBIENT_LAMBDA, EVERGREEN_SKUS, FESTIVAL_SKUS, PRODUCTS, velocity_at

SIM_TICK_SECONDS = 1.0


class SalesSim:
    """Emits synthetic SaleEvents via `on_sale(sku, qty)`."""

    def __init__(self, on_sale, clock):
        self._on_sale = on_sale          # sync callback (sku, qty)
        self._clock = clock              # monotonic seconds
        self._tasks: list[asyncio.Task] = []
        self._drop_at: float | None = None
        self.festival_active = False
        self._carry: dict[str, float] = {}

    # ---- ambient evergreen demand (always on) ----
    async def _ambient_loop(self):
        while True:
            await asyncio.sleep(random.uniform(2.0, 4.0))
            for sku in EVERGREEN_SKUS:
                if random.random() < AMBIENT_LAMBDA.get(sku, 0.01) * 3.0:
                    self._on_sale(sku, random.choice([1, 1, 2]))

    # ---- festival drop ----
    async def _festival_loop(self, delay_s: float):
        try:
            self._drop_at = self._clock() + delay_s
            while self._clock() < self._drop_at:
                await asyncio.sleep(0.2)
            for sku in FESTIVAL_SKUS:  # launch moment
                self._carry[sku] = 0.0
            start = self._clock()
            while True:
                await asyncio.sleep(SIM_TICK_SECONDS)
                elapsed = self._clock() - start
                dt = SIM_TICK_SECONDS
                for sku in FESTIVAL_SKUS:
                    v = velocity_at(PRODUCTS[sku].curve, elapsed)
                    expected = (v / 60.0) * dt
                    self._carry[sku] += expected * random.uniform(0.8, 1.2)
                    n = int(self._carry[sku])
                    if n > 0:
                        self._carry[sku] -= n
                        self._on_sale(sku, n)
        except asyncio.CancelledError:
            return

    def start_ambient(self) -> None:
        if not any(t.get_name() == "ambient" for t in self._tasks if not t.done()):
            self._tasks.append(asyncio.create_task(self._ambient_loop(), name="ambient"))

    def start_festival(self, delay_s: float = 10.0) -> float:
        """Schedule the drop; returns epoch-ms launch time."""
        self.stop_festival()
        self.festival_active = True
        task = asyncio.create_task(self._festival_loop(delay_s), name="festival")
        self._tasks.append(task)
        return (self._clock() + delay_s)

    def stop_festival(self) -> None:
        self.festival_active = False
        for t in self._tasks:
            if t.get_name() == "festival" and not t.done():
                t.cancel()

    def drop_in_seconds(self) -> float | None:
        return None if self._drop_at is None else max(0.0, self._drop_at - self._clock())

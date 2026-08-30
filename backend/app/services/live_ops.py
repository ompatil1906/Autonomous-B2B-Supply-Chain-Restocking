"""Live Ops orchestrator — wires demand to autonomous supply in real time.

Owns:
  * the VelocityEngine (sliding-window demand math per SKU)
  * the lifecycle state machine (healthy/watch/critical → triggered →
    restocking → executed | escalated | sold_out → cooldown)
  * hysteresis: one active pipeline per SKU + a cooldown window after completion,
    so a fast-selling SKU can never spam duplicate triggers
  * portfolio budget accounting: pending cart costs are RESERVED at trigger time
    so two concurrent restocks cannot jointly slip past the daily ceiling

Every agent run still flows through the full IntentMandate → CartMandate →
gate → PaymentMandate chain and lands in the hash-chained ledger.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from collections import deque

from app.agent.graph import run_agent
from app.config import settings
from app.products import (
    EVERGREEN_SKUS,
    FESTIVAL_SKUS,
    PRODUCTS,
    est_cart_cost,
    limits_for,
)
from app.services import approvals, reserve_pay, warehouse
from app.services.revenue_risk import AGENT_LEAD_WINDOW_S
from app.services.sales_sim import SalesSim
from app.services.velocity_engine import (
    COOLDOWN_SECONDS,
    TRIGGER_LEAD_TIME_SECONDS,
    VelocityEngine,
)

TICK_SECONDS = 0.5
TICKER_WINDOW_S = 10.0
FIVEMIN_WINDOW_S = 300.0

_STEP_INDEX = {
    "pre_compute": 1,
    "detect": 2,
    "calculate_risk": 3,
    "evaluate_economics": 4,
    "search_supplier": 5,
    "negotiate": 6,
    "gate": 7,
    "execute": 8,
    "do_not_buy": 8,
    "escalate": 8,
    "reconcile": 9,
    "measure": 10,
    "learn": 11,
    "finish": 12,
}


class LiveOps:
    def __init__(self, broadcast, clock=time.monotonic):
        self._broadcast = broadcast          # async (payload: dict) -> None
        self._clock = clock                  # monotonic seconds
        self.engine = VelocityEngine(clock)
        self.sim = SalesSim(self._ingest_sale, clock)
        self.launched_at_ms: dict[str, float] = {}
        self.triggers: list[dict] = []       # newest first
        self._tasks: dict[str, asyncio.Task] = {}
        self._cooldown_until: dict[str, float] = {}
        self._escalation_id_by_sku: dict[str, str] = {}
        self._pending_cost: dict[str, float] = {}   # reservation per in-flight SKU
        self._sales_log: deque[tuple[float, int]] = deque()  # (monotonic_ts, qty)
        self._bg_tasks: list[asyncio.Task] = []
        self.festival_drop_at_ms: float | None = None
        self.started = False

    # ------------------------------------------------------------------ sales
    def _ingest_sale(self, sku: str, qty: int) -> None:
        if sku not in PRODUCTS or qty <= 0:
            return
        stock, hit_zero = warehouse.record_sale(sku, qty)
        self.engine.record_sale(sku, qty)
        self._sales_log.append((self._clock(), qty))
        # trim logs lazily
        cutoff = self._clock() - FIVEMIN_WINDOW_S
        while self._sales_log and self._sales_log[0][0] < cutoff:
            self._sales_log.popleft()
        # fire-and-forget broadcast from sync context
        asyncio.get_running_loop().create_task(
            self._broadcast({"type": "sale", "sku": sku, "qty": qty, "stockAfter": stock, "tsMs": self._wall_ms()})
        )
        if hit_zero:
            asyncio.get_running_loop().create_task(
                self._broadcast({"type": "sold_out", "sku": sku, "tsMs": self._wall_ms()})
            )

    def _ticker(self) -> dict:
        now = self._clock()
        units10 = sum(q for ts, q in self._sales_log if ts >= now - TICKER_WINDOW_S)
        units5m = sum(q for ts, q in self._sales_log if ts >= now - FIVEMIN_WINDOW_S)
        return {"unitsLast10s": units10, "unitsLast5m": units5m}

    # ------------------------------------------------------------- product view
    def visible_skus(self) -> list[str]:
        return EVERGREEN_SKUS + [s for s in FESTIVAL_SKUS if s in self.launched_at_ms]

    def _status_for(self, sku: str, snap: dict) -> str:
        stock = warehouse.stock_levels().get(sku, 0)
        if stock <= 0:
            return "sold_out"
        t = self._tasks.get(sku)
        if t is not None and not t.done():
            trg = self.trigger_for_sku(sku)
            return "escalated" if (trg and trg["outcome"] == "escalated") else (
                "triggered" if trg and trg["currentStep"] <= 1 else "restocking"
            )
        now = self._clock()
        if now < self._cooldown_until.get(sku, 0.0):
            return "cooldown"
        esc_id = self._escalation_id_by_sku.get(sku)
        if esc_id:
            rec = approvals.get(esc_id)
            if rec and rec["status"] == "pending":
                return "escalated"
        pred = snap["predictedSecondsToStockout"]
        if pred is None or pred > 3 * TRIGGER_LEAD_TIME_SECONDS:
            return "healthy"
        if pred <= TRIGGER_LEAD_TIME_SECONDS:
            return "critical"
        return "watch"

    def product_view(self, sku: str, snap: dict) -> dict:
        p = PRODUCTS[sku]
        s = warehouse.get(sku)
        total = p.launch_stock if p.festival else max(p.seed_stock, p.restock_qty)
        return {
            "sku": sku,
            "name": p.name,
            "glyph": p.glyph,
            "currentStock": s.stock if s else 0,
            "referenceStock": total,
            "reorderCeilingRupees": p.ceiling_inr,
            "maxUnitPriceRupees": p.max_unit_price_inr,
            "restockQty": p.restock_qty,
            "unitPriceRupees": p.price_inr,
            "status": self._status_for(sku, snap),
            "launchedAtMs": self.launched_at_ms.get(sku),
            "festival": p.festival,
        }

    def trigger_for_sku(self, sku: str) -> dict | None:
        for t in self.triggers:
            if t["sku"] == sku and t["outcome"] == "in_progress":
                return t
        return None

    # ------------------------------------------------------------------ ticking
    async def start(self) -> None:
        if self.started:
            return
        self.started = True
        self.sim.start_ambient()
        self._bg_tasks.append(asyncio.create_task(self._tick_loop()))

    async def _tick_loop(self):
        while True:
            try:
                await self._tick_once()
            except Exception:
                pass
            await asyncio.sleep(TICK_SECONDS)

    async def _tick_once(self):
        snaps = {sku: self.engine.snapshot(sku, warehouse.stock_levels().get(sku, 0)) for sku in self.visible_skus()}
        products = [self.product_view(sku, snaps[sku]) for sku in self.visible_skus()]

        # resolve escalations whose approval was handled in the inbox
        for sku, esc_id in list(self._escalation_id_by_sku.items()):
            rec = approvals.get(esc_id)
            if rec and rec["status"] != "pending" and sku not in self._tasks:
                del self._escalation_id_by_sku[sku]
                self._cooldown_until[sku] = self._clock() + COOLDOWN_SECONDS

        # predictive / hard-floor trigger evaluation with hysteresis.
        # Guards are explicit (live task, cooldown, pending human decision) —
        # deliberately NOT the status overlay, so a SKU that hit zero can still
        # be rescued by the floor. No product is ever left sold out.
        for sku in self.visible_skus():
            task = self._tasks.get(sku)
            if task is not None and not task.done():
                continue  # one pipeline per SKU — never double-fire while restocking
            if self._clock() < self._cooldown_until.get(sku, 0.0):
                continue
            esc_id = self._escalation_id_by_sku.get(sku)
            if esc_id:
                rec = approvals.get(esc_id)
                if rec and rec["status"] == "pending":
                    continue  # awaiting the merchant's yes/no on this SKU
            fire, reason = self.engine.should_trigger(sku, warehouse.stock_levels().get(sku, 0))
            if fire:
                self._fire_trigger(sku, reason)

        await self._broadcast({
            "type": "velocity",
            "snapshots": [snaps[s] for s in self.visible_skus()],
            "products": products,
            "ticker": self._ticker(),
            "budget": reserve_pay.daily_summary(),
            "tsMs": self._wall_ms(),
        })

    # ----------------------------------------------------------------- triggering
    def _fire_trigger(self, sku: str, reason: str) -> None:
        stock = warehouse.stock_levels().get(sku, 0)
        snap = self.engine.snapshot(sku, stock)
        trigger = {
            "id": f"trg_{uuid.uuid4().hex[:10]}",
            "sku": sku,
            "reason": reason,
            "triggeredAtMs": self._wall_ms(),
            "stockAtTrigger": stock,
            "velocityAtTrigger": snap["unitsPerMinute"],
            "predictedSecondsAtTrigger": snap["predictedSecondsToStockout"],
            "currentStep": 0,
            "outcome": "in_progress",
        }
        self.triggers.insert(0, trigger)
        del self.triggers[60:]
        # Reserve this cart's estimated cost NOW so concurrent pipelines are
        # judged against committed spend, not just settled spend.
        self._pending_cost[sku] = est_cart_cost(sku)
        task = asyncio.create_task(self._run_pipeline(trigger))
        self._tasks[sku] = task
        asyncio.get_running_loop().create_task(
            self._broadcast({"type": "trigger", "trigger": trigger})
        )

    def _portfolio_ctx(self, exclude_sku: str) -> dict:
        day = reserve_pay.daily_summary()
        reserved_others = sum(c for s, c in self._pending_cost.items() if s != exclude_sku)
        return {
            "spent": round(day["spentRupees"] + reserved_others, 2),
            "ceiling": settings.ap2_daily_ceiling_inr,
        }

    async def _run_pipeline(self, trigger: dict):
        sku = trigger["sku"]
        velocity = trigger.get("velocityAtTrigger") or 0.0
        stock_now = warehouse.stock_levels().get(sku, 0)
        async def on_update(node: str, data: dict) -> None:
            idx = _STEP_INDEX.get(node)
            payload: dict = {"type": "trigger_update", "trigger": trigger}
            if idx is not None:
                trigger["currentStep"] = idx
            if node == "gate" and data.get("gate"):
                payload["gate"] = data["gate"]
            await self._broadcast(payload)

        try:
            summary = await run_agent(
                sku=sku,
                scenario="happy",
                reset_inventory=False,
                limits=limits_for(sku),
                staged=True,
                velocity_units_per_min=velocity or max(stock_now * 60.0 / (AGENT_LEAD_WINDOW_S / 2.0), 0.1),
                portfolio=self._portfolio_ctx(exclude_sku=sku),
                trigger_reason=trigger["reason"],
                on_update=on_update,
            )
            blocked = summary["status"] == "blocked"
            trigger["outcome"] = "escalated" if blocked else "executed"
            trigger["amountInr"] = round((summary.get("cart", {}) or {}).get("credentialSubject", {}).get("total_inr", 0.0), 2)
            trigger["quantity"] = summary.get("quantity")
            trigger["orderId"] = summary.get("order_id")
            trigger["razorpayBackend"] = (summary.get("execution") or {}).get("razorpay_backend")
            trigger["supplierId"] = (summary.get("negotiation") or {}).get("supplier_id")
            trigger["supplierAction"] = (summary.get("negotiation") or {}).get("action")
            trigger["paymentId"] = (summary.get("capture_result") or {}).get("id")
            trigger["escalationId"] = summary.get("escalation_id")
            trigger["paymentLink"] = summary.get("payment_link")
            trigger["decisionId"] = summary.get("decision_id")
            trigger["revenueRisk"] = summary.get("revenue_risk")
            trigger["mandates"] = {
                "intent": summary.get("intent"),
                "cart": summary.get("cart"),
                "payment": summary.get("payment_mandate"),
            }
            trigger["gate"] = summary.get("gate")

            # Closed loop: simulation mode synthesizes the Razorpay webhook
            # through the same verification path so the trigger completes with a
            # MATCHED reconciliation record.
            decision_id = summary.get("decision_id")
            if summary.get("status") == "executed" and decision_id:
                from app.config import settings as _settings
                from app.services import webhooks as _wh

                amount = round((summary.get("execution") or {}).get("amount_inr") or 0.0, 2)
                if _settings.execution_mode != "remote_test" and amount > 0:
                    try:
                        _wh.simulate_webhook(decision_id=decision_id, amount_inr=amount)
                    except Exception:
                        pass
                from app.services import reconciliation as _rec

                summary["reconciliation"] = _rec.get_by_decision(decision_id)
                trigger["reconciliation"] = summary["reconciliation"]

            if blocked and summary.get("escalation_id"):
                self._escalation_id_by_sku[sku] = summary["escalation_id"]
            self._cooldown_until[sku] = self._clock() + COOLDOWN_SECONDS
        except Exception as exc:
            trigger["outcome"] = "failed"
            trigger["error"] = str(exc)[:300]
            self._cooldown_until[sku] = self._clock() + COOLDOWN_SECONDS
        finally:
            self._pending_cost.pop(sku, None)
            self._tasks.pop(sku, None)
            await self._broadcast({"type": "trigger_update", "trigger": trigger})

    # ----------------------------------------------------------------- festival
    async def start_festival(self, delay_s: float = 10.0) -> dict:
        drop_mono = self.sim.start_festival(delay_s)
        self.festival_drop_at_ms = (time.time() + max(0.0, drop_mono - self._clock())) * 1000
        launch_ms = self.festival_drop_at_ms
        # Products become visible exactly at the drop moment (_confirm_launch).
        asyncio.create_task(self._confirm_launch())
        await self._broadcast({
            "type": "festival_started",
            "dropAtMs": launch_ms,
            "skus": FESTIVAL_SKUS,
        })
        return {"dropAtMs": launch_ms, "skus": FESTIVAL_SKUS}

    async def _confirm_launch(self):
        """Flip launched flags exactly at drop time (visibility gate)."""
        delay = max(0.0, (self.festival_drop_at_ms / 1000.0) - time.time())
        await asyncio.sleep(delay)
        ms = time.time() * 1000
        for sku in FESTIVAL_SKUS:
            self.launched_at_ms[sku] = ms
        await self._broadcast({"type": "festival_launched", "skus": FESTIVAL_SKUS, "tsMs": ms})

    async def stop_festival(self) -> None:
        self.sim.stop_festival()
        self.festival_drop_at_ms = None
        await self._broadcast({"type": "festival_stopped"})

    def force_trigger(self, sku: str) -> dict | None:
        """Dev-panel probe: push any visible SKU through the same gated pipeline."""
        if sku not in self.visible_skus() or sku in self._tasks:
            return None
        fire, _ = self.engine.should_trigger(sku, warehouse.stock_levels().get(sku, 0))
        self._fire_trigger(sku, "manual_probe")
        return self.triggers[0]

    # ------------------------------------------------------------------ snapshot
    def snapshot_state(self) -> dict:
        skus = self.visible_skus()
        snaps = {s: self.engine.snapshot(s, warehouse.stock_levels().get(s, 0)) for s in skus}
        return {
            "products": [self.product_view(s, snaps[s]) for s in skus],
            "snapshots": [snaps[s] for s in skus],
            "triggers": self.triggers[:30],
            "budget": reserve_pay.daily_summary(),
            "ticker": self._ticker(),
            "festivalActive": self.sim.festival_active,
            "festivalDropInS": self.sim.drop_in_seconds(),
            "serverTimeMs": self._wall_ms(),
            "dailyCeilingRupees": settings.ap2_daily_ceiling_inr,
        }

    def _wall_ms(self) -> float:
        return time.time() * 1000


live_ops_singleton: LiveOps | None = None


def get_live_ops(broadcast=None) -> LiveOps:
    global live_ops_singleton
    if live_ops_singleton is None:
        live_ops_singleton = LiveOps(broadcast or (lambda payload: asyncio.sleep(0)))
    return live_ops_singleton

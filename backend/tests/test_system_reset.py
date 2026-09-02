"""Full system reset — the landing page wipes every runtime artifact so each
new visitor starts clean: no ledger, no decisions/approvals/reconciliations/
webhooks/executions/learning, reseeded warehouse, and a zero-spend reserve pool.

Exercised at the store layer (the same clear functions the endpoint drives),
so the assert is deterministic without spinning the ASGI lifespan/live loop.
"""
import os

import pytest

from app.audit import append as audit_append
from app.audit import clear as clear_audit
from app.audit import read_all
from app.services import (
    approvals as approvals_store,
    decisions,
    execution,
    idempotency,
    outcomes,
    reconciliation,
    reserve_pay,
    warehouse,
    webhook_store,
)
from app.paths import (
    APPROVALS_FILE,
    DECISIONS_FILE,
    EXECUTIONS_FILE,
    IDEMPOTENCY_FILE,
    LEARNED_FILE,
    RECONCILIATIONS_FILE,
    WEBHOOK_EVENTS_FILE,
)


def test_store_clears_empty_every_persisted_artifact():
    # Populate every store so the clears have something to wipe.
    audit_append("test.seed", {"x": 1})
    approvals_store.register("SKU-1", 10, 1000.0, 900.0, {}, "QT-X", "ceiling")
    decisions.record_decision({"action": "BUY", "sku": "SKU-1", "quantity": 10})
    reconciliation.create(
        decision_id="d1",
        execution_id="pay_seed",
        sku="SKU-1",
        direction="PURCHASE",
        expected_amount_inr=1000.0,
    )
    webhook_store.record(
        webhook_store.WebhookEvent(
            event_id="evt_seed",
            event_type="payment.captured",
            received_at="now",
            signature_valid=True,
            simulated=True,
            payload_hash="h",
            status="received",
            decision_id="d1",
        )
    )
    outcomes.update_learning({"negotiation": {"supplier_id": "S"}})
    with open(EXECUTIONS_FILE, "w", encoding="utf-8") as fh:
        fh.write("[]")
    idempotency.commit("seed_key", {"seen": True})

    # Sanity: state existed.
    assert os.path.exists(APPROVALS_FILE)
    assert os.path.exists(DECISIONS_FILE)
    assert os.path.exists(RECONCILIATIONS_FILE)
    assert os.path.exists(WEBHOOK_EVENTS_FILE)
    assert os.path.exists(EXECUTIONS_FILE)
    assert os.path.exists(IDEMPOTENCY_FILE)
    assert read_all() != []

    # Now run the same clears the /api/system/reset endpoint drives.
    clear_audit()
    approvals_store.clear()
    decisions.clear()
    reconciliation.clear()
    webhook_store.clear()
    execution.clear()
    outcomes.clear_learned()
    idempotency.clear()

    for f in (APPROVALS_FILE, DECISIONS_FILE, RECONCILIATIONS_FILE,
              WEBHOOK_EVENTS_FILE, EXECUTIONS_FILE, LEARNED_FILE, IDEMPOTENCY_FILE):
        assert not os.path.exists(f), f"{f} should be removed by reset"

    assert read_all() == []
    assert decisions.summary()["total_decisions"] == 0
    assert approvals_store.list_all() == {"pending": [], "resolved": []}
    assert reconciliation.list_all() == {"reconciliations": []}
    assert webhook_store.list_events() == []


def test_warehouse_and_reserve_reach_fresh_state_after_reset():
    warehouse.record_sale("SKU-F1", 1)  # disturb stock
    reserve_pay.get_or_create_daily_block(10_000.0)
    reserve_pay.debit(reserve_pay.get_or_create_daily_block(10_000.0), 1000.0, {"id": "p"})
    assert reserve_pay.daily_summary()["spentRupees"] == pytest.approx(1000.0)

    warehouse.reset()
    reserve_pay.reset_shared()

    assert reserve_pay.daily_summary()["spentRupees"] == pytest.approx(0.0)
    assert reserve_pay.daily_summary()["block_id"] is None
    from app.products import PRODUCTS
    for sku in PRODUCTS:
        assert warehouse.stock_levels()[sku] >= 0

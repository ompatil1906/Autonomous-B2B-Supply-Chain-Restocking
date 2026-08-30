"""Gate hardening: the deterministic boundary must reject every hostile input
that reaches it — even when the signatures themselves are valid.

These tests mutate/forge mandates and assert the exact failed check, so the
evidence produced for humans (and the audit log) is always specific.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.ap2.gate import evaluate_gate, verify_cart_signature, verify_intent_signature
from app.ap2.keys import get_role_did
from app.ap2.signer import (
    _MANDATE_TYPES,
    _sign,
    issue_cart_mandate,
    issue_intent_mandate,
    new_mandate_id,
    utcnow_iso,
)
from app.models.mandates import CartSubject, Constraint, IntentSubject
from app.services.identity import get_registry
from app.services.suppliers import SUPPLIERS

AD = get_registry().agent_did()
MD = get_registry().merchant_did()
SUP_A = SUPPLIERS["SUP-A"].did


def _valid_intent(**overrides) -> Intent:
    now = utcnow_iso()
    expiry = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(timespec="seconds")
    constraints = {
        "amount_min_inr": 0.0,
        "amount_max_inr": 10_000.0,
        "currency": "INR",
        "allowed_skus": ["SKU-404"],
        "max_quantity_per_sku": 100,
        "max_unit_price_inr": 100.0,
        "user_cart_confirmation_required": False,
        "supplier_dids": [SUP_A],
        "valid_until": expiry,
        "policy_version": "warden-policy-v1",
    }
    constraints.update(overrides.pop("constraints", {}))
    subject = {
        "mandate_id": new_mandate_id(),
        "prev_mandate_id": None,
        "prev_mandate_ids": [],
        "timestamp": now,
        "merchant_did": MD,
        "agent_did": AD,
        "purpose": "restock",
        "intent_note": "test intent",
        "constraints": constraints,
    }
    subject.update(overrides)
    mantra = IntentSubject(**subject)
    envelope = _sign(MD, "merchant", mantra.model_dump(), *_MANDATE_TYPES["intent"], expiry)
    from app.models.mandates import IntentMandate

    return IntentMandate.model_validate(envelope.model_dump())


def _valid_cart(prev_mandate_id: str, **overrides) -> Cart:
    expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(timespec="seconds")
    citation = overrides.pop("expirationDate", None)
    if citation:
        expiry = citation
    now = utcnow_iso()
    subject = {
        "mandate_id": new_mandate_id(),
        "prev_mandate_id": prev_mandate_id,
        "prev_mandate_ids": [prev_mandate_id],
        "timestamp": now,
        "merchant_did": SUP_A,  # the supplier
        "supplier_name": "Sundaram Spices",
        "items": [{"sku": "SKU-404", "name": "Cardamom", "quantity": 100, "unit_price_inr": 98.0, "line_total_inr": 9800.0}],
        "taxes_inr": 0.0,
        "shipping_inr": 0.0,
        "total_inr": 9800.0,
        "currency": "INR",
        "quote_ref": "Q-1",
    }
    subject.update(overrides)
    cs = CartSubject(**subject)
    envelope = _sign(SUP_A, "supplier_a", cs.model_dump(), *_MANDATE_TYPES["cart"], expiry)

    from app.models.mandates import CartMandate

    return CartMandate.model_validate(envelope.model_dump())


def _expired_iso() -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(timespec="seconds")


from app.models.mandates import (
    CartMandate as Cart,
    IntentMandate as Intent,
)


def _failed_names(verdict) -> set[str]:
    return {c["name"] for c in verdict.to_dict()["checks"] if not c["passed"]}


@pytest.mark.parametrize(
    "mutate, expected_fail",
    [
        (
            {"constraints": {"policy_version": "vanity-v0"}},
            {"policy_version"},
        ),  # foreign policy
        (
            {"constraints": {"valid_until": _expired_iso()}},
            {"intent_not_expired"},
        ),  # stale intent
        (
            {"constraints": {"allowed_skus": ["SKU-999"]}},
            {"skus_allowed"},
        ),  # SKU not in allow-list
        (
            {"constraints": {"max_quantity_per_sku": 50}},
            {"quantity_caps"},
        ),  # cap shrunk after signing
        (
            {"constraints": {"max_unit_price_inr": 80.0}},
            {"unit_price_caps"},
        ),  # price ceiling shrunk
        (
            {"constraints": {"supplier_dids": []}},
            {"supplier_allowed"},
        ),  # supplier struck from allow-list
    ],
)
def test_intent_boundary_changes_fail_pinpoint_checks(mutate, expected_fail):
    intent = _valid_intent(**mutate)
    assert _failed_names(evaluate_gate(intent, _valid_cart(intent.id))).issuperset(expected_fail)


@pytest.mark.parametrize(
    "mutate, expected_fail",
    [
        ({"expirationDate": _expired_iso()}, {"quote_not_expired"}),  # stale quote
        (
            {"total_inr": 10_001.0},
            {"total_within_limit"},
        ),  # cross the cart cap
        (
            {"items": [{"sku": "SKU-404", "name": "Cardamom", "quantity": 101, "unit_price_inr": 98.0, "line_total_inr": 9898.0}]},
            {"quantity_caps"},
        ),  # over max qty
        (
            {"items": [{"sku": "SKU-913", "name": "Cinnamon", "quantity": 10, "unit_price_inr": 98.0, "line_total_inr": 980.0}]},
            {"skus_allowed"},
        ),  # disallowed SKU sneaked in
        (
            {"items": [{"sku": "SKU-404", "name": "Cardamom", "quantity": 100, "unit_price_inr": 120.0, "line_total_inr": 12000.0}]},
            {"unit_price_caps", "cart_total_integrity"},
        ),  # gouged unit price > cap (also breaks total reconciliation)
        (
            {"items": [{"sku": "SKU-404", "name": "Cardamom", "quantity": 0, "unit_price_inr": 98.0, "line_total_inr": 0.0}]},
            {"quantity_caps"},
        ),  # zero quantity
        (
            {"items": [{"sku": "SKU-404", "name": "Cardamom", "quantity": 100, "unit_price_inr": 98.0, "line_total_inr": 9000.0}]},
            {"line_total_integrity"},
        ),  # line total != qty × price
        (
            {"total_inr": 9801.0},
            {"cart_total_integrity"},
        ),  # stub total mismatch
        (
            {"items": [{"sku": "SKU-404", "name": "Cardamom", "quantity": 100, "unit_price_inr": 98.0, "line_total_inr": 9800.0}], "currency": "USD"},
            {"currency_inr"},
        ),  # foreign currency
    ],
)
def test_cart_forgery_fail_pinpoint_checks(mutate, expected_fail):
    intent = _valid_intent()
    cart = _valid_cart(intent.id, **mutate)
    assert _failed_names(evaluate_gate(intent, cart)).issuperset(expected_fail)


def test_tampered_cart_body_breaks_signature_even_with_honest_headers():
    """Signature binds the WHOLE subject — rewriting amount while keeping the
    credit card moment is exactly what fails HMAC-style binding."""
    intent = _valid_intent()
    cart = _valid_cart(intent.id)
    tampered = cart.model_copy(update={"credentialSubject": cart.credentialSubject.model_copy(update={"total_inr": 99.0})})
    assert verify_cart_signature(tampered) is False
    assert "cart_signature" in _failed_names(evaluate_gate(intent, tampered))


def test_identity_shuffle_rejected_despite_valid_signature():
    """A mandate signed by the AGENT key (issuer = agent DID) verifies
    cryptographically but fails the merchant-identity binding."""
    now = utcnow_iso()
    expiry = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(timespec="seconds")
    subject = IntentSubject(
        mandate_id=new_mandate_id(),
        prev_mandate_id=None,
        prev_mandate_ids=[],
        timestamp=now,
        merchant_did=AD,  # impostor claims to BE the agent
        agent_did=AD,
        purpose="restock",
        intent_note="impostor",
        constraints=Constraint(
            amount_max_inr=10_000.0,
            allowed_skus=["SKU-404"],
            max_quantity_per_sku=100,
            max_unit_price_inr=100.0,
            supplier_dids=[SUP_A],
            valid_until=expiry,
        ),
    )
    envelope = _sign(AD, "agent", subject.model_dump(), *_MANDATE_TYPES["intent"], expiry)
    from app.models.mandates import IntentMandate

    impostor = IntentMandate.model_validate(envelope.model_dump())
    assert verify_intent_signature(impostor) is True  # cryptographically fine…
    assert "merchant_identity" in _failed_names(evaluate_gate(impostor, _valid_cart(impostor.id)))


def test_cart_from_unknown_supplier_rejected():
    """A cart 'from' a DID that is not in the registry's supplier set / intent
    allow-list — even with a valid cart signature — must be refused."""
    now = utcnow_iso()
    expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(timespec="seconds")
    subject = CartSubject(
        mandate_id=new_mandate_id(),
        prev_mandate_id=None,
        prev_mandate_ids=[],
        timestamp=now,
        merchant_did="did:ap2:rogue",
        supplier_name="Rogue Ltd",
        items=[{"sku": "SKU-404", "name": "Cardamom", "quantity": 10, "unit_price_inr": 98.0, "line_total_inr": 980.0}],
        taxes_inr=0.0,
        shipping_inr=0.0,
        total_inr=980.0,
        currency="INR",
        quote_ref="Q-rogue",
    )
    envelope = _sign("did:ap2:rogue", "supplier", subject.model_dump(), *_MANDATE_TYPES["cart"], expiry)
    from app.models.mandates import CartMandate

    rogue_cart = CartMandate.model_validate(envelope.model_dump())

    intent = _valid_intent()
    assert verify_cart_signature(rogue_cart) is False  # unregistered issuer → no bound key
    failed = _failed_names(evaluate_gate(intent, rogue_cart))
    assert "cart_signature" in failed
    assert "supplier_allowed" in failed


def test_ok_cart_passes_every_check():
    intent = _valid_intent()
    assert evaluate_gate(intent, _valid_cart(intent.id)).passed is True
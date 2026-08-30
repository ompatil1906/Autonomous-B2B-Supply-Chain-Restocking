"""Construct and sign AP2 mandates (W3C VC flavoured)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from app.ap2.hash import canonical_json
from app.ap2.keys import get_role_did, get_role_key
from app.models.mandates import (
    CartMandate,
    CartSubject,
    IntentMandate,
    IntentSubject,
    Mandate,
    PaymentMandate,
    PaymentSubject,
    Proof,
)

_MANDATE_TYPES = {
    "intent": ("AP2IntentMandate", "mandate.intent.1"),
    "cart": ("AP2CartMandate", "mandate.cart.1"),
    "payment": ("AP2PaymentMandate", "mandate.payment.1"),
}

POLICY_VERSION = "warden-policy-v1"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    """Stable prefixed identifiers (dec_..., exec_..., trn_...) for idempotency."""
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def new_mandate_id() -> str:
    return str(uuid.uuid4())


def _vc_id() -> str:
    return f"urn:uuid:{uuid.uuid4()}"


def _sign(issuer_did: str, role: str, subject: dict, vc_type: str, vct: str, expiry: str) -> Mandate:
    """Wrap a credential subject into a signed VC envelope."""
    import base58
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    key: Ed25519PrivateKey = get_role_key(role)
    digest = canonical_json(subject).encode("utf-8")
    signature = key.sign(digest)

    proof = Proof(
        created=utcnow_iso(),
        verificationMethod=f"{issuer_did}#{role}",
        proofValue=base58.b58encode(signature).decode(),
    )
    return Mandate(
        id=_vc_id(),
        type=["VerifiableCredential", vc_type],
        vct=vct,
        issuer=issuer_did,
        issuanceDate=utcnow_iso(),
        expirationDate=expiry,
        credentialSubject=subject,
        proof=proof,
    )


# key-file name that signs a CartMandate for each supplier role.
def _signing_role_for_supplier(supplier_did: str) -> str | None:
    from app.ap2.keys import keys, public_did as _pd

    for key_name, key in keys().items():
        if key_name in ("merchant", "agent", "supplier"):
            continue
        if _pd(key) == supplier_did:
            return key_name
    if _pd(keys()["supplier"]) == supplier_did:
        return "supplier"
    return None


def issue_intent_mandate(
    *,
    merchant_did: str,
    agent_did: str,
    purpose: str,
    intent_note: str,
    amount_max_inr: float,
    allowed_skus: list[str],
    max_quantity_per_sku: int,
    max_unit_price_inr: float,
    valid_for_hours: int,
    user_cart_confirmation_required: bool = False,
    supplier_dids: list[str] | None = None,
    prev_mandate_id: str | None = None,
) -> IntentMandate:
    now = utcnow_iso()
    expiry = (datetime.now(timezone.utc) + timedelta(hours=valid_for_hours)).isoformat(
        timespec="seconds"
    )
    subject = IntentSubject(
        mandate_id=new_mandate_id(),
        prev_mandate_id=prev_mandate_id,
        prev_mandate_ids=[prev_mandate_id] if prev_mandate_id else [],
        timestamp=now,
        merchant_did=merchant_did,
        agent_did=agent_did,
        purpose=purpose,
        intent_note=intent_note,
        constraints={
            "amount_min_inr": 0.0,
            "amount_max_inr": amount_max_inr,
            "currency": "INR",
            "allowed_skus": allowed_skus,
            "max_quantity_per_sku": max_quantity_per_sku,
            "max_unit_price_inr": max_unit_price_inr,
            "user_cart_confirmation_required": user_cart_confirmation_required,
            "supplier_dids": supplier_dids or [],
            "valid_until": expiry,
            "policy_version": POLICY_VERSION,
        },
    )
    envelope = _sign(merchant_did, "merchant", subject.model_dump(), *_MANDATE_TYPES["intent"], expiry)
    return IntentMandate.model_validate(envelope.model_dump())


def issue_cart_mandate(
    *,
    supplier_did: str,
    supplier_name: str,
    items: list[dict],
    taxes_inr: float,
    shipping_inr: float,
    total_inr: float,
    quote_ref: str,
    prev_mandate_id: str | None = None,
    signer_role: str | None = None,
) -> CartMandate:
    now = utcnow_iso()
    expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(timespec="seconds")
    subject = CartSubject(
        mandate_id=new_mandate_id(),
        prev_mandate_id=prev_mandate_id,
        prev_mandate_ids=[prev_mandate_id] if prev_mandate_id else [],
        timestamp=now,
        merchant_did=supplier_did,
        supplier_name=supplier_name,
        items=items,
        taxes_inr=taxes_inr,
        shipping_inr=shipping_inr,
        total_inr=total_inr,
        currency="INR",
        quote_ref=quote_ref,
    )
    role = signer_role or _signing_role_for_supplier(supplier_did) or "supplier"
    if public_did_of_role(role) != supplier_did:
        raise ValueError(
            f"CartMandate issuer {supplier_did} does not match the signing key {role!r} "
            f"({public_did_of_role(role)})"
        )
    envelope = _sign(supplier_did, role, subject.model_dump(), *_MANDATE_TYPES["cart"], expiry)
    return CartMandate.model_validate(envelope.model_dump())


def public_did_of_role(role: str) -> str:
    return get_role_did(role)


def issue_payment_mandate(
    *,
    agent_did: str,
    amount_inr: float,
    checkout_hash: str,
    reserve_pay_block_id: str,
    prev_mandate_id: str,
    payment_id: str | None = None,
    status: str = "executed",
) -> PaymentMandate:
    now = utcnow_iso()
    expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(timespec="seconds")
    subject = PaymentSubject(
        mandate_id=new_mandate_id(),
        prev_mandate_id=prev_mandate_id,
        prev_mandate_ids=[prev_mandate_id],
        timestamp=now,
        agent_did=agent_did,
        amount_inr=amount_inr,
        currency="INR",
        checkout_hash=checkout_hash,
        payment_method="upi_reserve_pay",
        reserve_pay_block_id=reserve_pay_block_id,
        payment_id=payment_id,
        status=status,
    )
    envelope = _sign(agent_did, "agent", subject.model_dump(), *_MANDATE_TYPES["payment"], expiry)
    return PaymentMandate.model_validate(envelope.model_dump())


def mandate_to_json(m: Mandate | dict) -> dict:
    if isinstance(m, dict):
        return m
    return json.loads(m.model_dump_json(by_alias=True))
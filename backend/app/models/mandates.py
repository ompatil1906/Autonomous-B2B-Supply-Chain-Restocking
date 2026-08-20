from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class Proof(BaseModel):
    type: str = "Ed25519Signature2020"
    created: str
    verificationMethod: str
    proofPurpose: str = "assertionMethod"
    proofValue: str = ""


class Item(BaseModel):
    sku: str
    name: str
    quantity: int
    unit_price_inr: float
    line_total_inr: float


class Constraint(BaseModel):
    amount_min_inr: float = 0.0
    amount_max_inr: float
    currency: str = "INR"
    allowed_skus: list[str]
    max_quantity_per_sku: int
    max_unit_price_inr: float
    user_cart_confirmation_required: bool = False
    supplier_dids: list[str] = Field(default_factory=list)
    valid_until: str


class IntentSubject(BaseModel):
    mandate_id: str
    prev_mandate_id: Optional[str] = None
    prev_mandate_ids: list[str] = Field(default_factory=list)
    timestamp: str
    merchant_did: str
    agent_did: str
    purpose: str
    constraints: Constraint
    intent_note: str


class CartSubject(BaseModel):
    mandate_id: str
    prev_mandate_id: Optional[str] = None
    prev_mandate_ids: list[str] = Field(default_factory=list)
    timestamp: str
    merchant_did: str  # the B2B supplier
    supplier_name: str
    items: list[Item]
    taxes_inr: float = 0.0
    shipping_inr: float = 0.0
    total_inr: float
    currency: str = "INR"
    quote_ref: str


class PaymentSubject(BaseModel):
    mandate_id: str
    prev_mandate_id: Optional[str] = None
    prev_mandate_ids: list[str] = Field(default_factory=list)
    timestamp: str
    agent_did: str
    amount_inr: float
    currency: str = "INR"
    checkout_hash: str
    payment_method: str = "upi_reserve_pay"
    reserve_pay_block_id: str
    payment_id: Optional[str] = None
    status: str = "executed"  # executed | aborted


class Mandate(BaseModel):
    """A W3C Verifiable Credential flavoured to AP2 (mandate.payment-style SD-JWT intent)."""

    ld_context: list[str] = Field(
        default_factory=lambda: [
            "https://www.w3.org/ns/credentials/v2.0",
            "https://ap2-protocol.org/contexts/mandate/v1",
        ],
        validation_alias="@context",
        serialization_alias="@context",
    )
    id: str
    type: list[str]
    vct: str
    issuer: str
    issuanceDate: str
    expirationDate: str
    credentialSubject: dict[str, Any]
    proof: Proof


class IntentMandate(Mandate):
    credentialSubject: IntentSubject
    type: list[str] = ["VerifiableCredential", "AP2IntentMandate"]
    vct: str = "mandate.intent.1"


class CartMandate(Mandate):
    credentialSubject: CartSubject
    type: list[str] = ["VerifiableCredential", "AP2CartMandate"]
    vct: str = "mandate.cart.1"


class PaymentMandate(Mandate):
    credentialSubject: PaymentSubject
    type: list[str] = ["VerifiableCredential", "AP2PaymentMandate"]
    vct: str = "mandate.payment.1"


MandateType = IntentMandate | CartMandate | PaymentMandate
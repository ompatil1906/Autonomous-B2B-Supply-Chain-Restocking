"""Multi-supplier procurement pool.

Each supplier carries its own Ed25519 identity (key file), price tier, lead time,
reliability, minimum order quantity and availability. Offers are produced from a
deterministic model but must always be treated as UNTRUSTED input — they are parsed
into structured data and never, on their own, authorise a payment.
"""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.ap2.keys import public_did
from app.ap2.signer import issue_cart_mandate
from app.config import settings
from app.products import PRODUCTS

# key-file name per supplier — gives each supplier an independent signing identity.
SUPPLIER_KEYS: dict[str, str] = {
    "SUP-A": "supplier_a",
    "SUP-B": "supplier_b",
    "SUP-C": "supplier_c",
}


@dataclass(frozen=True)
class SupplierCfg:
    id: str
    key_name: str
    name: str
    price_multiplier: float  # relative to catalog list price
    lead_time_s: float
    reliability: float  # 0..1
    moq: int
    max_qty: int
    allowed: bool = True

    @property
    def did(self) -> str:
        return public_did_impl(self.key_name)


SUPPLIERS: dict[str, SupplierCfg] = {
    "SUP-A": SupplierCfg("SUP-A", "supplier_a", "Acme B2B Supplies", 1.00, 18.0, 0.97, 10, 200),
    "SUP-B": SupplierCfg("SUP-B", "supplier_b", "Vertex Wholesale", 0.97, 34.0, 0.92, 10, 200),
    "SUP-C": SupplierCfg("SUP-C", "supplier_c", "Nova Distributors", 0.94, 85.0, 0.76, 15, 150),
}

# Which suppliers are forced to overprice in the price_attack scenario.
_PRICE_ATTACK_SUPPLIERS = {"SUP-A"}  # the "trusted incumbent" turns hostile
_PRICE_ATTACK_MULTIPLIER = 1.12


def public_did_impl(key_name: str) -> str:
    from app.ap2.keys import keys

    return public_did(keys()[key_name])


def active_suppliers() -> list[SupplierCfg]:
    return [s for s in SUPPLIERS.values() if s.allowed]


def get_supplier(supplier_id: str) -> SupplierCfg | None:
    return SUPPLIERS.get(supplier_id)


def unit_price_for(supplier_id: str, sku: str, scenario: str = "normal") -> float:
    sup = get_supplier(supplier_id)
    if sup is None:
        raise KeyError(f"Unknown supplier {supplier_id}")
    base = round(PRODUCTS[sku].price_inr * sup.price_multiplier, 2)
    if scenario == "price_attack" and supplier_id in _PRICE_ATTACK_SUPPLIERS:
        base = round(PRODUCTS[sku].price_inr * _PRICE_ATTACK_MULTIPLIER, 2)
    return base


def quote_legacy_catalog(sku: str) -> dict:
    """Backwards-compat single-supplier view (SUP-A at list price)."""
    p = PRODUCTS[sku]
    return {"name": p.name, "unit_price_inr": p.price_inr, "supplier_id": "SUP-A",
            "supplier_name": SUPPLIERS["SUP-A"].name}


def build_cart_mandate(
    supplier_id: str,
    sku: str,
    quantity: int,
    scenario: str = "normal",
    prev_mandate_id: str | None = None,
):
    """Build a signed CartMandate for `quantity` units of `sku` from one supplier.

    scenario="price_attack": the offending suppliers quote an inflated unit price.
    """
    sup = get_supplier(supplier_id)
    if sup is None:
        raise KeyError(f"Unknown supplier {supplier_id}")
    base = PRODUCTS[sku]
    unit_price = unit_price_for(supplier_id, sku, scenario)
    total_inr = round(unit_price * quantity, 2)
    items = [
        {
            "sku": sku,
            "name": base.name,
            "quantity": quantity,
            "unit_price_inr": round(unit_price, 2),
            "line_total_inr": round(unit_price * quantity, 2),
        }
    ]
    quote_ref = f"QT-{uuid.uuid4().hex[:8].upper()}"
    return issue_cart_mandate(
        supplier_did=sup.did,
        supplier_name=sup.name,
        items=items,
        taxes_inr=0.0,
        shipping_inr=0.0,
        total_inr=total_inr,
        quote_ref=quote_ref,
        prev_mandate_id=prev_mandate_id,
    )


def quote_expiry_s(supplier_id: str, sku: str) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=1)


def estimate_lead_time(supplier_id: str, learned: dict[str, float] | None = None) -> float:
    """Lead time adjusted by outcome learning (never below a floor)."""
    sup = get_supplier(supplier_id)
    if sup is None:
        return 9999.0
    learned = learned or {}
    adj = learned.get(supplier_id, 0.0)
    return max(5.0, sup.lead_time_s + adj)
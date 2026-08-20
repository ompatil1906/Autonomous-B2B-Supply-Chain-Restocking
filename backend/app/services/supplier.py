"""Mock B2B supplier. Returns an AP2 CartMandate that locks exact SKUs, quantities and prices."""
from __future__ import annotations

import uuid

from app.ap2.signer import issue_cart_mandate
from app.ap2.keys import get_role_did
from app.config import settings

# Base unit price per SKU as catalogued by the supplier.
_CATALOG = {
    "SKU-404": {"name": "Minimal Cotton Tee (Black)", "unit_price_inr": 98.0},
    "SKU-101": {"name": "Organic Hoodie", "unit_price_inr": 420.0},
    "SKU-202": {"name": "Canvas Tote", "unit_price_inr": 160.0},
}


def catalog_entry(sku: str) -> dict:
    return _CATALOG[sku]


def build_cart_mandate(sku: str, quantity: int, scenario: str = "normal", prev_mandate_id: str | None = None):
    """Build a CartMandate for `quantity` units of `sku`.

    scenario="normal": catalog price (₹98 × 100 = ₹9,800) — within a ₹10,000 intent.
    scenario="price_hike": unit price inflated to ₹110 → ₹11,000 — exceeds the intent.
    """
    base = _CATALOG[sku]
    unit_price = base["unit_price_inr"]
    if scenario == "price_hike":
        unit_price = 110.0
    # Clean figures for the demo: normal = ₹9,800, price-hike = ₹11,000 (matches the pitch).
    taxes_inr = 0.0
    shipping_inr = 0.0
    total_inr = round(unit_price * quantity + taxes_inr + shipping_inr, 2)

    items = [
        {
            "sku": sku,
            "name": base["name"],
            "quantity": quantity,
            "unit_price_inr": round(unit_price, 2),
            "line_total_inr": round(unit_price * quantity, 2),
        }
    ]
    quote_ref = f"QT-{uuid.uuid4().hex[:8].upper()}"
    return issue_cart_mandate(
        supplier_did=get_role_did("supplier"),
        supplier_name=settings.supplier_name,
        items=items,
        taxes_inr=taxes_inr,
        shipping_inr=shipping_inr,
        total_inr=total_inr,
        quote_ref=quote_ref,
        prev_mandate_id=prev_mandate_id,
    )
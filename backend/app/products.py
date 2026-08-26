"""Product catalog — the single source of truth for every SKU the system knows.

Used by the supplier's price list, the warehouse seed, per-SKU AP2 mandate limits,
and the Live Ops orchestrator. Festival SKUs are hidden until their scheduled drop;
their `curve` entries are (elapsed_seconds_since_launch, units_per_minute) knots of
a piecewise-linear demand profile held at the last knot.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProductConfig:
    sku: str
    name: str
    glyph: str  # thumbnail letter/glyph for the shop floor card
    price_inr: float
    restock_qty: int
    ceiling_inr: float        # per-SKU IntentMandate amount cap
    max_unit_price_inr: float
    reorder_threshold: int
    seed_stock: int           # warehouse stock on reset
    festival: bool = False
    launch_stock: int = 0     # festival drop opening stock
    curve: tuple[tuple[float, float], ...] = field(default_factory=tuple)


PRODUCTS: dict[str, ProductConfig] = {
    # ---- evergreen shelf ----
    "SKU-404": ProductConfig(
        sku="SKU-404", name="Garnier Micellar Water 125ml", glyph="G",
        price_inr=98.0, restock_qty=100, ceiling_inr=10_000.0, max_unit_price_inr=100.0,
        reorder_threshold=20, seed_stock=12,
    ),
    "SKU-101": ProductConfig(
        sku="SKU-101", name="Boat Bassheads Earphones", glyph="B",
        price_inr=449.0, restock_qty=40, ceiling_inr=18_000.0, max_unit_price_inr=460.0,
        reorder_threshold=40, seed_stock=140,
    ),
    "SKU-203": ProductConfig(
        sku="SKU-203", name="Nivea Soft Moisturizer 200ml", glyph="N",
        price_inr=199.0, restock_qty=60, ceiling_inr=12_000.0, max_unit_price_inr=210.0,
        reorder_threshold=60, seed_stock=300,
    ),
    # ---- festival drop batch ----
    # F1 — the predictive star: velocity ramps to 60/min so predictedSecondsToStockout
    # crosses the 90s lead-time at roughly 45% stock, well before the hard floor.
    "SKU-F1": ProductConfig(
        sku="SKU-F1", name="Logitech B100 Wired Mouse", glyph="L",
        price_inr=349.0, restock_qty=50, ceiling_inr=18_000.0, max_unit_price_inr=360.0,
        reorder_threshold=30, seed_stock=0, festival=True, launch_stock=200,
        curve=((0, 2.0), (40, 60.0)),
    ),
    # F2 — comfortable mid-seller: also fires predictive, normal executed outcome.
    "SKU-F2": ProductConfig(
        sku="SKU-F2", name="Noise ColorFit Smartwatch", glyph="S",
        price_inr=899.0, restock_qty=15, ceiling_inr=14_000.0, max_unit_price_inr=920.0,
        reorder_threshold=10, seed_stock=0, festival=True, launch_stock=160,
        curve=((0, 3.0), (30, 45.0)),
    ),
    # F3 — the stress test: a late spike (100/min) forces back-to-back restock
    # cycles. Tuned so the agent always wins the race: bigger lots (80 @ ₹12k
    # ceiling) + a 15s cooldown keep stock strictly above zero at all times.
    "SKU-F3": ProductConfig(
        sku="SKU-F3", name="Cadbury Celebrations Box", glyph="C",
        price_inr=149.0, restock_qty=80, ceiling_inr=12_000.0, max_unit_price_inr=160.0,
        reorder_threshold=25, seed_stock=0, festival=True, launch_stock=160,
        curve=((0, 48.0), (30, 48.0), (32, 100.0)),
    ),
}

EVERGREEN_SKUS: list[str] = [s for s, p in PRODUCTS.items() if not p.festival]
FESTIVAL_SKUS: list[str] = [s for s, p in PRODUCTS.items() if p.festival]

# Ambient background demand (sales/second per evergreen SKU) — keeps the shop
# floor alive without ever approaching a trigger. SKU-404 is kept extra quiet:
# its legacy 12-unit seed means even a modest sales burst could cross the
# predictive lead-time and burn day-budget before the festival drop begins.
AMBIENT_LAMBDA: dict[str, float] = {"SKU-404": 0.005, "SKU-101": 0.01, "SKU-203": 0.008}


def limits_for(sku: str) -> dict:
    """Per-SKU AP2 mandate bounds handed to the agent run."""
    p = PRODUCTS[sku]
    return {
        "amount_max_inr": p.ceiling_inr,
        "allowed_skus": [p.sku],
        "max_quantity_per_sku": p.restock_qty,
        "max_unit_price_inr": p.max_unit_price_inr,
    }


def est_cart_cost(sku: str) -> float:
    return round(PRODUCTS[sku].price_inr * PRODUCTS[sku].restock_qty, 2)


def velocity_at(curve: tuple[tuple[float, float], ...], elapsed_s: float) -> float:
    """Piecewise-linear interpolation on (t, units_per_min) knots, held at the end."""
    if not curve or elapsed_s <= curve[0][0]:
        return curve[0][1] if curve else 0.0
    for (t0, v0), (t1, v1) in zip(curve, curve[1:]):
        if elapsed_s <= t1:
            frac = 0.0 if t1 == t0 else (elapsed_s - t0) / (t1 - t0)
            return v0 + (v1 - v0) * frac
    return curve[-1][1]

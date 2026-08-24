"""Mock warehouse inventory, seeded from the product catalog.

Festival SKUs carry stock too (their launch batch) — visibility on the shop
floor is decided by the Live Ops orchestrator via `launchedAt`, not here.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass

from app.products import PRODUCTS


@dataclass
class Sku:
    sku: str
    name: str
    stock: int
    reorder_threshold: int
    reorder_qty: int
    velocity: str


def _seed() -> dict[str, Sku]:
    out: dict[str, Sku] = {}
    for p in PRODUCTS.values():
        opening = p.seed_stock if not p.festival else p.launch_stock
        heat = "high" if p.sku == "SKU-404" else "medium"
        out[p.sku] = Sku(p.sku, p.name, stock=opening, reorder_threshold=p.reorder_threshold,
                         reorder_qty=p.restock_qty, velocity=heat)
    return out


_skus = _seed()
_lock = threading.Lock()


def catalog() -> list[dict]:
    return [
        {"sku": s.sku, "name": s.name, "stock": s.stock, "reorder_threshold": s.reorder_threshold}
        for s in _skus.values()
    ]


def get(sku: str) -> Sku | None:
    return _skus.get(sku)


def below_threshold(sku: str) -> bool:
    s = _skus.get(sku)
    if not s:
        return False
    return s.stock < s.reorder_threshold


def stock_levels() -> dict[str, int]:
    return {s.sku: s.stock for s in _skus.values()}


def apply_restock(sku: str, quantity: int) -> None:
    with _lock:
        _skus[sku].stock += quantity


def set_stock(sku: str, quantity: int) -> None:
    with _lock:
        _skus[sku].stock = quantity


def record_sale(sku: str, qty: int) -> tuple[int, bool]:
    """Decrement stock; returns (new_stock, hit_zero). Floors at zero."""
    with _lock:
        s = _skus[sku]
        s.stock = max(0, s.stock - qty)
        return s.stock, s.stock == 0


def reset(overrides: dict[str, int] | None = None) -> None:
    global _skus
    overrides = overrides or {}
    with _lock:
        _skus = _seed()
        for sku, stock in overrides.items():
            if sku in _skus:
                _skus[sku].stock = stock
        # Legacy single-SKU demo always starts from the canonical 12-unit state.
        _skus["SKU-404"].stock = overrides.get("SKU-404", 12)

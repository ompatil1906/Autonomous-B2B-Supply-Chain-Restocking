"""Mock warehouse inventory. SKU-404 is the best-selling SKU used in the demo."""
from __future__ import annotations

import threading
from dataclasses import dataclass, field


@dataclass
class Sku:
    sku: str
    name: str
    stock: int
    reorder_threshold: int
    reorder_qty: int
    velocity: str


_skus: dict[str, Sku] = {
    "SKU-404": Sku("SKU-404", "Minimal Cotton Tee (Black)", stock=12, reorder_threshold=20, reorder_qty=100, velocity="high"),
    "SKU-101": Sku("SKU-101", "Organic Hoodie", stock=140, reorder_threshold=40, reorder_qty=60, velocity="medium"),
    "SKU-202": Sku("SKU-202", "Canvas Tote", stock=300, reorder_threshold=60, reorder_qty=120, velocity="medium"),
}

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
        s = _skus[sku]
        s.stock += quantity


def set_stock(sku: str, quantity: int) -> None:
    with _lock:
        _skus[sku].stock = quantity


def reset(overrides: dict[str, int] | None = None) -> None:
    with _lock:
        for s in _skus.values():
            s.stock = overrides.get(s.sku, 0) if overrides else 0
        _skus["SKU-404"].stock = 12
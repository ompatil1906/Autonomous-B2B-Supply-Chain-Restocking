"""Persistent store of economic decisions + outcome records.

Every time the Growth Engine chooses a course of action (BUY / DO_NOT_BUY /
SWITCH_SUPPLIER / REDUCE_QUANTITY / ESCALATE / WAIT), the decision plus its
rationale and the protective economics are recorded here atomically with the
execution — so the "Revenue Protected" tab has real, queryable history.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone

from app.paths import DECISIONS_FILE, OUTCOMES_FILE

_lock = threading.Lock()


def _ensure(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def _load(path: str) -> list[dict]:
    _ensure(path)
    if not os.path.exists(path):
        return []
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save(path: str, items: list[dict]) -> None:
    _ensure(path)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(items[-400:], fh, ensure_ascii=False, indent=1, default=str)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def record_decision(decision: dict) -> dict:
    decision = dict(decision)
    decision.setdefault("created_at", _now())
    with _lock:
        items = _load(DECISIONS_FILE)
        items.append(decision)
        _save(DECISIONS_FILE, items)
    return decision


def list_decisions(limit: int = 100) -> dict:
    with _lock:
        items = _load(DECISIONS_FILE)
    items.reverse()
    return {"decisions": items[:limit]}


def get_decision(decision_id: str) -> dict | None:
    with _lock:
        for d in _load(DECISIONS_FILE):
            if d["decision_id"] == decision_id:
                return d
    return None


def update_decision(decision_id: str, patch: dict) -> dict | None:
    """Merge `patch` into an existing decision (identified by decision_id).

    Used to enrich a decision with the negotiated pricing once the cart/mandate
    resolves — it keeps ONE row per decision and never duplicates history.
    """
    with _lock:
        items = _load(DECISIONS_FILE)
        for d in items:
            if d.get("decision_id") == decision_id:
                d.update(patch)
                _save(DECISIONS_FILE, items)
                return dict(d)
    return None


def record_outcome(outcome: dict) -> dict:
    outcome = dict(outcome)
    outcome.setdefault("created_at", _now())
    with _lock:
        items = _load(OUTCOMES_FILE)
        items.append(outcome)
        _save(OUTCOMES_FILE, items)
    return outcome


def list_outcomes(limit: int = 100) -> dict:
    with _lock:
        items = _load(OUTCOMES_FILE)
    items.reverse()
    return {"outcomes": items[:limit]}


def summary() -> dict:
    """Aggregate dashboard stats across every recorded decision."""
    with _lock:
        items = _load(DECISIONS_FILE)

    total = len(items)
    buys = [d for d in items if d.get("action") == "BUY"]
    spent = round(sum(float(d.get("procurement_cost_inr") or 0.0) for d in buys), 2)
    protected = round(
        sum(float(d.get("contribution_protected_inr") or 0.0) for d in items), 2
    )
    blocked = len([d for d in items if d.get("action") in ("DO_NOT_BUY", "ESCALATE")])
    return {
        "total_decisions": total,
        "buys": len(buys),
        "blocked": blocked,
        "total_procurement_inr": spent,
        "total_contribution_protected_inr": protected,
        "portfolio_revenue_at_risk_inr": round(
            sum(float(d.get("revenue_at_risk_inr") or 0.0) for d in items), 2
        ),
    }


def clear() -> None:
    with _lock:
        for f in (DECISIONS_FILE, OUTCOMES_FILE):
            if os.path.exists(f):
                os.remove(f)
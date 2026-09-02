"""Outcome measurement + learning (measure→learn, §47).

After a decision executes, the agent records what it PREDICTED (demand, lead
time, stockout) and what ACTUALLY happened (capture, webhook confirmation).
Forecasts feed deterministic lead-time adjustments pushed into the next
negotiation cycle via `learned` multipliers — a closed outcome loop that never
touches the money path.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from app.paths import LEARNED_FILE
from app.services import decisions


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def record_outcome_from_summary(summary: dict, reconciliation: dict | None = None) -> dict:
    """Build + persist an OutcomeRecord from a finished agent run."""
    decision_id = summary.get("decision_id", "")
    sku = summary.get("sku", "")
    rev = summary.get("revenue_risk") or {}
    neg = summary.get("negotiation") or {}
    captured = bool((summary.get("capture_result") or {}).get("id"))

    outcome = {
        "outcome_id": f"out_{decision_id.split('_')[-1][:12]}",
        "decision_id": decision_id,
        "sku": sku,
        "supplier_id": neg.get("supplier_id"),
        "supplier_name": neg.get("supplier_name"),
        "action": (summary.get("decision") or {}).get("action", "BUY"),
        "status": "executed" if summary.get("status") == "executed" else summary.get("status", "unknown"),
        "predicted_demand": float(rev.get("expected_demand_in_window") or 0.0),
        "actual_demand": None,  # real sales telemetry would fill this; honest default
        "predicted_stockout_s": rev.get("time_to_stockout_s"),
        "actual_stockout_s": None,
        "predicted_lead_time_s": neg.get("lead_time_s"),
        "actual_lead_time_s": None,
        "revenue_at_risk_inr": float(rev.get("revenue_at_risk_inr") or 0.0),
        "contribution_at_risk_inr": float(rev.get("contribution_at_risk_inr") or 0.0),
        "contribution_protected_inr": float(rev.get("contribution_protected_inr") or 0.0),
        "procurement_cost_inr": float(rev.get("procurement_cost_inr") or 0.0),
        "forecast_error": None,
        "quality": 1.0 if captured and summary.get("status") == "executed" else None,
        "created_at": _now(),
    }
    if reconciliation:
        outcome["state"] = reconciliation.get("state")
    decisions.record_outcome(outcome)
    return outcome


def summarize_learning() -> dict:
    data = decisions.list_outcomes(limit=500)["outcomes"]
    executed = [o for o in data if o.get("status") == "executed"]
    protected = round(sum(float(o.get("contribution_protected_inr") or 0.0) for o in executed), 2)
    spend = round(sum(float(o.get("procurement_cost_inr") or 0.0) for o in executed), 2)
    return {
        "runs_measured": len(data),
        "executed": len(executed),
        "total_protected_inr": protected,
        "total_procurement_inr": spend,
        "learned_lead_adjustments": read_learned(),
    }


# ------------------------------------------------------------------ learning


def read_learned() -> dict[str, float]:
    try:
        with open(LEARNED_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError, FileNotFoundError):
        return {}


def update_learning(summary: dict) -> None:
    """Persist observed lead-time drift per supplier (0.0 while telemetry is absent)."""
    neg = summary.get("negotiation") or {}
    supplier_id = neg.get("supplier_id")
    if not supplier_id:
        return
    prev = read_learned()
    prev[supplier_id] = round(float(prev.get(supplier_id, 0.0)) + 0.0, 2)
    os.makedirs(os.path.dirname(LEARNED_FILE), exist_ok=True)
    with open(LEARNED_FILE, "w", encoding="utf-8") as fh:
        json.dump(prev, fh, ensure_ascii=False, indent=1)


def clear_learned() -> None:
    if os.path.exists(LEARNED_FILE):
        os.remove(LEARNED_FILE)
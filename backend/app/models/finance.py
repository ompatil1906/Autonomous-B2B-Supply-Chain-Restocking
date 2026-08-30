"""Structured models for financial execution, reconciliation and outcomes."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ExecutionStatus = Literal[
    "PENDING",
    "AUTHORIZED",
    "CAPTURED",
    "FAILED",
    "RECONCILED",
    "MISMATCH",
    "REQUIRES_REVIEW",
]

# Every financial leg must carry one of these so the UI can never guess whether
# money actually moved on Razorpay.
LegStatus = Literal["real", "test", "simulated", "fallback", "skipped", "failed"]


class FinancialLeg(BaseModel):
    kind: str  # order | capture | payment_link | payout | customer_payment
    direction: str  # customer_payment | supplier_settlement | manual_approval
    status: LegStatus
    razorpay_id: Optional[str] = None
    amount_inr: Optional[float] = None
    detail: str = ""


class FinancialExecutionRecord(BaseModel):
    """The unified, serializable record every execution produces."""

    decision_id: str
    execution_id: str
    idempotency_key: str
    sku: str
    direction: str  # supplier_settlement | manual_approval | customer_payment
    mode: str  # simulation | remote_test
    status: ExecutionStatus = "PENDING"
    legs: list[FinancialLeg] = Field(default_factory=list)
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    payment_link: Optional[dict] = None
    amount_inr: Optional[float] = None
    error: Optional[str] = None
    webhook_event_id: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


class ReconciliationRecord(BaseModel):
    """Decision ↔ Razorpay object ↔ webhook state tie-back."""

    id: str
    decision_id: str
    execution_id: str
    sku: str
    direction: str
    expected_amount_inr: float
    actual_amount_inr: Optional[float] = None
    state: ExecutionStatus = "PENDING"
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    events: list[str] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


class OutcomeRecord(BaseModel):
    """What the agent predicted vs what actually happened — the learning input."""

    decision_id: str
    sku: str
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    action: str = "BUY"  # BUY | DO_NOT_BUY | BLOCKED | ESCALATED
    status: str = "executed"
    predicted_demand: float = 0.0
    actual_demand: Optional[float] = None
    predicted_stockout_s: Optional[float] = None
    actual_stockout_s: Optional[float] = None
    predicted_lead_time_s: Optional[float] = None
    actual_lead_time_s: Optional[float] = None
    revenue_at_risk_inr: float = 0.0
    contribution_at_risk_inr: float = 0.0
    contribution_protected_inr: float = 0.0
    procurement_cost_inr: Optional[float] = None
    forecast_error: Optional[float] = None
    quality: Optional[float] = None
    created_at: str = ""


class RevenueRiskInput(BaseModel):
    sku: str
    current_stock: float
    units_per_minute: float
    selling_price_inr: float
    unit_procurement_cost_inr: float
    contribution_margin_per_unit_inr: float
    supplier_lead_time_s: float
    risk_window_s: float = 0.0


class RevenueRiskResult(BaseModel):
    sku: str
    time_to_stockout_s: Optional[float]
    supplier_lead_time_s: float
    risk_window_s: float
    expected_demand_in_window: float
    available_stock: float
    expected_lost_units: float
    revenue_at_risk_inr: float
    contribution_at_risk_inr: float
    proposed_quantity: int
    procurement_cost_inr: float
    contribution_protected_inr: float
    protection_spend_ratio: float
    assumptions: dict[str, str] = Field(default_factory=dict)


class EconomicDecision(BaseModel):
    action: str  # BUY | NEGOTIATE | REDUCE_QUANTITY | SWITCH_SUPPLIER | WAIT | DO_NOT_BUY | ESCALATE
    quantity: Optional[int] = None
    supplier_id: Optional[str] = None
    target_unit_price_inr: Optional[float] = None
    rationale: str = ""
    factors: list[str] = Field(default_factory=list)
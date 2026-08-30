export interface GateCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface GateVerdict {
  passed: boolean;
  summary: string;
  checks: GateCheck[];
  failed_checks?: GateCheck[];
  check_count?: number;
}

export interface Mandate {
  "@context": string[];
  id: string;
  type: string[];
  vct: string;
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: any;
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
  };
}

export interface CaptureResult {
  id: string;
  entity?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  captured?: boolean;
  simulated?: boolean;
}

export interface PaymentLink {
  id: string;
  amount: number;
  currency: string;
  description: string;
  reference_id: string;
  status: string;
  short_url: string;
  simulated?: boolean;
}

export interface ReserveBlock {
  block_id: string;
  reserved_inr: number;
  remaining_inr: number;
  created_at: string;
  mandate_id: string;
  debits: { ts: string; amount_inr: number; payment_id: string }[];
}

export interface Step {
  kind: string;
  message: string;
  [key: string]: any;
}

export type RunStatus = "executed" | "blocked" | "no_action";

export interface RunResult {
  status: RunStatus;
  scenario: string;
  sku: string;
  quantity: number;
  trigger_reason?: string;
  intent: Mandate;
  cart: Mandate | null;
  gate: GateVerdict;
  decision?: EconomicDecision;
  revenue_risk?: RevenueRiskResult;
  negotiation?: NegotiationResult;
  quotes?: SupplierQuote[];
  llm_strategy?: { strategy: string; provider: string; advisory: boolean };
  llm_provider?: string;
  payment_mandate?: Mandate | null;
  capture_result?: CaptureResult;
  payment_link?: PaymentLink;
  escalation_id?: string;
  whatsapp_message?: { to: string; message: string; payment_link?: string };
  reserve_block: ReserveBlock;
  stock_after: Record<string, number>;
  execution?: FinancialExecution;
  reconciliation?: Reconciliation;
  outcome?: OutcomeRecord;
  money_moved_inr?: number;
  order_id?: string;
  steps: Step[];
}

// ---------------------------------------------------------------- economics

export interface RevenueRiskResult {
  sku: string;
  time_to_stockout_s: number | null;
  supplier_lead_time_s: number;
  risk_window_s: number;
  expected_demand_in_window: number;
  available_stock: number;
  expected_lost_units: number;
  revenue_at_risk_inr: number;
  contribution_at_risk_inr: number;
  proposed_quantity: number;
  procurement_cost_inr: number;
  contribution_protected_inr: number;
  protection_spend_ratio: number;
  assumptions: Record<string, string>;
}

export type DecisionAction =
  | "BUY"
  | "DO_NOT_BUY"
  | "SWITCH_SUPPLIER"
  | "REDUCE_QUANTITY"
  | "NEGOTIATE"
  | "WAIT"
  | "ESCALATE";

export interface EconomicDecision {
  decision_id: string;
  sku: string;
  action: DecisionAction;
  quantity: number | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  unit_price_inr?: number | null;
  total_inr?: number | null;
  target_unit_price_inr?: number | null;
  rationale: string;
  factors: string[];
  revenue_at_risk_inr?: number;
  contribution_at_risk_inr?: number;
  contribution_protected_inr?: number;
  procurement_cost_inr?: number;
  protection_spend_ratio?: number;
  created_at?: string;
}

export interface SupplierQuote {
  supplier_id: string;
  name?: string;
  unit_price_inr: number;
  lead_time_s: number;
  reliability: number;
  moq: number;
  max_qty: number;
  quote_valid_until?: string;
}

export interface NegotiationResult {
  action: DecisionAction;
  supplier_id: string | null;
  supplier_name: string | null;
  quantity: number | null;
  unit_price_inr: number | null;
  total_inr?: number | null;
  lead_time_s?: number | null;
  reliability?: number | null;
  rationale: string;
  factors: string[];
  quotes: SupplierQuote[];
  cart?: Mandate | null;
}

// ---------------------------------------------------------------- finance

export type LegStatus = "real" | "test" | "simulated" | "fallback" | "skipped" | "failed";

export interface FinancialLeg {
  kind: string; // order | capture | payment_link | payout | customer_payment
  direction: string;
  status: LegStatus;
  razorpay_id?: string | null;
  amount_inr?: number | null;
  detail: string;
}

export type ExecutionStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "RECONCILED"
  | "MATCHED"
  | "MISMATCH"
  | "REQUIRES_REVIEW";

export interface FinancialExecution {
  decision_id: string;
  execution_id: string;
  idempotency_key: string;
  sku: string;
  direction: string;
  mode: string; // simulation | remote_test
  status: ExecutionStatus;
  legs: FinancialLeg[];
  order_id?: string | null;
  payment_id?: string | null;
  payment_link?: PaymentLink | null;
  amount_inr?: number | null;
  error?: string | null;
  webhook_event_id?: string | null;
  created_at: string;
  updated_at: string;
  razorpay_backend?: string;
  reconciliation_id?: string;
  reconciliation_state?: string;
  payment_mandate?: Mandate | null;
}

export interface Reconciliation {
  id: string;
  decision_id: string;
  execution_id: string;
  sku: string;
  direction: string;
  expected_amount_inr: number;
  actual_amount_inr?: number | null;
  state: ExecutionStatus;
  order_id?: string | null;
  payment_id?: string | null;
  events: string[];
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  event_id: string;
  event_type: string;
  received_at: string;
  signature_valid: boolean;
  simulated: boolean;
  processed: boolean;
  processed_at?: string | null;
  payload_hash: string;
  status: string;
  error?: string | null;
  razorpay_reference?: string | null;
  amount_inr?: number | null;
  decision_id?: string | null;
}

export interface OutcomeRecord {
  outcome_id: string;
  decision_id: string;
  sku: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  action: string;
  status: string;
  predicted_demand: number;
  actual_demand?: number | null;
  predicted_stockout_s?: number | null;
  actual_stockout_s?: number | null;
  predicted_lead_time_s?: number | null;
  actual_lead_time_s?: number | null;
  revenue_at_risk_inr: number;
  contribution_at_risk_inr: number;
  contribution_protected_inr: number;
  procurement_cost_inr?: number | null;
  forecast_error?: number | null;
  quality?: number | null;
  state?: string;
  created_at: string;
}

export interface LearningSummary {
  runs_measured: number;
  executed: number;
  total_protected_inr: number;
  total_procurement_inr: number;
  learned_lead_adjustments: Record<string, number>;
}

export interface Supplier {
  id: string;
  name: string;
  price_multiplier: number;
  lead_time_s: number;
  reliability: number;
  moq: number;
  max_qty: number;
  did: string;
}

// ---------------------------------------------------------------- ledger

export interface AuditRecord {
  seq: number;
  ts: string;
  kind: string;
  prev_hash?: string;
  hash?: string;
  [key: string]: any;
}

export interface ApprovalRecord {
  id: string;
  status: "pending" | "approved" | "rejected";
  sku: string;
  quantity: number;
  total_inr: number;
  ceiling_inr: number;
  over_by: number;
  quote_ref: string;
  reason: string;
  cart_mandate: any;
  payment_link: PaymentLink | null;
  created_at: string;
  resolved_at: string | null;
  resolved_link: PaymentLink | null;
  link_reused?: boolean;
  reject_note?: string;
}

export interface VerifyResult {
  valid: boolean;
  count: number;
  first_bad_seq: number | null;
}

export interface Inventory {
  catalog: { sku: string; name: string; stock: number; reorder_threshold: number }[];
  stock: Record<string, number>;
}

export interface PortfolioPolicyItem {
  sku: string;
  name: string;
  price_inr: number;
  restock_qty: number;
  ceiling_inr: number;
  max_unit_price_inr: number;
  festival: boolean;
}

export interface SystemStatus {
  razorpay_mode: string;
  razorpay_execution_mode: string;
  razorpay_mcp_url: string;
  agent_llm_provider: string;
  agent_llm_model: string;
  app_env?: string;
  api_token_configured?: boolean;
  ap2_limit_inr: number;
  ap2_sku: string;
  ap2_max_qty: number;
  ap2_max_unit_price: number;
  ap2_daily_ceiling_inr?: number;
  supplier_name: string;
  merchant_name: string;
  merchant_phone: string;
  intent_expiry_hours: number;
  portfolio?: PortfolioPolicyItem[];
  suppliers?: Supplier[];
}

export type WsEvent =
  | { type: "run_started"; scenario: string; sku?: string }
  | { type: "node"; node: string; scenario: string; update: any }
  | { type: "run_completed"; scenario: string; sku?: string; result: RunResult }
  | { type: "run_failed"; scenario: string; sku?: string; error: string }
  | { type: "approval_updated" }
  | { type: "webhook"; event: WebhookEvent }
  // ---- Live Ops ----
  | { type: "sale"; sku: string; qty: number; stockAfter: number; tsMs: number }
  | { type: "sold_out"; sku: string; tsMs: number }
  | { type: "velocity"; snapshots: VelocitySnapshot[]; products: ProductView[]; ticker: Ticker; budget: DailyBudget; tsMs: number }
  | { type: "trigger"; trigger: AgentTrigger }
  | { type: "trigger_update"; trigger: AgentTrigger; gate?: GateVerdict }
  | { type: "budget"; budget: DailyBudget }
  | { type: "festival_started"; dropAtMs: number; skus: string[] }
  | { type: "festival_launched"; skus: string[]; tsMs: number }
  | { type: "festival_stopped" };

export interface VelocitySnapshot {
  sku: string;
  unitsPerMinute: number;
  windowSeconds: number;
  predictedSecondsToStockout: number | null;
}

export interface ProductView {
  sku: string;
  name: string;
  glyph: string;
  currentStock: number;
  referenceStock: number;
  reorderCeilingRupees: number;
  maxUnitPriceRupees: number;
  restockQty: number;
  unitPriceRupees: number;
  status:
    | "healthy" | "watch" | "critical" | "triggered"
    | "restocking" | "escalated" | "cooldown" | "sold_out";
  launchedAtMs: number | null;
  festival: boolean;
}

export interface Ticker {
  unitsLast10s: number;
  unitsLast5m: number;
}

export interface DailyBudget {
  block_id: string | null;
  ceilingRupees: number;
  spentRupees: number;
}

export type TriggerReason = "predictive_velocity" | "hard_floor" | "manual_probe";
export type TriggerOutcome = "in_progress" | "executed" | "escalated" | "failed";

export interface AgentTrigger {
  id: string;
  sku: string;
  reason: TriggerReason;
  triggeredAtMs: number;
  stockAtTrigger: number;
  velocityAtTrigger: number;
  predictedSecondsAtTrigger: number | null;
  currentStep: number;
  outcome: TriggerOutcome;
  amountInr?: number;
  quantity?: number;
  paymentId?: string;
  escalationId?: string;
  paymentLink?: PaymentLink;
  orderId?: string;
  razorpayBackend?: string;
  supplierId?: string;
  supplierAction?: string;
  decisionId?: string;
  revenueRisk?: RevenueRiskResult;
  reconciliation?: Reconciliation;
  mandates?: { intent: Mandate; cart: Mandate | null; payment: Mandate | null };
  gate?: GateVerdict;
  error?: string;
}

export interface LiveState {
  products: ProductView[];
  snapshots: VelocitySnapshot[];
  triggers: AgentTrigger[];
  budget: DailyBudget;
  ticker: Ticker;
  festivalActive: boolean;
  festivalDropInS: number | null;
  serverTimeMs: number;
  dailyCeilingRupees: number;
}
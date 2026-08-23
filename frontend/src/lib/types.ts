export interface GateCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface GateVerdict {
  passed: boolean;
  summary: string;
  checks: GateCheck[];
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

export interface RunResult {
  status: "executed" | "blocked";
  scenario: string;
  sku: string;
  quantity: number;
  intent: Mandate;
  cart: Mandate;
  gate: GateVerdict;
  payment_mandate: Mandate;
  capture_result?: CaptureResult;
  payment_link?: PaymentLink;
  escalation_id?: string;
  whatsapp_message?: { to: string; message: string; payment_link?: string };
  reserve_block: ReserveBlock;
  stock_after: Record<string, number>;
  steps: Step[];
}

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

export interface SystemStatus {
  razorpay_mode: string;
  razorpay_mcp_url: string;
  agent_llm_provider: string;
  agent_llm_model: string;
  ap2_limit_inr: number;
  ap2_sku: string;
  ap2_max_qty: number;
  ap2_max_unit_price: number;
  supplier_name: string;
  merchant_name: string;
  merchant_phone: string;
  intent_expiry_hours: number;
}

export type WsEvent =
  | { type: "run_started"; scenario: string }
  | { type: "node"; node: string; scenario: string; update: any }
  | { type: "run_completed"; scenario: string; result: RunResult }
  | { type: "run_failed"; scenario: string; error: string }
  | { type: "approval_updated" };
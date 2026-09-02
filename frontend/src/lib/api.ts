import type {
  AgentTrigger,
  ApprovalRecord,
  AuditRecord,
  EconomicDecision,
  FinancialExecution,
  Inventory,
  LearningSummary,
  LiveState,
  Reconciliation,
  RunResult,
  Supplier,
  SystemStatus,
  VerifyResult,
  WebhookEvent,
  WsEvent,
} from "./types";
import { getWardenToken } from "./auth";

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = import.meta.env.VITE_API_URL || (isLocal ? "" : "https://autonomous-b2b-supply-chain-restocking.onrender.com");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

/**
 * WRITE requests only — carries X-Warden-Token. The token is never placed in a
 * URL, body or error payload; the header is stripped from any error text.
 */
function post<T>(path: string, body?: unknown): Promise<T> {
  const token = getWardenToken();
  return fetch(BASE_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Warden-Token": token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      const detail = text.slice(0, 160).trim();
      if (r.status === 401) throw new Error("401 — Invalid or missing Warden token. Add it in Configuration.");
      if (r.status === 503) throw new Error("503 — Warden API token is not configured on the server.");
      throw new Error(`${path} → ${r.status} ${detail}`);
    }
    return r.json() as Promise<T>;
  });
}

export const api = {
  health: () => get<{ ok: boolean }>("/api/health"),
  status: () => get<SystemStatus>("/api/status"),
  inventory: () => get<Inventory>("/api/inventory"),
  audit: () => get<{ records: AuditRecord[] }>("/api/audit"),
  verifyChain: () => get<VerifyResult>("/api/audit/verify"),
  approvals: () =>
    get<{ pending: ApprovalRecord[]; resolved: ApprovalRecord[] }>("/api/approvals"),
  reserve: () => get<{ blocks: any[] }>("/api/reserve"),
  resetReserve: () =>
    post<{ block: any; summary: { block_id: string | null; ceilingRupees: number; spentRupees: number } }>(
      "/api/reserve/reset",
    ),
  systemReset: () => post<{ reset: boolean }>("/api/system/reset"),
  approveApproval: (id: string) => post<ApprovalRecord>(`/api/approvals/${id}/approve`),
  rejectApproval: (id: string) => post<ApprovalRecord>(`/api/approvals/${id}/reject`),
  latest: () => get<{ latest: RunResult | null }>("/api/runs/latest"),
  runs: () => get<{ runs: RunResult[] }>("/api/runs"),

  // ---- Warden operational endpoints ----
  decisions: () => get<{ decisions: EconomicDecision[] }>("/api/decisions"),
  decision: (id: string) =>
    get<{ decision: EconomicDecision; reconciliation?: Reconciliation | null }>(
      `/api/decisions/${id}`,
    ),
  revenueRiskModel: () =>
    get<{ latest: EconomicDecision | null; model: { window_s: number; margin_model: string; formula: string } }>(
      "/api/revenue-risk",
    ),
  outcomes: () => get<LearningSummary>("/api/outcomes"),
  reconciliations: () => get<{ reconciliations: Reconciliation[] }>("/api/reconciliations"),
  suppliers: () => get<{ suppliers: Supplier[] }>("/api/suppliers"),
  webhookEvents: () => get<{ events: WebhookEvent[] }>("/api/webhooks/events"),
  razorpayActivity: () =>
    get<{
      executions: FinancialExecution[];
      reconciliations: Reconciliation[];
      webhooks: WebhookEvent[];
    }>("/api/razorpay/activity"),

  // ---- live ops ----
  liveState: () => get<LiveState>("/api/live/state"),
  festivalStart: (delayS: number) =>
    post<{ dropAtMs: number; skus: string[] }>("/api/festival/start", { delay_s: delayS }),
  festivalStop: () => post<{ stopped: boolean }>("/api/festival/stop"),
  probe: (sku: string) => post<AgentTrigger>(`/api/live/probe/${sku}`),
  run: (body: {
    scenario: string;
    sku?: string;
    override_quantity?: number;
    reset_inventory?: boolean;
  }) => post<RunResult>("/api/run", body),

  // ---- webhooks (simulate is a write; razorpay POST is Razorpay's own auth) ----
  simulateWebhook: (body: { decision_id: string; amount_inr?: number; captured?: boolean }) =>
    post<{ event: WebhookEvent; reconciliation: Reconciliation | null }>(
      "/api/webhooks/simulate",
      body,
    ),
};

export function connectWs(onEvent: (e: WsEvent) => void): () => void {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const defaultBase = isLocal ? `${location.protocol}//${location.host}` : "https://autonomous-b2b-supply-chain-restocking.onrender.com";
  const baseUrl = import.meta.env.VITE_API_URL || defaultBase;
  const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as WsEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  return () => ws.close();
}
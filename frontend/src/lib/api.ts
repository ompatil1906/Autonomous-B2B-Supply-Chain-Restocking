import type {
  AgentTrigger,
  ApprovalRecord,
  AuditRecord,
  Inventory,
  LiveState,
  RunResult,
  SystemStatus,
  VerifyResult,
  WsEvent,
} from "./types";

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = import.meta.env.VITE_API_URL || (isLocal ? "" : "https://autonomous-b2b-supply-chain-restocking.onrender.com");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function post<T>(path: string): Promise<T> {
  return fetch(BASE_URL + path, { method: "POST" }).then(async (r) => {
    if (!r.ok) throw new Error(`${path} → ${r.status} ${(await r.text()).slice(0, 120)}`);
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
  approveApproval: (id: string) => post<ApprovalRecord>(`/api/approvals/${id}/approve`),
  rejectApproval: (id: string) => post<ApprovalRecord>(`/api/approvals/${id}/reject`),
  latest: () => get<{ latest: RunResult | null }>("/api/runs/latest"),
  liveState: () => get<LiveState>("/api/live/state"),
  festivalStart: (delayS: number) =>
    fetch(BASE_URL + "/api/festival/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delay_s: delayS }),
    }).then((r) => r.json() as Promise<{ dropAtMs: number; skus: string[] }>),
  festivalStop: () => post<{ stopped: boolean }>("/api/festival/stop"),
  probe: (sku: string) => post<AgentTrigger>(`/api/live/probe/${sku}`),
  run: (body: {
    scenario: string;
    sku?: string;
    override_quantity?: number;
    reset_inventory?: boolean;
  }) =>
    fetch(BASE_URL + "/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json() as Promise<RunResult>),
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
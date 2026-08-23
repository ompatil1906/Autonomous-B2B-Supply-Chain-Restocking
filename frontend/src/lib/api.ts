import type {
  ApprovalRecord,
  AuditRecord,
  Inventory,
  RunResult,
  SystemStatus,
  VerifyResult,
  WsEvent,
} from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function post<T>(path: string): Promise<T> {
  return fetch(path, { method: "POST" }).then(async (r) => {
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
  approveApproval: (id: string) => post<ApprovalRecord>(`/api/approvals/${id}/approve`),
  rejectApproval: (id: string) => post<ApprovalRecord>(`/api/approvals/${id}/reject`),
  latest: () => get<{ latest: RunResult | null }>("/api/runs/latest"),
  run: (body: {
    scenario: string;
    sku?: string;
    override_quantity?: number;
    reset_inventory?: boolean;
  }) =>
    fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json() as Promise<RunResult>),
};

export function connectWs(onEvent: (e: WsEvent) => void): () => void {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as WsEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  return () => ws.close();
}
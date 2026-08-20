import type {
  AuditRecord,
  Inventory,
  RunResult,
  SystemStatus,
  WsEvent,
} from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const api = {
  health: () => get<{ ok: boolean }>("/api/health"),
  status: () => get<SystemStatus>("/api/status"),
  inventory: () => get<Inventory>("/api/inventory"),
  audit: () => get<{ records: AuditRecord[] }>("/api/audit"),
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
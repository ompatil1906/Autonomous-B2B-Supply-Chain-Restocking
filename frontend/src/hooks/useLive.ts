import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type {
  AgentTrigger,
  DailyBudget,
  LiveState,
  ProductView,
  Ticker,
  VelocitySnapshot,
} from "../lib/types";

export interface LiveModel {
  products: ProductView[];
  snapshots: Record<string, VelocitySnapshot>;
  /** local ms timestamp when each sku's latest snapshot arrived — countdown interpolation */
  snapshotAt: Record<string, number>;
  /** local ms timestamp of the last sale per sku — drives the flash animation */
  lastSaleAt: Record<string, number>;
  soldOutAt: Record<string, number>;
  triggers: AgentTrigger[];
  budget: DailyBudget;
  ticker: Ticker;
  festivalActive: boolean;
  /** epoch ms when the drop lands (null when idle/launched) — components interpolate */
  festivalDropAtMs: number | null;
  connected: boolean;
  /** true only while the socket is open AND events are flowing — drives the offline banner */
  healthy: boolean;
  refresh: () => Promise<void>;
}

/**
 * Consumes the single WS stream (sales + velocity snapshots + trigger updates)
 * and keeps a merged, render-ready model. Countdowns tick client-side between
 * server ticks via `snapshotAt`.
 *
 * Resilience: HTTP polls /api/live/state every 3s regardless of socket health,
 * so a dropped/reconnecting socket never freezes the UI. `healthy` requires an
 * open socket with fresh events — brief reconnect windows don't flash banners.
 */
export function useLive(onEvent?: (e: any) => void): LiveModel {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, VelocitySnapshot>>({});
  const [snapshotAt, setSnapshotAt] = useState<Record<string, number>>({});
  const [lastSaleAt, setLastSaleAt] = useState<Record<string, number>>({});
  const [soldOutAt, setSoldOutAt] = useState<Record<string, number>>({});
  const [triggers, setTriggers] = useState<AgentTrigger[]>([]);
  const [budget, setBudget] = useState<DailyBudget>({ block_id: null, ceilingRupees: 100_000, spentRupees: 0 });
  const [ticker, setTicker] = useState<Ticker>({ unitsLast10s: 0, unitsLast5m: 0 });
  const [festivalActive, setFestivalActive] = useState(false);
  const [festivalDropAtMs, setFestivalDropAtMs] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [healthy, setHealthy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const lastEventAt = useRef<number>(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const ingest = useCallback((e: any) => {
    switch (e.type) {
      case "sale":
        setLastSaleAt((m) => ({ ...m, [e.sku]: Date.now() }));
        break;
      case "sold_out":
        setSoldOutAt((m) => ({ ...m, [e.sku]: Date.now() }));
        break;
      case "velocity":
        setProducts(e.products);
        {
          const now = Date.now();
          const nextS: Record<string, VelocitySnapshot> = {};
          const at: Record<string, number> = {};
          for (const sn of e.snapshots as VelocitySnapshot[]) {
            nextS[sn.sku] = sn;
            at[sn.sku] = now; // arrival time — countdowns interpolate from here
          }
          setSnapshots(nextS);
          setSnapshotAt(at);
        }
        setTicker(e.ticker);
        setBudget(e.budget);
        break;
      case "trigger":
        setTriggers((prev) => mergeTriggers(prev, [e.trigger]));
        break;
      case "trigger_update":
        setTriggers((prev) =>
          prev.map((t) => (t.id === e.trigger.id ? { ...t, ...e.trigger } : t)),
        );
        break;
      case "budget":
        setBudget(e.budget);
        break;
      case "festival_started":
        setFestivalActive(true);
        setFestivalDropAtMs(e.dropAtMs);
        break;
      case "festival_launched":
        setFestivalDropAtMs(null);
        break;
      case "festival_stopped":
        setFestivalActive(false);
        setFestivalDropAtMs(null);
        break;
    }
    onEventRef.current?.(e);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s: LiveState = await api.liveState();
      ingest({ type: "velocity", products: s.products, snapshots: s.snapshots, ticker: s.ticker, budget: s.budget });
      setTriggers((prev) => mergeTriggers(prev, s.triggers));
      setFestivalActive(s.festivalActive);
      // server reports remaining seconds until the drop; convert to a local target
      if (s.festivalDropInS != null && s.festivalDropInS > 0) {
        setFestivalDropAtMs((prev) => prev ?? Date.now() + s.festivalDropInS! * 1000);
      } else if (!s.festivalDropInS) {
        setFestivalDropAtMs(null);
      }
      lastEventAt.current = Date.now();
    } catch {
      /* backend offline — UI shows zeros, banner explains */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // single WS connection with fast-backoff reconnect
  useEffect(() => {
    let disposed = false;
    let retry: number | undefined;
    let attempt = 0;

    const open = () => {
      if (disposed) return;
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const defaultBase = isLocal ? `${location.protocol}//${location.host}` : "https://autonomous-b2b-supply-chain-restocking.onrender.com";
      const baseUrl = import.meta.env.VITE_API_URL || defaultBase;
      const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws";
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          attempt = 0;
          setConnected(true);
          refresh();
        };
        ws.onmessage = (msg) => {
          lastEventAt.current = Date.now();
          let e: any;
          try {
            e = JSON.parse(msg.data);
          } catch {
            return;
          }
          ingest(e);
        };
        ws.onclose = () => {
          setConnected(false);
          if (!disposed) {
            attempt += 1;
            retry = window.setTimeout(open, Math.min(5000, 600 * attempt)); // 0.6s → 5s backoff
          }
        };
        ws.onerror = () => ws.close();
      } catch {
        attempt += 1;
        retry = window.setTimeout(open, Math.min(5000, 600 * attempt));
      }
    };

    open();
    refresh();

    // HTTP fallback poll — keeps the UI alive across reconnect windows
    const poll = window.setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) refresh();
    }, 3000);

    // health watchdog: socket must be open AND events recent
    const watch = window.setInterval(() => {
      const fresh = Date.now() - lastEventAt.current < 7000;
      setHealthy(wsRef.current?.readyState === WebSocket.OPEN && fresh);
    }, 1000);

    return () => {
      disposed = true;
      clearInterval(poll);
      clearInterval(watch);
      if (retry) clearTimeout(retry);
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null; // prevent reconnect scheduling from the closing socket
        ws.close();
      }
    };
  }, [refresh, ingest]);

  return {
    products,
    snapshots,
    snapshotAt,
    lastSaleAt,
    soldOutAt,
    triggers,
    budget,
    ticker,
    festivalActive,
    festivalDropAtMs,
    connected,
    healthy,
    refresh,
  };
}

function mergeTriggers(prev: AgentTrigger[], incoming: AgentTrigger[]): AgentTrigger[] {
  const byId = new Map(prev.map((t) => [t.id, t]));
  for (const t of incoming) byId.set(t.id, { ...byId.get(t.id), ...t });
  return [...byId.values()].sort((a, b) => b.triggeredAtMs - a.triggeredAtMs).slice(0, 40);
}

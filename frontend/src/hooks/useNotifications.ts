import { useCallback, useRef, useState } from "react";
import type { NotificationItem, NotificationSeverity } from "../lib/types";

export interface NotifyInput {
  kind: NotificationItem["kind"];
  severity: NotificationSeverity;
  title: string;
  message: string;
  /** dedupe / rate-limit key — a repeat within `cooldownMs` is dropped */
  key: string;
  tab: NotificationItem["tab"];
  /** blocking modal instead of a toast */
  critical?: boolean;
  cooldownMs?: number;
}

const MAX_ITEMS = 40;
const MAX_TOASTS = 3;
const DEFAULT_COOLDOWN_MS = 45_000;

/**
 * Session-only notification store. One truth for:
 *  - the bell history (+ unseen badge)
 *  - the active toast queue (auto-dismiss handled by ToastStack)
 *  - the single critical alert modal
 *
 * Resets on reload by design (live demo semantics).
 */
export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const [critical, setCritical] = useState<NotificationItem | null>(null);
  const recentKeys = useRef<Map<string, number>>(new Map());

  const notify = useCallback((input: NotifyInput) => {
    const cooldown = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    const last = recentKeys.current.get(input.key);
    const now = Date.now();
    if (last !== undefined && now - last < cooldown) return;

    const pad = Math.random().toString(16).slice(2, 6);
    const item: NotificationItem = {
      id: `n_${now}_${pad}`,
      kind: input.kind,
      severity: input.severity,
      title: input.title,
      message: input.message,
      key: input.key,
      tab: input.tab,
      tsMs: now,
      read: false,
    };
    recentKeys.current.set(input.key, now);
    if (recentKeys.current.size > 200) {
      recentKeys.current.delete(recentKeys.current.keys().next().value as string);
    }

    setItems((prev) => [item, ...prev].slice(0, MAX_ITEMS));
    if (input.critical) {
      setCritical((c) => c ?? item); // queue one modal at a time
    } else {
      setToasts((prev) => [item, ...prev].slice(0, MAX_TOASTS));
    }
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, read: true } : it)));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const acknowledgeCritical = useCallback(() => {
    setCritical(null);
  }, []);

  const unseen = items.filter((it) => !it.read).length;

  return {
    items,
    unseen,
    toasts,
    critical,
    notify,
    markAllRead,
    markRead,
    dismissToast,
    acknowledgeCritical,
  };
}

export function severityInfo(severity: NotificationSeverity): {
  color: string;
  dim: string;
  label: string;
} {
  switch (severity) {
    case "success":
      return { color: "#0e9f6e", dim: "#ecfdf5", label: "DONE" };
    case "warning":
      return { color: "#d97706", dim: "#fef3c7", label: "ATTENTION" };
    case "critical":
      return { color: "#dc2626", dim: "#fee2e2", label: "CRITICAL" };
    default:
      return { color: "#2563eb", dim: "#dbeafe", label: "INFO" };
  }
}
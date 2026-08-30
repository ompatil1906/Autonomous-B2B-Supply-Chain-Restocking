import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { NotificationItem } from "../../lib/types";
import { severityInfo } from "../../hooks/useNotifications";

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: Info,
} as const;

function Toast({
  item,
  onDismiss,
  onOpen,
}: {
  item: NotificationItem;
  onDismiss: (id: string) => void;
  onOpen: (item: NotificationItem) => void;
}) {
  const meta = severityInfo(item.severity);
  const Icon = ICONS[item.severity];

  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(item.id), 6000);
    return () => window.clearTimeout(t);
  }, [item.id, onDismiss]);

  return (
    <button
      onClick={() => onOpen(item)}
      className="w-full flex items-start gap-3 rounded-xl bg-white p-3.5 text-left animate-slide-in cursor-pointer shadow-float"
      style={{ border: `1px solid ${meta.dim}`, borderLeft: `4px solid ${meta.color}` }}
      title="Click to open"
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: meta.dim, color: meta.color }}
      >
        <Icon size={15} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-bold leading-tight" style={{ color: "#0f172a" }}>
          {item.title}
        </span>
        <span className="block text-[11px] mt-0.5 leading-relaxed text-slate-600">{item.message}</span>
      </span>
      <span
        className="shrink-0 text-[9px] font-bold tracking-wider uppercase mt-0.5"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </button>
  );
}

export function ToastStack({
  toasts,
  onDismiss,
  onOpen,
}: {
  toasts: NotificationItem[];
  onDismiss: (id: string) => void;
  onOpen: (item: NotificationItem) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-[76px] right-4 z-[60] w-[340px] max-w-[calc(100vw-2rem)] space-y-2">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} onOpen={onOpen} />
      ))}
    </div>
  );
}
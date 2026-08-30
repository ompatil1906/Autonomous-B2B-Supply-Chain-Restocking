import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { NotificationItem } from "../../lib/types";
import { severityInfo } from "../../hooks/useNotifications";

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: Info,
} as const;

/**
 * Blocking modal for critical events (gate breach / DO NOT BUY, execution
 * failure, festival crash, pool exhausted). One at a time — the store queues.
 */
export function AlertModal({
  item,
  onAcknowledge,
  onNavigate,
}: {
  item: NotificationItem;
  onAcknowledge: () => void;
  onNavigate: (item: NotificationItem) => void;
}) {
  const meta = severityInfo(item.severity);
  const Icon = ICONS[item.severity];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 animate-fade-in" onClick={onAcknowledge} />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-float overflow-hidden animate-slide-in"
        style={{ borderTop: `4px solid ${meta.color}` }}
      >
        <div className="flex items-start justify-between px-6 pt-6 gap-3">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: meta.dim, color: meta.color }}
          >
            <Icon size={19} />
          </span>
          <button
            onClick={onAcknowledge}
            className="p-1 rounded hover:bg-slate-100 cursor-pointer"
            aria-label="Dismiss"
          >
            <X size={16} style={{ color: "#64748b" }} />
          </button>
        </div>

        <div className="px-6 mt-4">
          <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: meta.color }}>
            {meta.label}
          </div>
          <h2 className="text-lg font-bold tracking-tight mt-1" style={{ color: "#0f172a" }}>
            {item.title}
          </h2>
          <p className="text-sm mt-2 leading-relaxed text-slate-600">{item.message}</p>
        </div>

        <div className="flex gap-2 px-6 py-5">
          <button
            onClick={onAcknowledge}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            style={{ border: `1px solid #e2e8f0`, color: "#334155" }}
          >
            Dismiss
          </button>
          <button
            onClick={() => onNavigate(item)}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
            style={{ background: meta.color }}
          >
            View details
          </button>
        </div>
      </div>
    </div>
  );
}
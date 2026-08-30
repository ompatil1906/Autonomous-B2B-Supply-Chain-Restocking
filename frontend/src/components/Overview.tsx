import { AlertCircle, ArrowRight, BellRing, Boxes, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import type { AuditRecord, Inventory, SystemStatus } from "../lib/types";
import type { LiveModel } from "../hooks/useLive";
import { C, inr } from "../lib/theme";
import { KIND_LABELS, payloadSummary, fmtCompact } from "../lib/format";
import { KpiChip } from "./ui/KpiChip";
import { RiskIndicator } from "./ui/RiskIndicator";
import { RevenueAtRiskPanel } from "./RevenueAtRiskPanel";

interface AttentionItem {
  severity: "warning" | "critical" | "blocked" | "watch";
  title: string;
  detail: string;
  onClick?: () => void;
}

export function Overview({
  status,
  inventory,
  audit,
  pendingCount,
  live,
  onOpenMission,
  onOpenApprovals,
}: {
  status: SystemStatus | null;
  inventory: Inventory | null;
  audit: AuditRecord[];
  pendingCount: number;
  live: LiveModel;
  onOpenMission: () => void;
  onOpenApprovals: () => void;
}) {
  const dailyCeiling = status?.ap2_daily_ceiling_inr ?? 100_000;
  const spent = live.budget.spentRupees ?? 0;
  const budgetRemaining = Math.max(0, dailyCeiling - spent);

  const lowStocks = inventory?.catalog.filter((s) => s.stock < s.reorder_threshold) ?? [];
  const criticalCount = live.products.filter((p) => p.status === "critical" || p.status === "escalated").length;
  const attention: AttentionItem[] = [];
  if (pendingCount > 0)
    attention.push({
      severity: "critical",
      title: `${pendingCount} escalation${pendingCount > 1 ? "s" : ""} pending`,
      detail: "Gate or ceiling breach — the agent moved no money and needs your authorization.",
      onClick: onOpenApprovals,
    });
  if (criticalCount > 0)
    attention.push({
      severity: "warning",
      title: `${criticalCount} SKU${criticalCount > 1 ? "s" : ""} critical`,
      detail: "Above the alert line — the agent may trigger an autonomous restock on the next tick.",
    });
  if (lowStocks.length > 0)
    attention.push({
      severity: "watch",
      title: `${lowStocks.length} SKU${lowStocks.length > 1 ? "s" : ""} below reorder threshold`,
      detail: lowStocks.map((s) => `${s.sku}:${s.stock}`).join("  "),
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: C.textHi }}>
          Overview
        </h1>
        <p className="text-sm mt-1 max-w-2xl" style={{ color: C.textLo }}>
          Warden predicts stockouts and procures inventory within strict UPI Reserve Pay boundaries — every
          autonomous execution is recorded, webhook-reconciled and never exceeds its stated cap.
        </p>
      </div>

      {/* What needs attention */}
      {attention.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold tracking-wider mb-2 uppercase" style={{ color: C.textLo }}>
            What needs attention
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {attention.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                disabled={!a.onClick}
                className="rounded-xl p-4 text-left flex flex-col gap-1.5 transition hover:-translate-y-0.5 disabled:hover:translate-y-0"
                style={{ background: C.surface, border: `1px solid ${C.hair}`, boxShadow: a.severity === "critical" ? `0 0 0 1px ${C.redDim}` : undefined }}
              >
                <RiskIndicator severity={a.severity} label={a.title} />
                <span className="text-[11.5px] leading-relaxed" style={{ color: C.textLo }}>{a.detail}</span>
                {a.onClick && (
                  <span className="text-[11px] font-medium inline-flex items-center gap-1" style={{ color: C.accentBlue }}>
                    Open <ArrowRight size={11} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiChip label="Monitored SKUs" value={live.products.length || (inventory?.catalog.length ?? "—")} icon={<Boxes size={14} />} />
        <KpiChip
          label="Daily authority"
          value={fmtCompact(dailyCeiling)}
          icon={<Wallet size={14} />}
          tone={C.brass}
          sub="shared UPI Reserve Pay pool"
        />
        <KpiChip
          label="Committed today"
          value={inr(spent)}
          icon={<TrendingUp size={14} />}
          tone={spent > 0 ? C.green : undefined}
          sub={`${fmtCompact(budgetRemaining)} remaining`}
        />
        <KpiChip
          label="Action required"
          value={attention.filter((a) => a.onClick).length}
          icon={<BellRing size={14} />}
          tone={pendingCount > 0 ? C.red : C.textHi}
          sub={pendingCount ? "escalations awaiting you" : "no merchant action owed"}
        />
      </div>

      {/* Revenue at risk + missions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueAtRiskPanel live={live} inventory={inventory} limit={4} />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
            <div className="text-[11px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.textLo }}>
              Run a scenario
            </div>
            <p className="text-xs mb-4" style={{ color: C.textLo }}>
              Watch the agent reason through supply-chain scenarios step by step, and audit every money event.
            </p>
            <button
              onClick={onOpenMission}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
              style={{ background: C.blue, color: C.surface }}
            >
              <ShieldCheck size={16} /> Enter Mission Control
            </button>
          </div>
        </div>
      </div>

      {/* Activity stream */}
      <div className="lg:col-span-3 rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="text-[11px] font-semibold tracking-wider uppercase mb-4" style={{ color: C.textLo }}>
          Agent activity stream
        </div>
        {audit.length === 0 ? (
          <div className="text-sm py-10 text-center flex flex-col items-center gap-2" style={{ color: C.textLo }}>
            <AlertCircle size={22} style={{ color: C.textMuted }} />
            No agent activity yet — run a scenario or a festival drop.
          </div>
        ) : (
          <div className="space-y-3">
            {audit.slice(0, 6).map((r) => (
              <div key={r.seq} className="flex items-start gap-3 p-3 rounded-lg" style={{ border: `1px solid ${C.hair}` }}>
                <span
                  className="inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-wider px-2 py-1 mt-0.5"
                  style={{
                    background: r.kind === "escalate" ? C.redDim : r.kind === "execute" ? C.greenDim : C.raised,
                    color: r.kind === "escalate" ? C.red : r.kind === "execute" ? C.green : C.textLo,
                  }}
                >
                  {KIND_LABELS[r.kind] ?? r.kind}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: C.textHi }}>
                    {payloadSummary(r)}
                  </div>
                  <div className="text-xs mt-1 mono" style={{ color: C.textMuted }}>
                    {r.ts} · seq {r.seq}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
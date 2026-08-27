import { ArrowRight, ShieldCheck, TrendingUp, Wallet, Boxes, BellRing, AlertTriangle, AlertCircle } from "lucide-react";
import type { AuditRecord, Inventory, SystemStatus } from "../lib/types";
import { C } from "../lib/theme";
import { KIND_LABELS, payloadSummary, fmtCompact } from "../lib/format";
import { MetricCard } from "./ui/MetricCard";

export function Overview({
  status,
  inventory,
  audit,
  pendingCount,
  spentToday,
  onOpenMission,
  onOpenApprovals,
}: {
  status: SystemStatus | null;
  inventory: Inventory | null;
  audit: AuditRecord[];
  pendingCount: number;
  spentToday?: number;
  onOpenMission: () => void;
  onOpenApprovals: () => void;
}) {
  const dailyCeiling = status?.ap2_daily_ceiling_inr ?? 100_000;
  const spent = spentToday ?? 0;
  const budgetRemaining = Math.max(0, dailyCeiling - spent);

  const lowStocks = inventory?.catalog.filter((s) => s.stock < s.reorder_threshold) ?? [];

  return (
    <div className="max-w-[1200px] mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: C.textHi }}>
          Business Intelligence
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: C.textLo }}>
          Warden predicts stockouts and procures inventory autonomously within strict UPI Reserve Pay boundaries.
          No blank checks, zero missed sales.
        </p>
      </div>

      {/* WHAT NEEDS ATTENTION */}
      {(pendingCount > 0 || lowStocks.length > 0) && (
        <div className="mb-8">
          <div className="text-[11px] font-semibold tracking-wider mb-3 uppercase" style={{ color: C.textLo }}>
            What Needs Attention
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingCount > 0 && (
              <div
                className="rounded-xl p-5 flex items-start gap-4 transition-transform hover:-translate-y-0.5 cursor-pointer"
                style={{ background: C.redDim, border: `1px solid rgba(220,38,38,0.3)` }}
                onClick={onOpenApprovals}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: C.surface }}>
                  <BellRing size={20} color={C.red} />
                </div>
                <div>
                  <div className="font-medium text-sm mb-1" style={{ color: C.red }}>
                    {pendingCount} Agent Escalation{pendingCount > 1 ? "s" : ""} Pending
                  </div>
                  <div className="text-xs opacity-90" style={{ color: C.red }}>
                    Agent exceeded autonomous budget and requires merchant authorization to proceed.
                  </div>
                  <div className="mt-3 text-xs font-medium inline-flex items-center gap-1" style={{ color: C.red }}>
                    Review now <ArrowRight size={12} />
                  </div>
                </div>
              </div>
            )}

            {lowStocks.length > 0 && (
              <div
                className="rounded-xl p-5 flex items-start gap-4"
                style={{ background: C.amberDim, border: `1px solid rgba(217,119,6,0.3)` }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: C.surface }}>
                  <AlertTriangle size={20} color={C.amber} />
                </div>
                <div>
                  <div className="font-medium text-sm mb-1" style={{ color: C.amber }}>
                    {lowStocks.length} SKU{lowStocks.length > 1 ? "s" : ""} Below Threshold
                  </div>
                  <div className="text-xs opacity-90" style={{ color: C.amber }}>
                    Inventory critically low. Agent will attempt autonomous restock on next evaluation tick.
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {lowStocks.map(s => (
                      <span key={s.sku} className="text-[10px] mono px-2 py-1 rounded bg-white/50" style={{ color: C.amber }}>
                        {s.sku}: {s.stock} left
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="text-[11px] font-semibold tracking-wider mb-3 uppercase" style={{ color: C.textLo }}>
        Agent Performance
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Monitored SKUs"
          value={inventory?.catalog.length ?? "—"}
          icon={<Boxes size={18} />}
          explanation="Active portfolio under mandate"
        />
        <MetricCard
          label="Daily Authority"
          value={fmtCompact(dailyCeiling)}
          icon={<Wallet size={18} />}
          highlight="brass"
          explanation="Total shared pool (UPI Reserve Pay)"
        />
        <MetricCard
          label="Committed Today"
          value={fmtCompact(spent)}
          icon={<TrendingUp size={18} />}
          highlight={spent > 0 ? "green" : undefined}
          explanation={`${fmtCompact(budgetRemaining)} remaining in pool`}
        >
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: C.raised }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(100, (spent / dailyCeiling) * 100)}%`,
                background: C.green
              }}
            />
          </div>
        </MetricCard>
        <MetricCard
          label="Action Required"
          value={pendingCount}
          icon={<BellRing size={18} />}
          highlight={pendingCount > 0 ? "red" : undefined}
          explanation="Escalations awaiting merchant"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECENT ACTIVITY */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: C.textLo }}>
              Agent Activity Stream
            </span>
          </div>

          {audit.length === 0 ? (
            <div className="text-sm py-12 text-center flex flex-col items-center justify-center gap-3" style={{ color: C.textLo }}>
              <AlertCircle size={24} style={{ color: C.textMuted }} />
              <div>No agent activity yet.<br />Open Live Ops or run a scenario to begin.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {audit.slice(0, 5).map((r) => (
                <div key={r.seq} className="flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-slate-50" style={{ border: `1px solid ${C.hair}` }}>
                  <div className="mt-0.5">
                    <span
                      className="inline-flex items-center justify-center rounded text-[10px] font-semibold uppercase tracking-wider px-2 py-1"
                      style={{
                        background: r.kind === 'escalate' ? C.redDim : r.kind === 'execute' ? C.greenDim : C.raised,
                        color: r.kind === 'escalate' ? C.red : r.kind === 'execute' ? C.green : C.textLo
                      }}
                    >
                      {KIND_LABELS[r.kind] ?? r.kind}
                    </span>
                  </div>
                  <div className="flex-1">
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

        {/* QUICK ACTIONS */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
            <div className="text-[11px] font-semibold tracking-wider uppercase mb-4" style={{ color: C.textLo }}>
              Simulate Scenarios
            </div>
            <p className="text-xs mb-4" style={{ color: C.textLo }}>
              Watch the agent reason through real-world supply chain scenarios step-by-step.
            </p>
            <button
              onClick={onOpenMission}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: C.blue, color: C.surface }}
            >
              <ShieldCheck size={16} /> Enter Live Intel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

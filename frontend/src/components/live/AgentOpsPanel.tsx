import { useState } from "react";
import { ArrowRight, Gavel, Lock, ReceiptText, ShieldAlert } from "lucide-react";
import { C } from "../../lib/theme";
import type { AgentTrigger, AuditRecord, DailyBudget } from "../../lib/types";
import { TriggerCard } from "./TriggerCard";
import { SectionHeader } from "./ui";
import { KIND_LABELS } from "../../lib/format";

export function AgentOpsPanel({
  budget,
  triggers,
  ledgerTail,
  onApprove,
  onReject,
  actionBusy,
  onOpenLedger,
}: {
  budget: DailyBudget;
  triggers: AgentTrigger[];
  ledgerTail: AuditRecord[];
  onApprove: (t: AgentTrigger) => void;
  onReject: (t: AgentTrigger) => void;
  actionBusy: boolean;
  onOpenLedger: () => void;
}) {
  const pct = Math.min(100, (budget.spentRupees / budget.ceilingRupees) * 100);
  const breached = triggers.some(
    (t) =>
      t.outcome === "escalated" &&
      t.gate?.checks?.some((c) => c.name === "daily_portfolio_cap" && !c.passed),
  );
  const leverState: "idle" | "closed" | "tripped" =
    breached ? "tripped" : budget.spentRupees > 0 ? "closed" : "idle";

  return (
    <div className="flex flex-col gap-6 min-h-0">
      {/* daily authority */}
      <div>
        <SectionHeader
          title="AUTONOMOUS OPERATIONS"
          icon={<Gavel size={14} color={C.brass} />}
          right={
            <span className="text-[10px]" style={{ color: C.textLo }}>
              Live execution feed
            </span>
          }
        />
        <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase" style={{ color: C.textLo }}>
              <Lock size={14} color={C.brass} /> Spending Authority
            </span>
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase"
              style={{
                color: leverState === "tripped" ? C.red : leverState === "closed" ? C.green : C.textLo,
                background: leverState === "tripped" ? C.redDim : leverState === "closed" ? C.greenDim : C.raised,
              }}
            >
              {leverState === "tripped" ? "Tripped" : leverState === "closed" ? "Engaged" : "Standing By"}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className="mono text-2xl font-semibold leading-none tracking-tight"
              style={{ color: breached || pct >= 90 ? C.red : C.textHi }}
            >
              ₹{Math.round(budget.spentRupees).toLocaleString("en-IN")}
            </span>
            <span className="mono text-sm" style={{ color: C.textLo }}>
              / ₹{Math.round(budget.ceilingRupees).toLocaleString("en-IN")}
            </span>
          </div>

          <div className="h-2 rounded-full overflow-hidden mt-3" style={{ background: C.raised }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: breached || pct >= 90 ? C.red : C.brass }}
            />
          </div>

          <div className="flex justify-between items-center mt-2.5 text-xs">
            <span style={{ color: C.textLo }}>
              Resets at midnight IST
            </span>
            <span className="font-medium" style={{ color: breached ? C.red : C.textHi }}>
              ₹{Math.round(Math.max(0, budget.ceilingRupees - budget.spentRupees)).toLocaleString("en-IN")} left
            </span>
          </div>

          {breached && (
            <div className="mt-4 text-xs rounded-lg pl-3 pr-2 py-2.5 leading-snug flex items-start gap-2" style={{ background: C.redDim, color: C.red, borderLeft: `3px solid ${C.red}` }}>
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              Agent attempted purchase that exceeded the daily ceiling. Purchase escalated for manual review.
            </div>
          )}
        </div>
      </div>

      {/* trigger feed */}
      <div>
        <SectionHeader
          title={`AGENT DECISIONS — ${triggers.length} TODAY`}
          icon={<ReceiptText size={14} style={{ color: C.textLo }} />}
        />
        <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 480px)" }}>
          {triggers.map((t) => (
            <TriggerCard
              key={t.id}
              trigger={t}
              onApprove={onApprove}
              onReject={onReject}
              actionBusy={actionBusy}
            />
          ))}
          {!triggers.length && (
            <div
              className="rounded-xl py-10 text-center text-sm flex flex-col items-center justify-center gap-2"
              style={{ background: C.surface, border: `1px dashed ${C.hairStrong}`, color: C.textLo }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.raised }}>
                <ReceiptText size={18} style={{ color: C.textMuted }} />
              </div>
              <div>
                <span className="font-medium text-slate-600 block mb-1">No autonomous decisions yet</span>
                <span className="text-xs">Agent will act when velocity predicts a stockout.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* hash-chain tail */}
      <LedgerTail records={ledgerTail} onOpenLedger={onOpenLedger} />
    </div>
  );
}

function LedgerTail({ records, onOpenLedger }: { records: AuditRecord[]; onOpenLedger: () => void }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: C.textLo }}>
          Tamper-Evident Ledger
        </span>
        <button
          onClick={onOpenLedger}
          className="inline-flex items-center gap-1 text-[11px] font-medium hover:opacity-80 transition-opacity"
          style={{ color: C.brass }}
        >
          View Full Chain <ArrowRight size={12} />
        </button>
      </div>
      <div className="space-y-0.5">
        {records.slice(0, 5).map((r) => (
          <div
            key={r.seq}
            onMouseEnter={() => setHover(r.seq)}
            onMouseLeave={() => setHover(null)}
            className="flex items-center gap-3 mono text-[11px] px-2 py-1.5 rounded-lg cursor-default transition-colors"
            style={{ background: hover === r.seq ? C.raised : "transparent" }}
            title={`seq #${r.seq} · prev ${r.prev_hash?.slice(0, 16)}… → hash ${r.hash?.slice(0, 16)}…`}
          >
            <span style={{ color: C.textMuted, width: 24 }}>#{r.seq}</span>
            <span className="truncate font-medium" style={{ color: C.textHi }}>
              {KIND_LABELS[r.kind] ?? r.kind}
            </span>
            <span className="ml-auto truncate opacity-70" style={{ color: C.textLo }}>
              {r.hash?.slice(0, 8)}…
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

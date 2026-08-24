import { useState } from "react";
import { ArrowRight, Gavel, Lock } from "lucide-react";
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
    <div className="flex flex-col gap-5 min-h-0">
      {/* daily authority — one shared pool for every SKU */}
      <div>
        <SectionHeader
          title="AGENT OPS"
          icon={<Gavel size={11} color={C.brass} />}
          right={
            <span className="text-[9px]" style={{ color: C.textLo }}>
              every rupee the agent spends, live
            </span>
          }
        />
        <div className="rounded-xl px-4 py-3.5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: C.textLo }}>
              <Lock size={11} color={C.brass} /> Daily agent authority
            </span>
            <span
              className="mono text-[9px] px-2 py-0.5 rounded-full font-semibold tracking-wide"
              style={{
                color: leverState === "tripped" ? C.red : leverState === "closed" ? C.green : C.textLo,
                background: leverState === "tripped" ? C.redDim : leverState === "closed" ? C.greenDim : C.raised,
              }}
            >
              {leverState === "tripped" ? "TRIPPED · HUMAN REQUIRED" : leverState === "closed" ? "ENGAGED" : "STANDING BY"}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span
              className="mono text-xl font-semibold leading-none"
              style={{ color: breached || pct >= 90 ? C.red : C.textHi }}
            >
              ₹{Math.round(budget.spentRupees).toLocaleString("en-IN")}
            </span>
            <span className="mono text-[12px]" style={{ color: C.textLo }}>
              of ₹{Math.round(budget.ceilingRupees).toLocaleString("en-IN")} today
            </span>
          </div>

          <div className="h-1.5 rounded-full overflow-hidden mt-2.5" style={{ background: C.raised }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: breached || pct >= 90 ? C.red : C.brass }}
            />
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="mono text-[10px]" style={{ color: C.textLo }}>
              resets at midnight IST · all SKUs share this pool
            </span>
            <span
              className="mono text-[10px] font-medium"
              style={{ color: breached ? C.red : C.textHi }}
            >
              ₹{Math.round(Math.max(0, budget.ceilingRupees - budget.spentRupees)).toLocaleString("en-IN")} left
            </span>
          </div>

          {breached && (
            <div className="mt-3 text-[11px] rounded-r-lg pl-2.5 pr-2 py-2 leading-snug" style={{ background: C.redDim, color: C.red, borderLeft: `3px solid ${C.red}` }}>
              A restock tried to push past today's ceiling — the gate refused it and asked a human instead.
            </div>
          )}
        </div>
      </div>

      {/* trigger feed */}
      <div>
        <SectionHeader
          title={`TRIGGER FEED — ${triggers.length} RUN${triggers.length === 1 ? "" : "S"} TODAY`}
          icon={<Gavel size={11} color={C.brass} />}
        />
        <div className="space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: "calc(100vh - 430px)" }}>
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
              className="rounded-xl py-8 text-center text-sm"
              style={{ background: C.surface, border: `1px dashed ${C.hairStrong}`, color: C.textLo }}
            >
              No purchases yet.
              <div className="text-xs mt-1" style={{ color: C.textLo }}>
                The agent watches sales velocity — not just stock levels.
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
    <div className="rounded-xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold tracking-[0.08em]" style={{ color: C.textLo }}>
          AUDIT LEDGER · HASH-CHAINED
        </span>
        <button
          onClick={onOpenLedger}
          className="inline-flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity"
          style={{ color: C.brass }}
        >
          view full ledger <ArrowRight size={10} />
        </button>
      </div>
      <div className="space-y-px">
        {records.slice(0, 6).map((r) => (
          <div
            key={r.seq}
            onMouseEnter={() => setHover(r.seq)}
            onMouseLeave={() => setHover(null)}
            className="flex items-center gap-2 mono text-[10px] px-1.5 py-1 rounded cursor-default transition-colors"
            style={{ background: hover === r.seq ? C.raised : "transparent" }}
            title={`seq #${r.seq} · prev ${r.prev_hash?.slice(0, 16)}… → hash ${r.hash?.slice(0, 16)}…`}
          >
            <span style={{ color: C.textLo }}>#{r.seq}</span>
            <span className="truncate" style={{ color: C.textHi }}>
              {KIND_LABELS[r.kind] ?? r.kind}
            </span>
            <span className="ml-auto truncate" style={{ color: C.textLo }}>
              {r.hash?.slice(0, 8)}…
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

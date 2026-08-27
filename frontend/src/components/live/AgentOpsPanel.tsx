import { ArrowRight, ShieldAlert } from "lucide-react";
import { C, inr } from "../../lib/theme";
import type { AgentTrigger, AuditRecord, DailyBudget } from "../../lib/types";
import { KIND_LABELS } from "../../lib/format";

export function AgentOpsPanel({
  budget,
  triggers,
  ledgerTail,
  onOpenLedger,
}: {
  budget: DailyBudget;
  triggers: AgentTrigger[];
  ledgerTail: AuditRecord[];
  onOpenLedger: () => void;
}) {
  const pct = Math.min(100, (budget.spentRupees / budget.ceilingRupees) * 100);
  const breached = triggers.some(
    (t) => t.outcome === "escalated" && t.gate?.checks?.some((c) => c.name === "daily_portfolio_cap" && !c.passed),
  );

  return (
    <div className="flex flex-col gap-10 min-h-0">
      {/* Sleek Budget Progress */}
      <div>
        <div className="flex justify-between items-end mb-2">
          <div className="text-sm font-semibold uppercase tracking-wide" style={{ color: C.textLo }}>Daily Budget</div>
          <div className="text-sm mono">
            <span className="font-semibold" style={{ color: breached || pct >= 90 ? C.red : C.textHi }}>
              ₹{Math.round(budget.spentRupees).toLocaleString("en-IN")}
            </span>
            <span style={{ color: C.textMuted }}> / ₹{Math.round(budget.ceilingRupees).toLocaleString("en-IN")}</span>
          </div>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: C.raised }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: breached || pct >= 90 ? C.red : C.brass }} />
        </div>
        {breached && (
          <div className="mt-3 text-[11px] font-medium rounded-md px-2 py-1.5 flex items-center gap-2" style={{ background: C.redDim, color: C.red, borderLeft: `2px solid ${C.red}` }}>
            <ShieldAlert size={12} /> Daily ceiling exceeded. Escalated for review.
          </div>
        )}
      </div>

      {/* Agent Action Log Table */}
      <div>
        <div className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: C.textLo }}>Agent Action Log</div>
        <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead style={{ background: C.raised, borderBottom: `1px solid ${C.hair}` }}>
              <tr>
                <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>Time</th>
                <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>SKU</th>
                <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>Action</th>
                <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Cost</th>
                <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.hair }}>
              {triggers.map((t) => {
                const isEscalated = t.outcome === "escalated";
                const isFailed = t.outcome === "failed";
                const isSuccess = t.outcome === "executed";
                const statusColor = isEscalated || isFailed ? C.red : isSuccess ? C.green : C.brass;
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 mono text-[10px]" style={{ color: C.textLo }}>
                      {new Date(t.triggeredAtMs).toLocaleTimeString("en-IN", { hour12: false })}
                    </td>
                    <td className="px-4 py-2.5 mono text-[11px]" style={{ color: C.textHi }}>
                      {t.sku.replace("SKU-", "")}
                    </td>
                    <td className="px-4 py-2.5 text-[11px]" style={{ color: C.textLo }}>
                      {t.quantity ? `Purchased ${t.quantity} units` : "Checking stock"}
                    </td>
                    <td className="px-4 py-2.5 mono text-[11px] text-right" style={{ color: C.textHi }}>
                      {t.amountInr ? inr(t.amountInr) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full" style={{ color: statusColor, background: isEscalated || isFailed ? C.redDim : isSuccess ? C.greenDim : C.brassDim }}>
                        {t.outcome.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!triggers.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[11px]" style={{ color: C.textMuted }}>
                    No autonomous actions yet today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hash-chain tail (Minimal) */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.textLo }}>Tamper-Evident Ledger</span>
          <button onClick={onOpenLedger} className="inline-flex items-center gap-1 text-[10px] font-medium hover:opacity-80 transition-opacity" style={{ color: C.brass }}>
            View Full <ArrowRight size={10} />
          </button>
        </div>
        <div className="font-mono text-[10px] space-y-1.5 p-3 rounded-lg" style={{ background: "#FAFAFA", border: `1px solid ${C.hair}` }}>
          {ledgerTail.slice(0, 5).map((r) => (
            <div key={r.seq} className="flex items-center gap-3" style={{ color: C.textLo }}>
              <span className="w-8 opacity-50">#{r.seq}</span>
              <span className="w-36 truncate">{KIND_LABELS[r.kind] ?? r.kind}</span>
              <span className="opacity-40">{r.hash?.slice(0, 16)}…</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

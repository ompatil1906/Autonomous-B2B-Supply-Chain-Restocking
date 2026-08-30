import { Ban, CheckCircle2, TriangleAlert } from "lucide-react";
import type {
  EconomicDecision,
  FinancialExecution,
  Reconciliation,
  RevenueRiskResult,
  RunResult,
} from "../lib/types";
import { C, inr } from "../lib/theme";
import { Drawer } from "./ui/Drawer";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { StatusBadge } from "./ui/StatusBadge";

/**
 * Decision evidence & receipt — the full audit trail behind one restock
 * decision. For DO NOT BUY decisions the top message is mandatory:
 * "DO NOT BUY — No Money Moved".
 */
export function DecisionEvidence({
  open,
  onClose,
  run,
  decision,
  reconciliation,
  execution,
  sku,
}: {
  open: boolean;
  onClose: () => void;
  run?: RunResult | null;
  decision?: EconomicDecision | null;
  reconciliation?: Reconciliation | null;
  execution?: FinancialExecution | null;
  sku: string;
}) {
  const effectiveDecision = decision ?? run?.decision ?? null;
  const effectiveGate = run?.gate ?? null;
  const effectiveRecon = reconciliation ?? run?.reconciliation ?? null;
  const effectiveExec = execution ?? run?.execution ?? null;

  const blocked =
    effectiveDecision?.action === "DO_NOT_BUY" ||
    run?.status === "blocked" ||
    (!!effectiveGate && !effectiveGate.passed);
  const settled = effectiveRecon?.state === "MATCHED";

  const risk: RevenueRiskResult | null = effectiveDecision
    ? {
        sku: effectiveDecision.sku,
        time_to_stockout_s: null,
        supplier_lead_time_s: 90,
        risk_window_s: 90,
        expected_demand_in_window: 0,
        available_stock: 0,
        expected_lost_units: 0,
        revenue_at_risk_inr: effectiveDecision.revenue_at_risk_inr ?? 0,
        contribution_at_risk_inr: effectiveDecision.contribution_at_risk_inr ?? 0,
        proposed_quantity: effectiveDecision.quantity ?? 0,
        procurement_cost_inr: effectiveDecision.procurement_cost_inr ?? 0,
        contribution_protected_inr: effectiveDecision.contribution_protected_inr ?? 0,
        protection_spend_ratio: effectiveDecision.protection_spend_ratio ?? 0,
        assumptions: {},
      }
    : run?.revenue_risk ?? null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Decision evidence · ${sku}`}
      subtitle={effectiveDecision?.decision_id ?? run?.scenario ?? "restock"}
      width={560}
    >
      <div className="space-y-4">
        {blocked ? (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: C.redDim, border: `1px solid ${C.red}`, color: C.red }}
          >
            <Ban size={20} className="mt-0.5 shrink-0" fill="currentColor" stroke="white" />
            <div className="flex-1">
              <div className="text-[16px] font-bold leading-tight">DO NOT BUY — No Money Moved</div>
              <div className="text-[12px] mt-1 leading-relaxed" style={{ color: C.textLo }}>
                The AP2-inspired boundary gate rejected this order. No payment order was created, no funds left the
                reserve pool.
              </div>
            </div>
          </div>
        ) : settled ? (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: C.greenDim, border: `1px solid ${C.green}`, color: C.green }}
          >
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-[15px] font-bold leading-tight">RECONCILED — webhook verified</div>
              <div className="text-[12px] mt-1" style={{ color: C.textLo }}>
                {inr(effectiveRecon?.actual_amount_inr)} matched to expected {inr(effectiveRecon?.expected_amount_inr)}.
              </div>
            </div>
          </div>
        ) : run?.status === "executed" ? (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: C.amberDim, border: `1px solid rgba(217,119,6,0.4)`, color: C.amber }}
          >
            <TriangleAlert size={20} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-[15px] font-bold leading-tight">AWAITING WEBHOOK</div>
              <div className="text-[12px] mt-1" style={{ color: C.textLo }}>
                Order executed but Razorpay's payment event has not reconciled yet.
              </div>
            </div>
          </div>
        ) : null}

        <ExecutionTimeline
          run={run}
          execution={effectiveExec}
          reconciliation={effectiveRecon}
          decision={effectiveDecision}
        />

        {effectiveDecision && (
          <div className="rounded-xl p-4" style={{ background: C.raised, border: `1px solid ${C.hair}` }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider mb-2" style={{ color: C.textMuted }}>
              Agent rationale
            </div>
            <p className="text-[12.5px] leading-relaxed" style={{ color: C.textHi }}>
              {effectiveDecision.rationale}
            </p>
            {effectiveDecision.factors.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {effectiveDecision.factors.map((f, i) => (
                  <span
                    key={i}
                    className="text-[10.5px] px-2 py-0.5 rounded"
                    style={{ background: C.surface, border: `1px solid ${C.hair}`, color: C.textLo }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {risk && (risk.revenue_at_risk_inr > 0 || risk.contribution_at_risk_inr > 0) && (
          <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider mb-2" style={{ color: C.textMuted }}>
              Revenue at risk (agent formula)
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11.5px] mono">
              <span style={{ color: C.textLo }}>revenue at risk</span>
              <span style={{ color: risk.revenue_at_risk_inr > 0 ? C.heat : C.textHi }}>{inr(risk.revenue_at_risk_inr)}</span>
              <span style={{ color: C.textLo }}>contribution at risk</span>
              <span style={{ color: C.textHi }}>{inr(risk.contribution_at_risk_inr)}</span>
              <span style={{ color: C.textLo }}>contribution protected</span>
              <span style={{ color: C.textHi }}>{inr(risk.contribution_protected_inr)}</span>
              <span style={{ color: C.textLo }}>procurement cost</span>
              <span style={{ color: C.textHi }}>{inr(risk.procurement_cost_inr)}</span>
              <span style={{ color: C.textLo }}>protection : spend</span>
              <span style={{ color: C.textHi }}>{risk.protection_spend_ratio.toFixed(3)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap text-[12px]" style={{ color: C.textLo }}>
          <StatusBadge status={effectiveDecision?.action ?? run?.status ?? "—"} />
          <span className="mono ml-auto">
            {effectiveRecon?.execution_id?.slice(0, 10) ?? effectiveExec?.execution_id?.slice(0, 10) ?? "no execution id"}
          </span>
        </div>
      </div>
    </Drawer>
  );
}
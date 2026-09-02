import { useEffect, useState } from "react";
import { Ban, Package } from "lucide-react";
import type { EconomicDecision, Reconciliation } from "../lib/types";
import type { LiveModel } from "../hooks/useLive";
import { api } from "../lib/api";
import { C, inr } from "../lib/theme";
import { StatusBadge } from "./ui/StatusBadge";
import { EmptyState } from "./ui/EmptyState";
import { ErrorState } from "./ui/ErrorState";
import { Skeleton } from "./ui/Skeleton";
import { DecisionEvidence } from "./DecisionEvidence";

interface PipelineRow {
  key: string;
  tsMs: number;
  sku: string;
  name: string;
  reason: string;
  qty: number | null;
  action: string;
  unitPrice: number | null;
  total: number | null;
  moneyMoved: number | null;
  verified: { state: string; detail: string } | null;
  decisionId?: string;
  status: string;
  inFlight: boolean;
  error?: string;
}

/** Restock Pipeline — one honest feed of every restock decision: in-flight live
 * triggers from the WS + recorded economic decisions (incl. BLOCKED / DO NOT
 * BUY, where no money moved). */
export function RestockPipelineScreen({ live }: { live: LiveModel }) {
  const [decisions, setDecisions] = useState<EconomicDecision[]>([]);
  const [recons, setRecons] = useState<Reconciliation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState<{
    decision: EconomicDecision | null;
    reconciliation: Reconciliation | null;
    sku: string;
  } | null>(null);

  const openEvidence = async (decisionId: string, sku: string) => {
    try {
      const d = await api.decision(decisionId);
      setSel({ decision: d.decision, reconciliation: d.reconciliation ?? null, sku });
    } catch {
      setSel({ decision: null, reconciliation: null, sku });
    }
  };

  useEffect(() => {
    Promise.all([api.decisions(), api.reconciliations()])
      .then(([d, r]) => {
        setDecisions(d.decisions);
        setRecons(r.reconciliations);
        setLoaded(true);
      })
      .catch((e: Error) => {
        setLoadError(e.message);
        setLoaded(true);
      });
  }, [live.triggers]);

  const reconsByDecision = new Map(recons.map((r) => [r.decision_id, r]));
  const productName = (sku: string) => live.products.find((p) => p.sku === sku)?.name ?? sku;

  // A live trigger already carries the latest state for a decision — drop the
  // overlapping persisted row so each decision appears exactly once.
  const liveDecisionIds = new Set(
    live.triggers.filter((t) => t.decisionId).map((t) => t.decisionId),
  );

  const triggerRows: PipelineRow[] = live.triggers.map((t) => {
    const rec = t.reconciliation;
    const executedClear = t.outcome === "executed" && (rec?.state === "RECONCILED" || rec?.state === "MATCHED");
    const money = rec?.actual_amount_inr ?? t.amountInr ?? 0;
    return {
      key: `t:${t.id}`,
      tsMs: t.completedAtMs ?? t.triggeredAtMs,
      sku: t.sku,
      name: productName(t.sku),
      reason: t.reason.replace(/_/g, " "),
      qty: t.quantity ?? null,
      action: t.supplierAction ?? "",
      unitPrice: t.revenueRisk?.proposed_quantity && money ? null : null,
      total: t.amountInr ?? null,
      moneyMoved: executedClear ? money : null,
      verified: rec
        ? {
            state: rec.state,
            detail:
              rec.state === "RECONCILED" || rec.state === "MATCHED"
                ? `webhook ${rec.events.length} event(s) · order ${String(rec.order_id).slice(0, 8)}`
                : rec.events.length ? `awaiting webhook · ${rec.events.length} event(s)` : "in flight",
          }
        : null,
      decisionId: t.decisionId,
      status: t.outcome,
      inFlight: t.outcome === "in_progress",
    };
  });

  const decisionRows: PipelineRow[] = decisions
    .filter((d) => !liveDecisionIds.has(d.decision_id))
    .map((d) => {
    const rec = reconsByDecision.get(d.decision_id);
    const base = ["DO_NOT_BUY", "WAIT", "ESCALATE"].includes(d.action);
    const unit = base
      ? null
      : d.unit_price_inr ?? (d.procurement_cost_inr && d.quantity ? d.procurement_cost_inr / d.quantity : null);
    const total = base ? 0 : d.total_inr ?? d.procurement_cost_inr ?? null;
    const moneyMoved =
      base
        ? 0
        : rec && (rec.state === "RECONCILED" || rec.state === "MATCHED")
          ? rec.actual_amount_inr ?? null
          : null;
    const blocked = d.action === "DO_NOT_BUY" || d.action === "ESCALATE";
    return {
      key: `d:${d.decision_id}`,
      tsMs: d.created_at ? new Date(d.created_at).getTime() : 0,
      sku: d.sku,
      name: productName(d.sku),
      reason: d.factors.join(" · ") || d.rationale,
      qty: base ? null : d.quantity,
      action: d.action,
      unitPrice: unit,
      total,
      moneyMoved,
      verified: rec
        ? {
            state: rec.state,
            detail: rec.state === "RECONCILED" || rec.state === "MATCHED" ? rec.events.length ? `webhook · ${rec.events.length} event(s)` : "reconciled" : "awaiting webhook",
          }
        : blocked
          ? { state: "BLOCKED", detail: "no money moved" }
          : null,
      decisionId: d.decision_id,
      status: blocked ? "BLOCKED" : d.action,
      inFlight: false,
    };
  });

  const rows = [...triggerRows, ...decisionRows]
    .filter((r) => r.tsMs > 0)
    .sort((a, b) => b.tsMs - a.tsMs)
    .slice(0, 60);

  const blockedCount = rows.filter((r) => r.action === "DO_NOT_BUY" || r.action === "ESCALATE" || r.status === "BLOCKED").length;
  const inFlightCount = rows.filter((r) => r.inFlight).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: C.textLo }}>
        <span className="px-2.5 py-1 rounded-md" style={{ background: C.raised, border: `1px solid ${C.hair}` }}>
          <span className="font-semibold" style={{ color: C.textHi }}>{rows.length}</span> decisions shown
        </span>
        {inFlightCount > 0 && (
          <span className="px-2.5 py-1 rounded-md" style={{ background: C.accentBlueDim, color: C.accentBlue, border: `1px solid rgba(37,99,235,0.3)` }}>
            {inFlightCount} in flight
          </span>
        )}
        {blockedCount > 0 && (
          <span className="px-2.5 py-1 rounded-md flex items-center gap-1" style={{ background: C.redDim, color: C.red, border: `1px solid rgba(220,38,38,0.35)` }}>
            <Ban size={12} /> {blockedCount} blocked — no money moved
          </span>
        )}
      </div>

      {loadError && (
        <ErrorState
          title="Pipeline history unreachable"
          body={`GET /api/decisions + /api/reconciliations failed: ${loadError}. Live in-flight triggers are still shown below.`}
        />
      )}

      <div className="rounded-xl" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: C.hair }}>
          <h2 className="text-[15px] font-semibold" style={{ color: C.textHi }}>Restock Pipeline</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider" style={{ color: C.textMuted }}>
                {["SKU", "Decision · reason", "Qty", "Unit price", "Total", "Money moved", "Verified with", "Status"].map((h) => (
                  <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loaded &&
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={8}><Skeleton className="h-4 w-full my-3" /></td></tr>)}
              {loaded && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-5">
                    <EmptyState
                      title="No restock decisions yet"
                      body="Run a scenario from Demo scenarios or a festival drop, and decisions appear here — including blocked ones."
                      icon={<Package size={20} />}
                    />
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const isBlocked = r.action === "DO_NOT_BUY" || r.action === "ESCALATE" || r.status === "BLOCKED";
                return (
                  <tr
                    key={r.key}
                    onClick={() => r.decisionId && openEvidence(r.decisionId, r.sku)}
                    className="border-t transition-colors"
                    style={{
                      borderColor: C.hair,
                      background: isBlocked ? C.redDim : undefined,
                      cursor: r.decisionId ? "pointer" : undefined,
                    }}
                    onMouseEnter={(e) => r.decisionId && (e.currentTarget.style.background = isBlocked ? C.redDim : C.raised)}
                    onMouseLeave={(e) => { if (r.decisionId) e.currentTarget.style.background = isBlocked ? C.redDim : ""; }}
                  >
                    <td className="px-5 py-3">
                      <div className="mono text-[12px]" style={{ color: C.textHi }}>{r.sku}</div>
                      <div className="text-[11px] truncate max-w-[160px]" style={{ color: C.textLo }}>{r.name}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-[12px] font-medium" style={{ color: isBlocked ? C.red : C.textHi }}>
                        {isBlocked ? "DO NOT BUY — No Money Moved" : r.action || "in progress"}
                      </div>
                      <div className="text-[10.5px] truncate max-w-[260px]" style={{ color: C.textMuted }}>
                        {r.reason}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[12px] mono" style={{ color: C.textLo }}>
                      {r.qty ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-[12px] mono" style={{ color: C.textLo }}>
                      {r.unitPrice ? inr(r.unitPrice) : "—"}
                    </td>
                    <td className="px-5 py-3 text-[12px] mono" style={{ color: r.total ? C.textHi : C.textMuted }}>
                      {r.total ? inr(r.total) : "—"}
                    </td>
                    <td className="px-5 py-3 text-[12px] mono font-semibold" style={{ color: r.moneyMoved ? C.green : C.textMuted }}>
                      {r.moneyMoved ? inr(r.moneyMoved) : isBlocked ? "₹0.00" : "pending"}
                    </td>
                    <td className="px-5 py-3 text-[11px]" style={{ color: C.textLo }}>
                      {r.verified ? (
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={r.verified.state} label={r.verified.state.replace(/_/g, " ")} />
                          {r.verified.detail && r.verified.detail !== "reconciled" && (
                            <span className="truncate max-w-[180px]" title={r.verified.detail}>{r.verified.detail}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: C.textMuted }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status === "executed" ? "executed" : r.inFlight ? r.status : isBlocked ? "BLOCKED" : r.action} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    <DecisionEvidence
        open={!!sel}
        onClose={() => setSel(null)}
        decision={sel?.decision}
        reconciliation={sel?.reconciliation}
        sku={sel?.sku ?? "—"}
      />
    </div>
  );
}
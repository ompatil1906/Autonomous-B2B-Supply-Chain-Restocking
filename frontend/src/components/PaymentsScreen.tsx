import { useEffect, useState } from "react";
import { Receipt, ShieldCheck, Webhook } from "lucide-react";
import type { FinancialExecution, Reconciliation, WebhookEvent } from "../lib/types";
import { api } from "../lib/api";
import { C, inr } from "../lib/theme";
import { KpiChip } from "./ui/KpiChip";
import { StatusBadge } from "./ui/StatusBadge";
import { EmptyState } from "./ui/EmptyState";
import { ErrorState } from "./ui/ErrorState";
import { SkeletonRow } from "./ui/Skeleton";

/** Payments — the Razorpay activity surface. Every leg is labelled honestly:
 * remote_test = TEST MODE — VERIFIED, simulation = SIMULATED FALLBACK,
 * failed = EXECUTION FAILED — NO MONEY MOVED. */
const LEG_LABEL: Record<string, string> = {
  remote_test: "TEST MODE — VERIFIED",
  simulation: "SIMULATED FALLBACK",
};

const LEG_TONE: Record<string, string> = {
  test: C.accentBlue,
  simulated: C.amber,
  fallback: C.amber,
  failed: C.red,
  real: C.green,
};

export function PaymentsScreen() {
  const [data, setData] = useState<{ executions: FinancialExecution[]; reconciliations: Reconciliation[]; webhooks: WebhookEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .razorpayActivity()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  const executions = data?.executions ?? [];
  const reconciled = executions.filter((e) => e.reconciliation_state === "RECONCILED" || e.reconciliation_state === "MATCHED").length;
  const legit = executions.flatMap((e) => e.legs).filter((l) => l.status === "real").length;

  return (
    <div className="space-y-6">
      {error && <ErrorState title="Razorpay activity unreachable" body={`GET /api/razorpay/activity failed: ${error}`} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiChip label="Executions" value={executions.length} icon={<Receipt size={14} />} />
        <KpiChip label="Reconciled" value={reconciled} sub={reconciled ? `webhook-verified` : "none yet"} tone={reconciled ? C.green : undefined} />
        <KpiChip label="Legit (Razorpay REAL)" value={legit} icon={<ShieldCheck size={14} />} />
        <KpiChip label="Webhook events" value={data?.webhooks.length ?? 0} icon={<Webhook size={14} />} />
      </div>

      <ExecutionTable executions={executions} loaded={loaded} />
      <ReconciliationTable recons={data?.reconciliations ?? []} loaded={loaded} />
      <WebhookTable events={data?.webhooks ?? []} loaded={loaded} />
    </div>
  );
}

function ExecutionTable({ executions, loaded }: { executions: FinancialExecution[]; loaded: boolean }) {
  return (
    <div className="rounded-xl" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: C.hair }}>
        <h2 className="text-[15px] font-semibold" style={{ color: C.textHi }}>Executions & legs</h2>
        <p className="text-[11px] mt-0.5" style={{ color: C.textLo }}>Every payment leg the agent submitted, with its true state</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider" style={{ color: C.textMuted }}>
              {["Decision", "SKU", "Mode", "Amount", "Status", "Legs", "Razorpay refs"].map((h) => (
                <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loaded && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
            {loaded && executions.length === 0 && (
              <tr>
                <td colSpan={7} className="p-5">
                  <EmptyState title="No executions yet" body="Run a restock scenario — closed-loop payments land here with full reconciliation." />
                </td>
              </tr>
            )}
            {executions.map((e) => (
              <tr key={e.execution_id} className="border-t align-top hover:bg-slate-50" style={{ borderColor: C.hair }}>
                <td className="px-5 py-3">
                  <div className="mono text-[11px]" style={{ color: C.textHi }}>{e.decision_id.slice(0, 8)}…</div>
                  <div className="mono text-[10px]" style={{ color: C.textMuted }}>{e.idempotency_key.slice(0, 14)}…</div>
                </td>
                <td className="px-5 py-3 mono text-[12px]" style={{ color: C.textLo }}>{e.sku}</td>
                <td className="px-5 py-3">
                  <span
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md"
                    style={{
                      background: e.mode === "simulation" ? C.amberDim : C.accentBlueDim,
                      color: e.mode === "simulation" ? C.amber : C.accentBlue,
                      border: `1px solid ${e.mode === "simulation" ? "rgba(217,119,6,0.4)" : "rgba(37,99,235,0.3)"}`,
                    }}
                  >
                    {LEG_LABEL[e.mode] ?? e.mode}
                  </span>
                </td>
                <td className="px-5 py-3 mono text-[12px]" style={{ color: (e.amount_inr ?? 0) > 0 ? C.textHi : C.textMuted }}>
                  {e.amount_inr ? inr(e.amount_inr) : "—"}
                </td>
                <td className="px-5 py-3"><StatusBadge status={e.status} /></td>
                <td className="px-5 py-3">
                  <div className="space-y-1 max-w-[320px]">
                    {e.legs.map((l, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: LEG_TONE[l.status] ?? C.textMuted }} />
                        <span className="mono truncated" style={{ color: C.textLo }}>{l.kind}</span>
                        <span className="truncate" style={{ color: C.textMuted }}>{l.detail}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 mono text-[10.5px]" style={{ color: C.textLo }}>
                  {( [e.order_id, e.payment_id].filter(Boolean) as string[]).map((r) => (
                    <div key={r} className="truncate max-w-[150px]" title={r}>{r.slice(0, 12)}…</div>
                  ))}
                  {!e.order_id && !e.payment_id && <span style={{ color: C.textMuted }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReconciliationTable({ recons, loaded }: { recons: Reconciliation[]; loaded: boolean }) {
  return (
    <div className="rounded-xl" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: C.hair }}>
        <h2 className="text-[15px] font-semibold" style={{ color: C.textHi }}>Reconciliations</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider" style={{ color: C.textMuted }}>
              {["Decision", "SKU", "Expected", "Actual", "State", "Events"].map((h) => (
                <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loaded && <SkeletonRow cols={5} />}
            {loaded && recons.length === 0 && (
              <tr>
                <td colSpan={6} className="p-5">
                  <EmptyState title="No reconciliations" body="Webhook-matched funds appear here." />
                </td>
              </tr>
            )}
            {recons.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50" style={{ borderColor: C.hair }}>
                <td className="px-5 py-3 mono text-[11px]" style={{ color: C.textHi }}>{r.decision_id.slice(0, 8)}…</td>
                <td className="px-5 py-3 mono text-[12px]" style={{ color: C.textLo }}>{r.sku}</td>
                <td className="px-5 py-3 mono text-[12px]" style={{ color: C.textHi }}>{inr(r.expected_amount_inr)}</td>
                <td className="px-5 py-3 mono text-[12px]" style={{ color: r.actual_amount_inr != null ? C.textHi : C.textMuted }}>
                  {r.actual_amount_inr != null ? inr(r.actual_amount_inr) : "—"}
                </td>
                <td className="px-5 py-3"><StatusBadge status={r.state} label={r.state.replace(/_/g, " ")} /></td>
                <td className="px-5 py-3 text-[11px]" style={{ color: C.textLo }}>
                  {r.events.length} event(s)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WebhookTable({ events, loaded }: { events: WebhookEvent[]; loaded: boolean }) {
  const lastN = events.slice(0, 12);
  return (
    <div className="rounded-xl" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: C.hair }}>
        <h2 className="text-[15px] font-semibold" style={{ color: C.textHi }}>Webhook feed</h2>
        <p className="text-[11px] mt-0.5" style={{ color: C.textLo }}>
          Signature-verified Razorpay events ({events.length} total, last {lastN.length} shown)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider" style={{ color: C.textMuted }}>
              {["Event", "Type", "Signature", "Source", "Processed", "Status"].map((h) => (
                <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loaded && <SkeletonRow cols={5} />}
            {loaded && events.length === 0 && (
              <tr>
                <td colSpan={6} className="p-5">
                  <EmptyState title="No webhook events" body="Razorpay's webhook calls (and the signed simulator) land here." />
                </td>
              </tr>
            )}
            {lastN.map((e) => (
              <tr key={e.event_id} className="border-t hover:bg-slate-50" style={{ borderColor: C.hair }}>
                <td className="px-5 py-3 mono text-[11px]" style={{ color: C.textHi }}>{e.event_id.slice(0, 10)}…</td>
                <td className="px-5 py-3 text-[12px]" style={{ color: C.textLo }}>{e.event_type}</td>
                <td className="px-5 py-3">
                  <span
                    className="text-[10.5px] px-2 py-0.5 rounded-md font-semibold"
                    style={
                      e.signature_valid
                        ? { background: C.greenDim, color: C.green }
                        : { background: C.redDim, color: C.red }
                    }
                  >
                    {e.signature_valid ? "VERIFIED" : "INVALID"}
                  </span>
                </td>
                <td className="px-5 py-3 text-[11px] mono" style={{ color: e.simulated ? C.amber : C.accentBlue }}>
                  {e.simulated ? "simulator" : "razorpay"}
                </td>
                <td className="px-5 py-3 text-[11px]" style={{ color: e.processed ? C.green : C.textMuted }}>
                  {e.processed ? `ok ${e.processed_at ? "· " + new Date(e.processed_at).toLocaleTimeString([]).slice(0, 8) : ""}` : "awaiting"}
                </td>
                <td className="px-5 py-3 text-[11px]" style={{ color: C.textLo }}>{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import { FileBarChart, ShieldBan, Store, Webhook, Wallet } from "lucide-react";
import type {
  EconomicDecision,
  FinancialExecution,
  GateVerdict,
  NegotiationResult,
  Reconciliation,
  SupplierQuote,
} from "../lib/types";
import { C, inr } from "../lib/theme";

/**
 * Execution timeline — the honest, sequential picture of a restock:
 * trigger → decision → negotiation → gate → execute (with legs) →
 * webhook reconciliation. Nodes that never happened render as skipped.
 */
interface Node {
  icon: React.ReactNode;
  label: string;
  sub: React.ReactNode;
  tone: { fg: string; bg: string };
  done: boolean;
}

const PASS = { fg: C.green, bg: C.greenDim };
const WARN = { fg: C.amber, bg: C.amberDim };
const FAIL = { fg: C.red, bg: C.redDim };
const MUTE = { fg: C.textMuted, bg: C.raised };

function node(
  icon: React.ReactNode,
  label: string,
  sub: React.ReactNode,
  tone: { fg: string; bg: string },
  done = true,
): Node {
  return { icon, label, sub, tone, done };
}

export function ExecutionTimeline({
  run,
  execution,
  reconciliation,
  decision,
}: {
  run?: {
    status?: string;
    gate?: GateVerdict;
    negotiation?: NegotiationResult | null;
    quotes?: SupplierQuote[];
  } | null;
  execution?: FinancialExecution | null;
  reconciliation?: Reconciliation | null;
  decision?: EconomicDecision | null;
}) {
  const blocked =
    decision?.action === "DO_NOT_BUY" || run?.status === "blocked" || (!!run?.gate && !run.gate.passed);

  const nodes: Node[] = [];
  const quoteCount = run?.quotes?.length ?? 0;
  nodes.push(
    node(
      <Store size={14} />,
      "Economic decision",
      decision?.action?.replace(/_/g, " ") ?? "—",
      blocked ? FAIL : decision?.action === "BUY" ? PASS : WARN,
      !!decision,
    ),
  );
  nodes.push(
    node(
      <FileBarChart size={14} />,
      "Negotiation & quotes",
      run?.negotiation?.supplier_name
        ? `${run.negotiation.supplier_name} · ${run.negotiation.quantity ?? "—"}u @ ${inr(run.negotiation.unit_price_inr ?? 0)}` +
          `${run.negotiation.total_inr != null ? ` (${inr(run.negotiation.total_inr)})` : ""}`
        : quoteCount > 0
          ? `${quoteCount} quote(s) received`
          : "no quotes recorded",
      run?.negotiation ? PASS : MUTE,
      !!run?.negotiation,
    ),
  );
  nodes.push(
    node(
      <ShieldBan size={14} />,
      "AP2-inspired boundary gate",
      run?.gate
        ? `${run.gate.passed ? "passed" : "FAILED"} — ${run.gate.summary}` +
          `${(run.gate.failed_checks?.length ?? 0) ? ` · ${run.gate.failed_checks!.length} breach(s)` : ""}`
        : "—",
      blocked ? FAIL : run?.gate?.passed ? PASS : MUTE,
      !!run?.gate,
    ),
  );
  nodes.push(
    node(
      <Wallet size={14} />,
      "Executed legs",
      execution && execution.legs.length
        ? execution.legs.map((l) => `${l.kind}: ${l.status}`).join(" → ")
        : "no money moved",
      execution ? (execution.status === "FAILED" ? FAIL : PASS) : MUTE,
      !!execution,
    ),
  );
  nodes.push(
    node(
      <Webhook size={14} />,
      "Webhook & reconciliation",
      reconciliation
        ? `${reconciliation.state} · expected ${inr(reconciliation.expected_amount_inr)} · actual ${
            reconciliation.actual_amount_inr != null ? inr(reconciliation.actual_amount_inr) : "—"
          }`
        : "awaiting webhook",
      reconciliation
        ? reconciliation.state === "MATCHED"
          ? PASS
          : reconciliation.state === "MISMATCH"
            ? FAIL
            : WARN
        : MUTE,
      !!reconciliation,
    ),
  );

  return (
    <div className="space-y-0">
      {nodes.map((n, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: n.tone.bg, color: n.tone.fg }}>
              {n.icon}
            </div>
            {i < nodes.length - 1 && <div className="w-px flex-1 min-h-4 my-1" style={{ background: C.hairStrong }} />}
          </div>
          <div className="pb-5 min-w-0">
            <div className="text-[12.5px] font-semibold" style={{ color: n.tone.fg }}>
              {n.label}
            </div>
            <div className="text-[12px] mt-0.5 leading-relaxed" style={{ color: n.done ? C.textLo : C.textMuted }}>
              {n.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
import type { Mandate } from "../lib/types";
import { JsonViewer } from "./JsonViewer";

const BADGE: Record<string, string> = {
  "mandate.intent.1": "bg-indigo-500/15 text-indigo-300",
  "mandate.cart.1": "bg-amber-500/15 text-amber-300",
  "mandate.payment.1": "bg-emerald-500/15 text-emerald-300",
};

export function MandateCard({ mandate, label }: { mandate?: Mandate | null; label: string }) {
  if (!mandate) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] px-3 py-4 text-xs text-slate-500">
        {label} — awaiting a run
      </div>
    );
  }
  const issuer = mandate.issuer.replace("did:ap2:", "").slice(0, 12);
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d1322]">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${BADGE[mandate.vct] ?? "bg-slate-700 text-slate-200"}`}>
            {mandate.vct}
          </span>
          <span className="text-xs font-semibold text-slate-200">{label}</span>
        </div>
        <span className="mono text-[10px] text-slate-500">
          issuer:{issuer}…
        </span>
      </div>
      <div className="px-3 py-2 space-y-1 text-[11px] text-slate-400">
        <div><span className="text-slate-500">id</span> <span className="mono">{mandate.id}</span></div>
        <div><span className="text-slate-500">sig</span> <span className="mono">{mandate.proof.proofValue.slice(0, 24)}…</span></div>
        {mandate.credentialSubject.prev_mandate_id && (
          <div><span className="text-slate-500">→ binds</span> <span className="mono">{mandate.credentialSubject.prev_mandate_id.slice(0, 20)}…</span></div>
        )}
      </div>
      <JsonViewer value={mandate} />
    </div>
  );
}
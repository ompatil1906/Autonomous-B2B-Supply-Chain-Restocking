import type { Mandate } from "../lib/types";
import { JsonViewer } from "./JsonViewer";

const BADGE: Record<string, string> = {
  "mandate.intent.1": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "mandate.cart.1": "bg-amber-50 text-amber-700 border-amber-200",
  "mandate.payment.1": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function MandateCard({
  mandate,
  label,
}: {
  mandate?: Mandate | null;
  label: string;
}) {
  if (!mandate) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-xs text-slate-400 shadow-sm">
        {label} — awaiting a run
      </div>
    );
  }
  const issuer = mandate.issuer.replace("did:ap2:", "").slice(0, 12);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              BADGE[mandate.vct] ?? "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            {mandate.vct}
          </span>
          <span className="text-xs font-semibold text-slate-700">{label}</span>
        </div>
        <span className="mono text-[10px] text-slate-400">issuer:{issuer}…</span>
      </div>
      <div className="space-y-1 px-3 py-2 text-[11px] text-slate-500">
        <div>
          <span className="text-slate-400">id</span>{" "}
          <span className="mono">{mandate.id}</span>
        </div>
        <div>
          <span className="text-slate-400">sig</span>{" "}
          <span className="mono">{mandate.proof.proofValue.slice(0, 24)}…</span>
        </div>
        {mandate.credentialSubject.prev_mandate_id && (
          <div>
            <span className="text-slate-400">→ binds</span>{" "}
            <span className="mono">{mandate.credentialSubject.prev_mandate_id.slice(0, 20)}…</span>
          </div>
        )}
      </div>
      <div className="px-3 pb-3">
        <JsonViewer value={mandate} />
      </div>
    </div>
  );
}
import { useState } from "react";
import { CheckCircle2, Hash, ShieldCheck, ShieldX, Link as LinkIcon, FileCheck } from "lucide-react";
import { api } from "../lib/api";
import type { AuditRecord, VerifyResult } from "../lib/types";
import { C } from "../lib/theme";
import { KIND_LABELS, payloadSummary } from "../lib/format";

type KindGroup = "all" | "agent" | "reserve_pay" | "approvals";

const GROUPS: { id: KindGroup; label: string }[] = [
  { id: "all", label: "All" },
  { id: "agent", label: "Agent" },
  { id: "reserve_pay", label: "Reserve Pay" },
  { id: "approvals", label: "Approvals & alerts" },
];

function inGroup(kind: string, g: KindGroup): boolean {
  if (g === "all") return true;
  if (g === "agent") return kind.startsWith("agent.");
  if (g === "reserve_pay") return kind.startsWith("reserve_pay.") || kind.startsWith("razorpay.");
  return kind.startsWith("approval.") || kind === "notification.sent";
}

export function LedgerTable({ records }: { records: AuditRecord[] }) {
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [group, setGroup] = useState<KindGroup>("all");

  const runVerify = async () => {
    setVerifying(true);
    try {
      setVerify(await api.verifyChain());
    } finally {
      setVerifying(false);
    }
  };

  const filtered = records.filter((r) => inGroup(r.kind, group));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pt-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: C.textHi }}>Cryptographic Ledger</h1>
        <p className="text-sm max-w-2xl leading-relaxed" style={{ color: C.textLo }}>
          Append-only audit trail. Every entry is hash-linked to the previous one — any tampering breaks the cryptographic chain. This serves as irrefutable dispute evidence.
        </p>
      </div>

      <div className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.hair}`, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {GROUPS.map((g) => {
              const active = group === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setGroup(g.id)}
                  className="text-xs px-4 py-1.5 rounded-full transition-all font-medium"
                  style={
                    active
                      ? { background: C.brass, color: C.surface, boxShadow: "0 2px 4px rgba(168,127,61,0.2)" }
                      : { background: C.raised, color: C.textLo, border: `1px solid ${C.hair}` }
                  }
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs mono px-3 py-1.5 rounded-lg" style={{ background: C.raised, color: C.textLo }}>
              {filtered.length} / {records.length} records
            </span>
            <button
              onClick={runVerify}
              disabled={verifying}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-all hover:-translate-y-0.5"
              style={{ background: C.green, color: C.surface, boxShadow: "0 2px 8px rgba(16,185,129,0.25)" }}
            >
              <ShieldCheck size={16} /> {verifying ? "Recomputing Hashes…" : "Verify Cryptographic Chain"}
            </button>
          </div>
        </div>

        {verify && (
          <div
            className="mb-6 rounded-xl p-4 text-sm flex items-center gap-3 font-medium transition-all"
            style={{
              background: verify.valid ? C.greenDim : C.redDim,
              border: `1px solid ${verify.valid ? "rgba(14,159,110,0.35)" : "rgba(220,38,38,0.35)"}`,
              color: verify.valid ? C.green : C.red,
            }}
          >
            {verify.valid ? <CheckCircle2 size={18} /> : <ShieldX size={18} />}
            {verify.valid
              ? `Chain Intact — ${verify.count} entr${verify.count === 1 ? "y" : "ies"} successfully recomputed and verified server-side.`
              : `CHAIN BROKEN at entry #${verify.first_bad_seq} — stored hash does not match recompute!`}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-xl p-16 text-center" style={{ background: C.raised, border: `1px dashed ${C.hairStrong}` }}>
            <FileCheck size={32} className="mx-auto mb-4" style={{ color: C.textMuted }} />
            <div className="text-sm font-medium mb-1" style={{ color: C.textHi }}>No entries found</div>
            <div className="text-xs" style={{ color: C.textLo }}>
              Run a scenario or open Live Ops to populate the ledger.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ color: C.textLo, borderBottom: `2px solid ${C.hair}` }}>
                  <th className="py-3 px-2 font-semibold text-[10px] uppercase tracking-wider w-12">Seq</th>
                  <th className="py-3 px-2 font-semibold text-[10px] uppercase tracking-wider w-24">Time (UTC)</th>
                  <th className="py-3 px-2 font-semibold text-[10px] uppercase tracking-wider">Event & Payload</th>
                  <th className="py-3 px-2 font-semibold text-[10px] uppercase tracking-wider w-36">Prev Hash</th>
                  <th className="py-3 px-2 font-semibold text-[10px] uppercase tracking-wider w-36">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.slice(0, 80).map((r) => (
                  <tr key={r.seq} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-2 mono text-xs font-semibold" style={{ color: C.textMuted }}>
                      #{r.seq}
                    </td>
                    <td className="py-3 px-2 mono text-xs" style={{ color: C.textLo }}>
                      {r.ts.slice(11, 19)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold" style={{ color: C.textHi }}>
                          {KIND_LABELS[r.kind] ?? r.kind}
                        </span>
                        <span className="text-xs" style={{ color: C.textLo }}>
                          {payloadSummary(r)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="inline-flex items-center gap-1.5 mono text-[11px] px-2 py-1 rounded bg-slate-100" style={{ color: C.textLo }}>
                        <LinkIcon size={10} /> {(r.prev_hash ?? "").slice(0, 10) || "—"}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="inline-flex items-center gap-1.5 mono text-[11px] px-2 py-1 rounded font-medium" style={{ background: C.brassDim, color: C.brass }}>
                        <Hash size={10} /> {(r.hash ?? "").slice(0, 10) || "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

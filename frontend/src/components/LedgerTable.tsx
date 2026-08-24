import { useState } from "react";
import { CheckCircle2, Hash, ShieldCheck, ShieldX } from "lucide-react";
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
    <div className="max-w-5xl mx-auto rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-sm font-medium" style={{ color: C.textHi }}>
            Append-only audit ledger
          </div>
          <div className="text-xs mt-1 max-w-2xl" style={{ color: C.textLo }}>
            Every entry is hash-linked to the one before it — edit any field and every hash after
            it breaks. That chain is your dispute evidence.
          </div>
        </div>
        <button
          onClick={runVerify}
          disabled={verifying}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: C.brassDim, color: C.brass, border: `1px solid rgba(168,127,61,0.4)` }}
        >
          <ShieldCheck size={13} /> {verifying ? "Recomputing…" : "Verify chain"}
        </button>
      </div>

      {verify && (
        <div
          className="mb-4 rounded-lg p-3 text-xs flex items-center gap-2"
          style={{
            background: verify.valid ? C.greenDim : C.redDim,
            border: `1px solid ${verify.valid ? "rgba(14,159,110,0.35)" : "rgba(222,76,74,0.35)"}`,
            color: verify.valid ? C.green : C.red,
          }}
        >
          {verify.valid ? <CheckCircle2 size={14} /> : <ShieldX size={14} />}
          {verify.valid
            ? `Chain intact — ${verify.count} entr${verify.count === 1 ? "y" : "ies"} recomputed and verified server-side.`
            : `Chain BROKEN at entry #${verify.first_bad_seq} — stored hash does not match recompute.`}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {GROUPS.map((g) => {
          const active = group === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGroup(g.id)}
              className="text-[11px] px-2.5 py-1 rounded-full transition-opacity hover:opacity-90"
              style={
                active
                  ? { background: C.brassDim, color: C.brass, border: "1px solid rgba(168,127,61,0.45)" }
                  : { background: "transparent", color: C.textLo, border: `1px solid ${C.hair}` }
              }
            >
              {g.label}
            </button>
          );
        })}
        <span className="text-[11px] ml-auto mono" style={{ color: C.textLo }}>
          {filtered.length} / {records.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm py-14 text-center" style={{ color: C.textLo }}>
          No entries in this filter yet — run a scenario or open Live Ops to populate the ledger.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: C.textLo }} className="text-left">
              <th className="py-2 pr-2 font-normal w-10">#</th>
              <th className="py-2 pr-2 font-normal">Event</th>
              <th className="py-2 pr-2 font-normal w-24">Time (UTC)</th>
              <th className="py-2 pr-2 font-normal w-36">Prev hash</th>
              <th className="py-2 pr-2 font-normal w-36">Hash</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 80).map((r) => (
              <tr key={r.seq} style={{ borderTop: `1px solid ${C.hair}` }}>
                <td className="py-2 pr-2 mono" style={{ color: C.textLo }}>
                  {r.seq}
                </td>
                <td className="py-2 pr-2" style={{ color: C.textHi }}>
                  <span className="mono mr-2" style={{ color: C.amber }}>
                    {KIND_LABELS[r.kind] ?? r.kind}
                  </span>
                  {payloadSummary(r)}
                </td>
                <td className="py-2 pr-2 mono" style={{ color: C.textLo }}>
                  {r.ts.slice(11, 19)}
                </td>
                <td className="py-2 pr-2 mono truncate max-w-[130px]" title={r.prev_hash} style={{ color: C.textLo }}>
                  <span className="inline-flex items-center gap-1">
                    <Hash size={9} /> {(r.prev_hash ?? "").slice(0, 10) || "—"}
                  </span>
                </td>
                <td className="py-2 mono truncate max-w-[130px]" title={r.hash} style={{ color: C.brass }}>
                  {(r.hash ?? "").slice(0, 10) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

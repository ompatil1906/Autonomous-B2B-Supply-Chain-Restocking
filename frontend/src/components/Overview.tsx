import { ArrowRight, ShieldCheck, TrendingUp, Wallet, Boxes, BellRing } from "lucide-react";
import type { AuditRecord, Inventory, SystemStatus } from "../lib/types";
import { C, inr } from "../lib/theme";
import { KIND_LABELS, payloadSummary } from "../lib/format";

export function Overview({
  status,
  inventory,
  audit,
  pendingCount,
  saves,
  onOpenMission,
  onOpenApprovals,
}: {
  status: SystemStatus | null;
  inventory: Inventory | null;
  audit: AuditRecord[];
  pendingCount: number;
  saves: number;
  onOpenMission: () => void;
  onOpenApprovals: () => void;
}) {
  const kpis = [
    { icon: Boxes, label: "SKUs monitored", value: String(inventory?.catalog.length ?? "—"), tone: C.textHi },
    { icon: Wallet, label: "Ceiling protected", value: inr(status?.ap2_limit_inr), tone: C.brass },
    { icon: TrendingUp, label: "Autonomous captures", value: String(saves), tone: C.green },
    { icon: BellRing, label: "Escalations pending", value: String(pendingCount), tone: pendingCount ? C.red : C.textHi },
  ];

  return (
    <div className="max-w-5xl mx-auto pt-6">
      <h1 className="text-3xl font-semibold tracking-tight leading-snug max-w-3xl" style={{ color: C.textHi }}>
        D2C merchants lose sales to stockouts — but nobody hands an AI agent a blank check.
        <span style={{ color: C.brass }}> Warden is the boundary.</span>
      </h1>
      <p className="mt-3 text-sm max-w-2xl" style={{ color: C.textLo }}>
        One SKU, one supplier, one signed AP2 IntentMandate and a UPI Reserve Pay block. The agent
        restocks autonomously inside the mandate — and provably cannot spend a paisa more.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {kpis.map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
            <Icon size={16} style={{ color: tone }} />
            <div className="text-2xl font-semibold mt-2 mono" style={{ color: C.textHi }}>
              {value}
            </div>
            <div className="text-xs mt-1" style={{ color: C.textLo }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onOpenMission}
        className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: C.brassDim, color: C.brass, border: `1px solid rgba(168,127,61,0.4)` }}
      >
        <ShieldCheck size={16} /> Open Mission control <ArrowRight size={14} />
      </button>

      <div className="mt-10 rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs tracking-wide" style={{ color: C.textLo }}>
            RECENT ACTIVITY
          </span>
          {pendingCount > 0 && (
            <button onClick={onOpenApprovals} className="text-xs inline-flex items-center gap-1" style={{ color: C.red }}>
              {pendingCount} escalation{pendingCount > 1 ? "s" : ""} awaiting you →
            </button>
          )}
        </div>
        {audit.length === 0 ? (
          <div className="text-sm py-6 text-center" style={{ color: C.textLo }}>
            Nothing yet — run a scenario in Mission control.
          </div>
        ) : (
          <div className="space-y-2">
            {audit.slice(0, 3).map((r) => (
              <div key={r.seq} className="flex items-center justify-between gap-3 text-xs">
                <span style={{ color: C.textHi }}>
                  <span className="mono mr-2" style={{ color: C.amber }}>
                    {KIND_LABELS[r.kind] ?? r.kind}
                  </span>
                  {payloadSummary(r)}
                </span>
                <span className="mono shrink-0" style={{ color: C.textLo }}>
                  {r.ts.slice(11, 19)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

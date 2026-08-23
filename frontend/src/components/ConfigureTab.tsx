import { Ban, CheckCircle2, IndianRupee, Settings2, ShieldCheck, Wallet } from "lucide-react";
import type { SystemStatus } from "../lib/types";
import { C, inr } from "../lib/theme";

export function ConfigureTab({
  status,
  blockRef,
  remaining,
  ceiling,
  lowStockThreshold,
}: {
  status: SystemStatus | null;
  blockRef: string;
  remaining: number | null;
  ceiling: number;
  lowStockThreshold?: number;
}) {
  const rows: [string, string][] = [
    ["SKU", `${status?.ap2_sku ?? "—"} — Minimal Cotton Tee (Black)`],
    ["Max quantity per order", `${status?.ap2_max_qty ?? "—"} units`],
    ["Max price per unit", inr(status?.ap2_max_unit_price)],
    ["Total spending ceiling", inr(ceiling)],
    ["Reorder threshold", `${lowStockThreshold ?? "—"} units`],
    ["Mandate expiry", `${status?.intent_expiry_hours ?? "—"} hours from signing`],
    ["user_cart_confirmation_required", "false (autonomous execution allowed)"],
  ];
  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings2 size={15} color={C.brass} />
            <span className="text-sm font-medium" style={{ color: C.textHi }}>
              IntentMandate — rules of engagement
            </span>
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1"
            style={{ background: C.brassDim, color: C.brass, border: "1px solid rgba(168,127,61,0.4)" }}
          >
            <ShieldCheck size={11} /> signed
          </span>
        </div>
        {rows.map(([label, val]) => (
          <div key={label} className="mb-3">
            <div className="text-xs mb-1" style={{ color: C.textLo }}>
              {label}
            </div>
            <input
              readOnly
              value={val}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none mono"
              style={{ background: C.raised, color: C.textHi, border: `1px solid ${C.hair}` }}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs mt-2" style={{ color: C.brass }}>
          <ShieldCheck size={13} /> Signed by merchant wallet (Ed25519) — cryptographic mandate active
        </div>
      </div>

      <div className="rounded-2xl p-5 flex flex-col" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={15} color={C.brass} />
          <span className="text-sm font-medium" style={{ color: C.textHi }}>
            UPI Reserve Pay — funds block
          </span>
        </div>
        <div
          className="rounded-xl p-6 flex flex-col items-center justify-center flex-1"
          style={{ background: C.raised, border: `1px dashed ${C.hairStrong}` }}
        >
          <IndianRupee size={22} color={C.brass} />
          <div className="text-2xl font-semibold mt-2 mono" style={{ color: C.textHi }}>
            {(remaining ?? ceiling).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-1" style={{ color: C.textLo }}>
            blocked in merchant's bank account, dedicated to this agent
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Row label="Block reference" value={blockRef} mono />
          <Row
            label="Status"
            node={
              <span
                className="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1"
                style={{ background: C.greenDim, color: C.green, border: "1px solid rgba(14,159,110,0.35)" }}
              >
                <CheckCircle2 size={11} /> Active
              </span>
            }
          />
          <Row
            label="Spent this session"
            value={inr((status?.ap2_limit_inr ?? ceiling) - (remaining ?? ceiling))}
            mono
          />
          <Row
            label="Can the agent exceed this?"
            node={
              <span className="flex items-center gap-1" style={{ color: C.red }}>
                <Ban size={12} /> Never
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  node,
  mono,
}: {
  label: string;
  value?: string;
  node?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between text-xs items-center">
      <span style={{ color: C.textLo }}>{label}</span>
      {node ?? (
        <span style={{ color: C.textHi }} className={mono ? "mono" : undefined}>
          {value}
        </span>
      )}
    </div>
  );
}

import { Ban, CheckCircle2, IndianRupee, Settings2, ShieldCheck, Wallet, Zap } from "lucide-react";
import type { SystemStatus } from "../lib/types";
import { C, inr } from "../lib/theme";
import { fmtCompact } from "../lib/format";

export function ConfigureTab({
  status,
  blockRef,
  remaining,
  ceiling,
  dailyCeiling,
  lowStockThreshold,
}: {
  status: SystemStatus | null;
  blockRef: string;
  remaining: number | null;
  ceiling: number;
  dailyCeiling?: number;
  lowStockThreshold?: number;
}) {
  const pool = dailyCeiling ?? 100_000;
  const portfolio = status?.portfolio ?? [];
  const walkthroughName =
    portfolio.find((p) => p.sku === status?.ap2_sku)?.name ?? "Minimal Cotton Tee (Black)";

  const rows: [string, string][] = [
    ["SKU", `${status?.ap2_sku ?? "—"} — ${walkthroughName}`],
    ["Max quantity per order", `${status?.ap2_max_qty ?? "—"} units`],
    ["Max price per unit", inr(status?.ap2_max_unit_price)],
    ["Order cap (this run)", inr(ceiling)],
    ["Reorder threshold", `${lowStockThreshold ?? "—"} units`],
    ["Mandate expiry", `${status?.intent_expiry_hours ?? "—"} hours from signing`],
    ["user_cart_confirmation_required", "false (autonomous execution allowed)"],
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
          <div className="flex items-center justify-between mb-1">
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
          <div className="text-xs mb-4" style={{ color: C.textLo }}>
            The walkthrough mandate Mission control executes step by step. In Live Ops the agent
            signs one like it per SKU, automatically, before every purchase.
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
              {(remaining ?? pool).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs mt-1 text-center max-w-xs" style={{ color: C.textLo }}>
              unspent in the shared {fmtCompact(pool)} daily pool — every restock across all{" "}
              {portfolio.length || 6} SKUs draws from it · resets midnight IST
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
            <Row label="Spent today (all SKUs)" value={inr(pool - (remaining ?? pool))} mono />
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

      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: C.textLo }}>
            Portfolio policy — signed limits per SKU
          </span>
          <span className="text-xs mono" style={{ color: C.textLo }}>
            shared authority: {fmtCompact(pool)}/day
          </span>
        </div>
        {portfolio.length === 0 ? (
          <div className="text-sm py-8 text-center" style={{ color: C.textLo }}>
            Loading portfolio…
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ color: C.textLo }}>
                <th className="py-2 pr-3 font-normal">SKU</th>
                <th className="py-2 pr-3 font-normal">Product</th>
                <th className="py-2 pr-3 font-normal">Unit price</th>
                <th className="py-2 pr-3 font-normal">Restock lot</th>
                <th className="py-2 pr-3 font-normal">Order cap</th>
                <th className="py-2 pr-3 font-normal">Max unit price</th>
                <th className="py-2 font-normal">Festival</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((p) => (
                <tr key={p.sku} style={{ borderTop: `1px solid ${C.hair}` }}>
                  <td className="py-2 pr-3 mono font-medium" style={{ color: C.textHi }}>
                    {p.sku}
                  </td>
                  <td className="py-2 pr-3" style={{ color: C.textHi }}>
                    {p.name}
                  </td>
                  <td className="py-2 pr-3 mono" style={{ color: C.textLo }}>
                    {inr(p.price_inr)}
                  </td>
                  <td className="py-2 pr-3 mono" style={{ color: C.textHi }}>
                    {p.restock_qty} units
                  </td>
                  <td className="py-2 pr-3 mono" style={{ color: C.textHi }}>
                    {fmtCompact(p.ceiling_inr)}
                  </td>
                  <td className="py-2 pr-3 mono" style={{ color: C.textLo }}>
                    {fmtCompact(p.max_unit_price_inr)}
                  </td>
                  <td className="py-2">
                    {p.festival ? (
                      <span
                        className="px-1.5 py-0.5 rounded mono inline-flex items-center gap-1"
                        style={{ background: C.brassDim, color: C.brass, fontSize: 10 }}
                      >
                        <Zap size={9} /> surge-priced
                      </span>
                    ) : (
                      <span style={{ color: C.textLo }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

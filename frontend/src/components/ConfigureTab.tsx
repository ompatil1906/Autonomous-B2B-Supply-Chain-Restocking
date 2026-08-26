import { Ban, CheckCircle2, IndianRupee, Settings2, ShieldCheck, Wallet, Zap, FileText } from "lucide-react";
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
    <div className="max-w-5xl mx-auto space-y-8 pt-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: C.textHi }}>System Configuration</h1>
        <p className="text-sm max-w-2xl leading-relaxed" style={{ color: C.textLo }}>
          Review the cryptographic constraints and funding parameters bounding the autonomous agent. These rules cannot be bypassed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-6 transition-shadow hover:shadow-md" style={{ background: C.surface, border: `1px solid ${C.hair}`, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.raised }}>
                <Settings2 size={16} color={C.brass} />
              </div>
              <span className="text-sm font-bold tracking-wide uppercase" style={{ color: C.textHi }}>
                IntentMandate
              </span>
            </div>
            <span
              className="text-[10px] px-2.5 py-1 rounded-md font-bold tracking-wider uppercase inline-flex items-center gap-1.5"
              style={{ background: C.brassDim, color: C.brass, border: "1px solid rgba(168,127,61,0.3)" }}
            >
              <ShieldCheck size={12} /> Active
            </span>
          </div>
          <div className="text-xs mb-6 leading-relaxed" style={{ color: C.textLo }}>
            The walkthrough mandate Mission control executes step by step. In Live Ops the agent
            signs one like it per SKU, automatically, before every purchase.
          </div>
          
          <div className="space-y-3 mb-6">
            {rows.map(([label, val]) => (
              <div key={label} className="flex justify-between items-center pb-2 border-b" style={{ borderColor: C.hair }}>
                <div className="text-xs font-medium" style={{ color: C.textLo }}>
                  {label}
                </div>
                <div className="text-xs mono font-medium text-right max-w-[200px] truncate" title={val} style={{ color: C.textHi }}>
                  {val}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-2.5 text-xs p-3 rounded-lg" style={{ background: C.raised, color: C.textHi }}>
            <ShieldCheck size={16} style={{ color: C.brass }} /> 
            <div>
              <span className="font-semibold block">Cryptographically Secured</span>
              <span style={{ color: C.textLo }}>Signed by merchant wallet (Ed25519)</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 flex flex-col transition-shadow hover:shadow-md" style={{ background: C.surface, border: `1px solid ${C.hair}`, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.raised }}>
                <Wallet size={16} color={C.brass} />
              </div>
              <span className="text-sm font-bold tracking-wide uppercase" style={{ color: C.textHi }}>
                UPI Reserve Pay
              </span>
            </div>
            <span
              className="text-[10px] px-2.5 py-1 rounded-md font-bold tracking-wider uppercase inline-flex items-center gap-1.5"
              style={{ background: C.greenDim, color: C.green, border: "1px solid rgba(14,159,110,0.3)" }}
            >
              <CheckCircle2 size={12} /> Live
            </span>
          </div>
          
          <div
            className="rounded-xl p-8 flex flex-col items-center justify-center mb-6"
            style={{ background: C.raised, border: `1px dashed ${C.hairStrong}` }}
          >
            <div className="text-3xl font-bold tracking-tight mono flex items-center gap-1" style={{ color: C.textHi }}>
              <IndianRupee size={24} style={{ color: C.textMuted }} />
              {(remaining ?? pool).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs mt-3 text-center max-w-sm leading-relaxed" style={{ color: C.textLo }}>
              Available in the shared <strong style={{ color: C.textHi }}>{fmtCompact(pool)}</strong> daily pool. Every autonomous restock across all {portfolio.length || 6} SKUs draws from this allocation. Resets at midnight IST.
            </div>
          </div>
          
          <div className="space-y-3 mt-auto">
            <Row label="Funding block reference" value={blockRef} mono />
            <Row label="Spent today (all SKUs)" value={inr(pool - (remaining ?? pool))} mono />
            <Row
              label="Can agent exceed pool?"
              node={
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md" style={{ background: C.redDim, color: C.red }}>
                  <Ban size={12} /> Impossible
                </span>
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.hair}`, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.raised }}>
              <FileText size={16} color={C.brass} />
            </div>
            <span className="text-sm font-bold tracking-wide uppercase" style={{ color: C.textHi }}>
              Portfolio Limits
            </span>
          </div>
          <span className="text-xs mono px-3 py-1.5 rounded-lg" style={{ background: C.raised, color: C.textLo }}>
            Shared Authority: <span className="font-semibold" style={{ color: C.textHi }}>{fmtCompact(pool)}/day</span>
          </span>
        </div>
        
        {portfolio.length === 0 ? (
          <div className="rounded-xl p-16 text-center text-sm font-medium" style={{ background: C.raised, color: C.textLo, border: `1px dashed ${C.hairStrong}` }}>
            Loading portfolio configuration…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ color: C.textLo, borderBottom: `2px solid ${C.hair}` }}>
                  <th className="py-3 px-3 font-semibold text-[10px] uppercase tracking-wider">SKU</th>
                  <th className="py-3 px-3 font-semibold text-[10px] uppercase tracking-wider">Product Name</th>
                  <th className="py-3 px-3 font-semibold text-[10px] uppercase tracking-wider text-right">Unit Price</th>
                  <th className="py-3 px-3 font-semibold text-[10px] uppercase tracking-wider text-right">Restock Lot</th>
                  <th className="py-3 px-3 font-semibold text-[10px] uppercase tracking-wider text-right">Order Cap</th>
                  <th className="py-3 px-3 font-semibold text-[10px] uppercase tracking-wider text-right">Max Unit Price</th>
                  <th className="py-3 px-3 font-semibold text-[10px] uppercase tracking-wider text-center">Festival</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {portfolio.map((p) => (
                  <tr key={p.sku} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-3 mono text-xs font-semibold" style={{ color: C.textHi }}>
                      {p.sku}
                    </td>
                    <td className="py-4 px-3 font-medium" style={{ color: C.textHi }}>
                      {p.name}
                    </td>
                    <td className="py-4 px-3 mono text-xs text-right" style={{ color: C.textLo }}>
                      {inr(p.price_inr)}
                    </td>
                    <td className="py-4 px-3 mono text-xs font-semibold text-right" style={{ color: C.textHi }}>
                      {p.restock_qty} units
                    </td>
                    <td className="py-4 px-3 mono text-xs font-semibold text-right" style={{ color: C.textHi }}>
                      {fmtCompact(p.ceiling_inr)}
                    </td>
                    <td className="py-4 px-3 mono text-xs text-right" style={{ color: C.textLo }}>
                      {fmtCompact(p.max_unit_price_inr)}
                    </td>
                    <td className="py-4 px-3 text-center">
                      {p.festival ? (
                        <span
                          className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1"
                          style={{ background: C.brassDim, color: C.brass }}
                        >
                          <Zap size={10} /> Surge
                        </span>
                      ) : (
                        <span style={{ color: C.textMuted }}>—</span>
                      )}
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
    <div className="flex justify-between text-xs items-center py-1">
      <span className="font-medium" style={{ color: C.textLo }}>{label}</span>
      {node ?? (
        <span style={{ color: C.textHi }} className={mono ? "mono font-semibold" : "font-medium"}>
          {value}
        </span>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Zap, Timer, Flame, Trophy, Package } from "lucide-react";
import { C } from "../../lib/theme";
import type { ProductView, VelocitySnapshot } from "../../lib/types";
import { StatusChip } from "./ui";

export function fmtCountdown(seconds: number): string {
  const s = Math.round(seconds);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

type SortMode = "velocity" | "stock" | "revenue";

export function ShopFloor({
  products,
  snapshots,
  snapshotAt,
  lastSaleAt,
  ticker,
  connected,
}: {
  products: ProductView[];
  snapshots: Record<string, VelocitySnapshot>;
  snapshotAt: Record<string, number>;
  lastSaleAt: Record<string, number>;
  ticker: { unitsLast10s: number; unitsLast5m: number };
  connected: boolean;
}) {
  const [sort, setSort] = useState<SortMode>("velocity");
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const bestSkus = useMemo(() => {
    const rates = new Map<string, number>();
    let maxRate = 0;
    for (const p of products) {
      const upm = snapshots[p.sku]?.unitsPerMinute ?? 0;
      rates.set(p.sku, upm);
      if (upm > maxRate) maxRate = upm;
    }
    const set = new Set<string>();
    if (maxRate > 0) {
      for (const [sku, rate] of rates) if (rate >= maxRate * 0.95) set.add(sku);
    }
    return set;
  }, [products, snapshots]);

  const sorted = useMemo(() => {
    const arr = [...products];
    arr.sort((a, b) => {
      if (sort === "stock") {
        const pa = a.referenceStock ? a.currentStock / a.referenceStock : 0;
        const pb = b.referenceStock ? b.currentStock / b.referenceStock : 0;
        return pa - pb;
      }
      const ua = snapshots[a.sku]?.unitsPerMinute ?? 0;
      const ub = snapshots[b.sku]?.unitsPerMinute ?? 0;
      if (sort === "revenue") return ub * b.unitPriceRupees - ua * a.unitPriceRupees;
      return ub - ua;
    });
    return arr;
  }, [products, snapshots, sort]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${connected ? "animate-ping" : ""}`}
              style={{ background: connected ? C.green : C.red }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: connected ? C.green : C.red }}
            />
          </span>
          <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: C.textLo }}>Live Inventory</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono text-[10px]" style={{ color: C.textLo }}>
            <strong style={{ color: C.textHi }}>{ticker.unitsLast10s}</strong> units / 10s
          </span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: C.raised }}>
            {(
              [
                ["velocity", "Velocity"],
                ["stock", "Stock"],
                ["revenue", "Revenue"],
              ] as [SortMode, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className="text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium"
                style={{
                  background: sort === key ? C.surface : "transparent",
                  color: sort === key ? C.textHi : C.textMuted,
                  boxShadow: sort === key ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead style={{ background: C.raised, borderBottom: `1px solid ${C.hair}` }}>
            <tr>
              <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>Product</th>
              <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Status</th>
              <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider w-32" style={{ color: C.textMuted }}>Stock</th>
              <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Velocity</th>
              <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Depletion</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: C.hair }}>
            {sorted.map((p) => {
              const snapshot = snapshots[p.sku];
              const snapshotAgeMs = snapshotAt[p.sku] ? Date.now() - snapshotAt[p.sku] : 0;
              const upm = snapshot?.unitsPerMinute ?? 0;
              const predRaw = snapshot?.predictedSecondsToStockout;
              const predLeft = predRaw === null || predRaw === undefined ? null : Math.max(0, predRaw - snapshotAgeMs / 1000);
              const pct = p.referenceStock > 0 ? Math.max(0, Math.min(100, (p.currentStock / p.referenceStock) * 100)) : 0;
              const barColor = p.status === "sold_out" || p.status === "critical" || p.status === "escalated" ? C.red : p.status === "watch" ? C.heat : C.green;
              const isBestSeller = bestSkus.has(p.sku);

              return (
                <tr key={p.sku} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs" style={{ color: C.textHi }}>{p.name}</span>
                      {isBestSeller && <Trophy size={11} color={C.brass} title="Best Seller" />}
                      {p.festival && <Zap size={11} color={C.heat} title="Festival Drop" />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <StatusChip status={p.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: C.raised }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <span className="mono text-[10px]" style={{ color: C.textLo }}>{p.currentStock}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="mono text-[11px]" style={{ color: upm > 0 ? C.textHi : C.textMuted }}>
                      {upm > 0 ? `${Math.round(upm)}/m` : "0"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="mono text-[11px]" style={{ color: predLeft === null ? C.textMuted : predLeft <= 90 ? C.red : predLeft <= 270 ? C.heat : C.textHi }}>
                      {predLeft === null ? "—" : predLeft <= 0 ? "Empty" : fmtCountdown(predLeft)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: C.textMuted }}>
                  Waiting for inventory data...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FestivalRail({
  products,
  snapshots,
}: {
  products: ProductView[];
  snapshots: Record<string, VelocitySnapshot>;
}) {
  const dropped = products.filter((p) => p.festival && p.launchedAtMs);
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!dropped.length) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={12} color={C.heat} />
        <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: C.heat }}>Festival Drop Live</h2>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <table className="w-full text-left text-sm whitespace-nowrap">
          <tbody className="divide-y" style={{ borderColor: C.hair }}>
            {dropped.map((p) => {
              const agoS = Math.max(0, (Date.now() - (p.launchedAtMs ?? 0)) / 1000);
              const upm = snapshots[p.sku]?.unitsPerMinute ?? 0;
              const pct = p.referenceStock ? Math.round((p.currentStock / p.referenceStock) * 100) : 0;
              const hot = upm >= 25;
              
              return (
                <tr key={p.sku} style={{ borderLeft: `3px solid ${hot ? C.red : C.heat}` }}>
                  <td className="px-4 py-2.5 font-medium text-xs" style={{ color: C.textHi }}>{p.name}</td>
                  <td className="px-4 py-2.5 mono text-[10px] text-right" style={{ color: C.textLo }}>+{fmtCountdown(agoS)}</td>
                  <td className="px-4 py-2.5 mono text-[10px] text-right" style={{ color: hot ? C.red : C.heat }}>{Math.round(upm)}/min</td>
                  <td className="px-4 py-2.5 mono text-[10px] text-right" style={{ color: C.textLo }}>{p.currentStock} left ({pct}%)</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

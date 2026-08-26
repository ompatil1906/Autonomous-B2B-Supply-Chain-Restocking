import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { C } from "../../lib/theme";
import type { ProductView, VelocitySnapshot } from "../../lib/types";
import { ProductRow, fmtCountdown } from "./ProductRow";
import { SectionHeader } from "./ui";

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
    const id = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Best sellers = everyone within 5% of the top revenue rate (velocity × price).
  // Multiple SKUs can share the crown when they're neck-and-neck on units/min; none when nothing sells.
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
      <SectionHeader
        title="SHOP FLOOR — LIVE INVENTORY & DEMAND"
        icon={
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
        }
        right={
          <div className="flex items-center gap-3">
            <span className="mono text-[10px]" style={{ color: C.textLo }}>
              <strong style={{ color: C.textHi }}>{ticker.unitsLast10s}</strong> units / 10s
            </span>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: C.raised }}>
              {(
                [
                  ["velocity", "Best-selling"],
                  ["stock", "Lowest stock"],
                  ["revenue", "Revenue"],
                ] as [SortMode, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className="text-[10px] px-2 py-1 rounded-md transition-colors"
                  style={{
                    background: sort === key ? C.surface : "transparent",
                    border: `1px solid ${sort === key ? C.hair : "transparent"}`,
                    color: sort === key ? C.textHi : C.textLo,
                    fontWeight: sort === key ? 500 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="space-y-2">
        {sorted.map((p) => (
          <ProductRow
            key={p.sku}
            product={p}
            snapshot={snapshots[p.sku]}
            snapshotAgeMs={snapshotAt[p.sku] ? Date.now() - snapshotAt[p.sku] : 0}
            flashKey={lastSaleAt[p.sku] ?? 0}
            isBestSeller={bestSkus.has(p.sku)}
          />
        ))}
        {!sorted.length && (
          <div className="text-sm text-center py-16 rounded-xl" style={{ color: C.textLo, background: C.surface, border: `1px solid ${C.hair}` }}>
            Waiting for the shop floor to open…
          </div>
        )}
      </div>
    </div>
  );
}

/** Pinned rail for just-launched festival SKUs — heat accent, not amber wash. */
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
    const id = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  if (!dropped.length) return null;

  return (
    <div className="mb-5">
      <SectionHeader
        title="FESTIVAL DROP — JUST LAUNCHED"
        icon={<Zap size={11} color={C.heat} />}
        right={
          <span className="text-[9px]" style={{ color: C.textLo }}>
            velocity no fixed threshold could catch
          </span>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {dropped.map((p) => {
          const agoS = Math.max(0, (Date.now() - (p.launchedAtMs ?? 0)) / 1000);
          const upm = snapshots[p.sku]?.unitsPerMinute ?? 0;
          const pct = p.referenceStock ? Math.round((p.currentStock / p.referenceStock) * 100) : 0;
          const hot = upm >= 25;
          return (
            <div
              key={p.sku}
              className="rounded-r-xl px-3 py-2.5"
              style={{
                background: C.surface,
                border: `1px solid ${C.hair}`,
                borderLeft: `3px solid ${hot ? C.red : C.heat}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium truncate" style={{ color: C.textHi }}>
                  {p.name}
                </span>
                <span
                  className="mono text-[9px] px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: C.raised, color: C.textLo }}
                >
                  +{fmtCountdown(agoS)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-3 mono text-[12px]">
                <span className="font-medium" style={{ color: hot ? C.red : C.heat }}>
                  Sold {Math.round(upm)} units/min
                </span>
                <span style={{ color: C.textLo }}>
                  {p.currentStock} left · {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

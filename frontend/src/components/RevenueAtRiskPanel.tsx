import { useMemo } from "react";
import { TrendingDown, TriangleAlert } from "lucide-react";
import type { Inventory } from "../lib/types";
import type { LiveModel } from "../hooks/useLive";
import { useRevenueRisk } from "../hooks/useRevenueRisk";
import { C, inr } from "../lib/theme";
import { StatusBadge } from "./ui/StatusBadge";
import { ErrorState } from "./ui/ErrorState";
import { SkeletonCard } from "./ui/Skeleton";

/**
 * Revenue at risk — exact agent formula, live inputs on display.
 * Every number shown is a dependent of the recorded model: risk window s,
 * velocity (units/min), available stock, selling price, and the 45% margin.
 * When the model endpoint is unreachable this renders an error instead of
 * inventing constants.
 */
export function RevenueAtRiskPanel({
  live,
  inventory,
  limit = 5,
}: {
  live: LiveModel;
  inventory: Inventory | null;
  limit?: number;
}) {
  const stockOf = useMemo(() => {
    const map: Record<string, number> = {};
    if (inventory?.stock) for (const [sku, stock] of Object.entries(inventory.stock)) map[sku] = stock;
    for (const p of inventory?.catalog ?? []) map[p.sku] ??= p.stock;
    for (const p of live.products) map[p.sku] ??= p.currentStock;
    return map;
  }, [inventory, live.products]);

  const { rows, model, error } = useRevenueRisk(live.products, live.snapshots, (sku) => stockOf[sku] ?? 0);

  if (error) {
    return (
      <ErrorState
        title="Revenue-at-risk model unreachable"
        body={`Could not evaluate the agent's formula because GET /api/revenue-risk failed: ${error}`}
      />
    );
  }

  if (!model) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const ranked = [...rows]
    .filter((r) => r.result)
    .sort((a, b) => (b.result!.revenue_at_risk_inr ?? 0) - (a.result!.revenue_at_risk_inr ?? 0))
    .slice(0, limit);

  const totalRisk = ranked.reduce((acc, r) => acc + (r.result!.revenue_at_risk_inr ?? 0), 0);

  return (
    <div className="rounded-xl" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
      <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: C.hair }}>
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: C.textHi }}>
            Revenue at risk
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: C.textLo }}>
            Live projection · exact agent formula · {model.window_s.toFixed(0)}s window
          </p>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-semibold tracking-tight" style={{ color: totalRisk > 0 ? C.heat : C.green }}>
            {inr(totalRisk)}
          </div>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: C.textMuted }}>top {ranked.length} SKUs</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {ranked.map(({ product, result: res }) => {
          const upm = live.snapshots[product.sku]?.unitsPerMinute ?? 0;
          const rr = res!;
          return (
            <div key={product.sku} className="rounded-lg p-3" style={{ background: C.raised }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="mono text-[12px] font-semibold" style={{ color: C.textHi }}>{product.sku}</span>
                <span className="text-[12px] font-medium" style={{ color: C.textLo }}>{product.name}</span>
                <span className="ml-auto"><StatusBadge status={product.status} /></span>
              </div>
              <div className="mt-2 flex items-baseline gap-4 flex-wrap">
                <span className="text-[18px] font-semibold" style={{ color: rr.revenue_at_risk_inr > 0 ? C.heat : C.green }}>
                  {inr(rr.revenue_at_risk_inr)}
                </span>
                <span className="text-[11px] mono" style={{ color: C.textMuted }}>
                  {rr.expected_lost_units.toFixed(2)} lost units × {inr(product.unitPriceRupees)}
                </span>
              </div>
              <div className="mt-2 text-[10.5px] grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mono" style={{ color: C.textLo }}>
                <span>stock {rr.available_stock.toFixed(1)}</span>
                <span>velocity {upm.toFixed(2)} u/min</span>
                <span>window {rr.risk_window_s.toFixed(0)}s</span>
                <span>demand {rr.expected_demand_in_window.toFixed(2)}u</span>
                <span>stockout {rr.time_to_stockout_s == null ? "∞" : `${rr.time_to_stockout_s.toFixed(0)}s`}</span>
                <span>margin {model.margin_model}</span>
              </div>
            </div>
          );
        })}
        {ranked.length === 0 && (
          <div className="flex items-center gap-2 text-[12px] py-4" style={{ color: C.textLo }}>
            <TrendingDown size={14} /> No SKU at risk in the current window.
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t flex items-start gap-2 text-[10.5px]" style={{ borderColor: C.hair, color: C.textMuted }}>
        <TriangleAlert size={12} className="mt-0.5 shrink-0" />
        <span>
          formula: <span className="mono">{model.formula}</span>
        </span>
      </div>
    </div>
  );
}
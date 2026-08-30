import { useMemo } from "react";
import { Package, TrendingDown } from "lucide-react";
import type { Inventory, SystemStatus } from "../lib/types";
import type { LiveModel } from "../hooks/useLive";
import { useRevenueRisk } from "../hooks/useRevenueRisk";
import { C, inr } from "../lib/theme";
import { KpiChip } from "./ui/KpiChip";
import { StatusBadge } from "./ui/StatusBadge";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";
import { SkeletonCard, SkeletonRow } from "./ui/Skeleton";
import { LiveInventoryChart } from "./live/LiveInventoryChart";

export function InventoryScreen({
  live,
  inventory,
  status,
}: {
  live: LiveModel;
  inventory: Inventory | null;
  status: SystemStatus | null;
}) {
  const stockOf = useMemo(() => {
    const map: Record<string, number> = {};
    if (inventory?.stock) {
      for (const [sku, stock] of Object.entries(inventory.stock)) map[sku] = stock;
    }
    for (const p of inventory?.catalog ?? []) map[p.sku] ??= p.stock;
    for (const p of live.products) map[p.sku] ??= p.currentStock;
    return map;
  }, [inventory, live.products]);

  const { rows, error } = useRevenueRisk(live.products, live.snapshots, (sku) => stockOf[sku] ?? 0);

  const byStatus = (s: string) => live.products.filter((p) => p.status === s).length;
  const atRiskTotal = rows.reduce((acc, r) => acc + (r.result?.revenue_at_risk_inr ?? 0), 0);
  const loaded = !error && rows.length > 0 && rows.some((r) => r.result);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiChip label="SKUs monitored" value={live.products.length} icon={<Package size={14} />} />
        <KpiChip label="Healthy" value={byStatus("healthy")} sub={`${byStatus("watch")} watch · ${byStatus("cooldown")} cooldown`} />
        <KpiChip label="Critical / escalated" value={byStatus("critical") + byStatus("escalated")} tone={byStatus("critical") ? C.red : undefined} />
        <KpiChip label="Revenue at risk (90s win)" value={loaded ? inr(atRiskTotal) : "—"} sub={loaded ? "live projection, exact agent formula" : "formula below"} tone={atRiskTotal > 0 ? C.heat : C.green} />
      </div>

      {error && (
        <ErrorState
          title="Revenue-risk model unreachable"
          body={`Cannot evaluate live revenue at risk because GET /api/revenue-risk failed: ${error}`}
        />
      )}

      <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <LiveInventoryChart products={live.products} snapshots={live.snapshots} />
      </div>

      <div className="rounded-xl" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: C.hair }}>
          <h2 className="text-[15px] font-semibold" style={{ color: C.textHi }}>
            Catalog
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: C.textLo }}>
            Stock, live velocity and projected revenue at risk per SKU
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider" style={{ color: C.textMuted }}>
                {["SKU", "Product", "Stock", "Restock qty", "Velocity", "Stockout in", "Rev at risk", "Status"].map((h) => (
                  <th key={h} className="px-5 py-2.5 font-medium text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {live.products.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}
              {live.products.map((p) => {
                const snap = live.snapshots[p.sku];
                const row = rows.find((r) => r.product.sku === p.sku);
                const stockoutSecs = snap?.predictedSecondsToStockout;
                const stockout =
                  stockoutSecs == null
                    ? "—"
                    : stockoutSecs === Infinity
                      ? "stable"
                      : `${Math.floor(stockoutSecs / 60)}m ${Math.round(stockoutSecs % 60)}s`;
                const upm = snap?.unitsPerMinute ?? 0;
                const risk = row?.result?.revenue_at_risk_inr;
                return (
                  <tr key={p.sku} className="hover:bg-slate-50 border-t" style={{ borderColor: C.hair }}>
                    <td className="px-5 py-3 mono text-[12px]" style={{ color: C.textHi }}>{p.sku}</td>
                    <td className="px-5 py-3">
                      <div className="text-[13px] font-medium" style={{ color: C.textHi }}>{p.name}</div>
                      {p.festival && <div className="text-[10px] mt-0.5" style={{ color: C.brass }}>festival mule</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] mono font-semibold" style={{ color: stockOf[p.sku] <= (inventory?.catalog.find((c) => c.sku === p.sku)?.reorder_threshold ?? 0) ? C.red : C.textHi }}>
                        {stockOf[p.sku]}
                      </span>
                      <span className="text-[10px] ml-1" style={{ color: C.textMuted }}>/ ref {p.referenceStock}</span>
                    </td>
                    <td className="px-5 py-3 text-[13px]" style={{ color: C.textLo }}>{p.restockQty}</td>
                    <td className="px-5 py-3">
                      <span className="mono text-[12px]" style={{ color: upm >= 25 ? C.red : upm >= 10 ? C.heat : C.textHi }}>
                        {upm.toFixed(2)}
                      </span>
                      <span className="text-[10px] ml-1" style={{ color: C.textMuted }}>u/min</span>
                    </td>
                    <td className="px-5 py-3 text-[12px]" style={{ color: stockoutSecs != null && stockoutSecs < 300 ? C.red : C.textLo }}>
                      {stockout}
                    </td>
                    <td className="px-5 py-3 text-[12px] mono" style={{ color: risk && risk > 0 ? C.heat : C.textMuted }}>
                      {risk ? inr(risk) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {live.products.length === 0 && !error && (
          <div className="p-5">
            <EmptyState
              title="No live telemetry yet"
              body="Connect the backend (GET /api/live/state over WS/HTTP) and SKU inventory appears here."
              icon={<TrendingDown size={20} />}
            />
          </div>
        )}
        {!status && (
          <div className="p-5 grid grid-cols-3 gap-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { clearRevenueRiskModelCache, computeRevenueRisk, loadRevenueRiskModel } from "../lib/revenueRisk";
import type { ProductView, RevenueRiskResult, VelocitySnapshot } from "../lib/types";

export interface LiveRevenueRiskRow {
  product: ProductView;
  result: RevenueRiskResult | null;
  error?: string | null;
}

/**
 * Loads the backend revenue-risk model constants once, then evaluates the SAME
 * formula for every SKU against live telemetry. `error` is set (never guessed)
 * when the model endpoint is unreachable.
 */
export function useRevenueRisk(
  products: ProductView[],
  snapshots: Record<string, VelocitySnapshot>,
  stockOf: (sku: string) => number,
): { rows: LiveRevenueRiskRow[]; model: { window_s: number; margin_model: string; formula: string } | null; error: string | null } {
  const [model, setModel] = useState<{ window_s: number; margin_model: string; formula: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRevenueRiskModel()
      .then(setModel)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (error) clearRevenueRiskModelCache();
  }, [error]);

  const rows: LiveRevenueRiskRow[] = products.map((p) => {
    if (!model) return { product: p, result: null, error };
    const stock = stockOf(p.sku);
    try {
      return { product: p, result: computeRevenueRisk(p, snapshots[p.sku], stock, model) };
    } catch (e) {
      return { product: p, result: null, error: (e as Error).message };
    }
  });

  return { rows, model, error };
}
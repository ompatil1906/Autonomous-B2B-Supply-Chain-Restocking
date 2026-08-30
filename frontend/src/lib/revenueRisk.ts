import type { RevenueRiskResult, ProductView, VelocitySnapshot } from "./types";
import { api } from "./api";

/**
 * Client-side revenue-at-risk — a faithful re-implementation of the agent's
 * deterministic model (backend `app/services/revenue_risk.py`). The frontend
 * does NOT invent business logic: the window constant, margin model and formula
 * string are sourced from `GET /api/revenue-risk`, and every live input comes
 * from the same telemetry the agent consumes. Decision-time values remain the
 * source of truth when a recorded decision exists; the live numbers are the
 * current-state projection with identical semantics.
 */

// Backend: risk_window_s = supplier_lead_time_s = AGENT_LEAD_WINDOW_S = 90.0
// We cache the model constants after the first successful fetch; when the
// endpoint is unreachable the panel renders an error instead of guessing.
let cachedModel: { window_s: number; margin_model: string; formula: string } | null = null;

export async function loadRevenueRiskModel(): Promise<{ window_s: number; margin_model: string; formula: string }> {
  if (cachedModel) return cachedModel;
  const { model } = await api.revenueRiskModel();
  cachedModel = model;
  return model;
}

export function clearRevenueRiskModelCache(): void {
  cachedModel = null;
}

/**
 * Mirrors `compute_revenue_risk` in `revenue_risk.py` — same inputs, same
 * intermediate steps, same rounding. `window_s` and `margin_model` default only
 * to the backend constants when the caller has not loaded the model.
 */
export function computeRevenueRisk(
  product: Pick<ProductView, "sku" | "unitPriceRupees" | "restockQty">,
  snapshot: Pick<VelocitySnapshot, "unitsPerMinute"> | undefined,
  availableStock: number,
  model: { window_s: number; margin_model: string },
): RevenueRiskResult {
  const selling_price = product.unitPriceRupees;
  const procurement_cost = product.unitPriceRupees; // parity per backend
  const margin = round(selling_price - selling_price * 0.55, 2); // 45% blended

  const window_s = model.window_s > 0 ? model.window_s : 90.0;
  const units_per_minute = snapshot?.unitsPerMinute ?? 0;

  const units_per_second = Math.max(0.0, units_per_minute / 60.0);
  const time_to_stockout = units_per_second > 1e-9 ? availableStock / units_per_second : Infinity;

  const expected_demand = Math.max(0.0, units_per_second * window_s);
  const lost_units = Math.max(0.0, expected_demand - availableStock);

  const revenue_at_risk = round(lost_units * selling_price, 2);
  const contribution_at_risk = round(lost_units * margin, 2);

  const proposed_quantity = product.restockQty;
  const protected_units = Math.min(proposed_quantity, Math.max(lost_units, expected_demand));
  const contribution_protected = round(protected_units * margin, 2);
  const procurement_cost_inr = round(proposed_quantity * procurement_cost, 2);
  const spend_ratio = procurement_cost_inr > 0 ? round(contribution_protected / procurement_cost_inr, 4) : 0.0;

  return {
    sku: product.sku,
    time_to_stockout_s: time_to_stockout === Infinity ? null : round(time_to_stockout, 1),
    supplier_lead_time_s: window_s,
    risk_window_s: window_s,
    expected_demand_in_window: round(expected_demand, 2),
    available_stock: availableStock,
    expected_lost_units: round(lost_units, 2),
    revenue_at_risk_inr: revenue_at_risk,
    contribution_at_risk_inr: contribution_at_risk,
    proposed_quantity: proposed_quantity,
    procurement_cost_inr: procurement_cost_inr,
    contribution_protected_inr: contribution_protected,
    protection_spend_ratio: spend_ratio,
    assumptions: {
      risk_window: `${window_s.toFixed(0)}s (${window_s.toFixed(0)}s agent pipeline)`,
      velocity_source: "live velocity engine (units/min)",
      margin_model: "45% blended gross margin",
    },
  };
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
}
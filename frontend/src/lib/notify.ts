import type { NotifyInput } from "../hooks/useNotifications";
import { inr } from "./theme";

/** SKU → display name lookup; falls back to the SKU code. */
function skuName(names: Record<string, string>, sku?: string | null): string {
  if (!sku) return "a SKU";
  return names[sku] ? `${names[sku]} (${sku})` : sku;
}

/**
 * Maps a raw WS event to notifications. Pure + dependency-light so it can be
 * unit-walked: returns an empty array for traffic that should never chatter.
 * Dedup/rate-limiting happens in the store (same key + cooldown).
 */
export function notificationsForEvent(e: any, ctx: { names: Record<string, string> }): NotifyInput[] {
  switch (e.type) {
    case "run_started":
      return [
        {
          kind: "run",
          severity: "info",
          title: "Restock started",
          message: `${skuName(ctx.names, e.sku)} — scenario “${e.scenario}”.`,
          key: `run:start:${e.scenario}:${e.sku ?? ""}`,
          tab: "mission",
        },
      ];

    case "run_completed": {
      const r = e.result as any;
      const gateFailed = r && r.gate && r.gate.passed === false;
      if (gateFailed || r?.status === "blocked") {
        return [
          {
            kind: "gate",
            severity: "critical",
            title: "DO NOT BUY — No Money Moved",
            message: `${skuName(ctx.names, r?.sku)}: the gate rejected the order (${((r?.gate?.summary ?? r?.gate?.failed_checks?.[0]?.name ?? "gate check failed") as string).slice(0, 120)}).`,
            key: `run:blocked:${e.sku ?? ""}:${e.scenario}`,
            tab: "mission",
            critical: true,
          },
        ];
      }
      const money = r?.money_moved_inr ?? r?.cart?.credentialSubject?.total_inr;
      return [
        {
          kind: "run",
          severity: "success",
          title: "Restock executed",
          message: `${skuName(ctx.names, r?.sku)} · ${r?.quantity ?? 0} units${money ? ` · ${inr(money)} moved` : ""}.`,
          key: `run:done:${e.sku ?? ""}:${e.scenario}`,
          tab: "mission",
        },
      ];
    }

    case "run_failed":
      return [
        {
          kind: "run",
          severity: "critical",
          title: "Execution failed",
          message: `${skuName(ctx.names, e.sku)} — ${String(e.error ?? "run error").slice(0, 120)}`,
          key: `run:failed:${e.sku ?? ""}:${e.scenario}`,
          tab: "mission",
          critical: true,
        },
      ];

    case "trigger_update": {
      const t = e.trigger as any;
      if (t?.outcome !== "escalated" && t?.outcome !== "failed") return [];
      const gateRejected = e.gate && e.gate.passed === false;
      return [
        {
          kind: "gate",
          severity: "critical",
          title: gateRejected ? "DO NOT BUY — No Money Moved" : "Order required your approval",
          message: `${skuName(ctx.names, t?.sku)}: ${gateRejected ? "gate check failed, no money moved" : "price/quantity outside the mandate — awaiting manual sign-off"}.`,
          key: `trigger:${t?.id ?? ""}:${t?.outcome ?? ""}`,
          tab: gateRejected ? "pipeline" : "approvals",
          critical: Boolean(gateRejected),
        },
      ];
    }

    case "webhook": {
      const ev = e.event as any;
      const paid = `${ev?.event_type ?? ""}`.toLowerCase().includes("paid") || `${ev?.event_type ?? ""}`.includes("captured");
      if (paid && ev?.processed && ev?.signature_valid) {
        return [
          {
            kind: "payment",
            severity: "success",
            title: "Payment verified",
            message: `${ev.event_type} · ${ev.amount_inr ? inr(ev.amount_inr) : "amount confirmed"}${ev.simulated ? " (simulated)" : " (test mode)"}.`,
            key: `webhook:${ev?.event_id ?? ""}`,
            tab: "payments",
          },
        ];
      }
      if (ev?.status === "failed" || ev?.status === "error" || (ev?.processed && !ev?.signature_valid)) {
        return [
          {
            kind: "payment",
            severity: "warning",
            title: "Webhook rejected",
            message: `${ev.event_type} failed signature/processing checks.`,
            key: `webhook:bad:${ev?.event_id ?? ""}`,
            tab: "payments",
          },
        ];
      }
      return [];
    }

    case "sold_out":
      return [
        {
          kind: "stock",
          severity: "warning",
          title: "Stockout reached",
          message: `${skuName(ctx.names, e.sku)} is sold out — revenue at risk.`,
          key: `stock:${e.sku ?? ""}`,
          cooldownMs: 60_000,
          tab: "inventory",
        },
      ];

    case "festival_started":
      return [
        {
          kind: "festival",
          severity: "info",
          title: "Festival demand surge",
          message: "Demand spike scheduled — the drop lands in seconds.",
          key: "festival:start",
          tab: "live",
        },
      ];

    case "festival_launched":
      return [
        {
          kind: "festival",
          severity: "critical",
          title: "Demand crash under way",
          message: "Sales jumped far above forecast — watch inventory and gate decisions closely.",
          key: "festival:launch",
          tab: "live",
          critical: true,
        },
      ];

    case "festival_stopped":
      return [
        {
          kind: "festival",
          severity: "info",
          title: "Festival stopped",
          message: "Surge window closed.",
          key: "festival:stop",
          tab: "live",
        },
      ];

    case "budget":
    case "velocity": {
      const b = e.budget as any;
      if (b && b.ceilingRupees > 0 && b.spentRupees >= b.ceilingRupees - 1e-6) {
        return [
          {
            kind: "budget",
            severity: "warning",
            title: "Daily pool exhausted",
            message: `${inr(b.ceilingRupees)} committed — the agent can make no more purchases today.`,
            key: `budget:${b.block_id ?? "none"}`,
            tab: "configure",
          },
        ];
      }
      return [];
    }

    default:
      return [];
  }
}
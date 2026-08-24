import { useState } from "react";
import {
  ChevronDown, ChevronRight, CircleDollarSign, ExternalLink,
  ShieldCheck, ShieldX, AlertTriangle,
} from "lucide-react";
import { C, inr } from "../../lib/theme";
import type { AgentTrigger } from "../../lib/types";
import { MandateSeal } from "../MandateSeal";
import { Stat } from "./ui";

const REASON_META: Record<string, { label: string; fg: string; bg: string; hint: string }> = {
  predictive_velocity: {
    label: "PREDICTIVE",
    fg: C.heat,
    bg: C.heatDim,
    hint: "fired early — projected stockout entered the agent's lead-time window before shelves ran dry",
  },
  hard_floor: {
    label: "HARD FLOOR",
    fg: C.textLo,
    bg: C.raised,
    hint: "safety net — stock fell to the absolute minimum before velocity predicted it",
  },
  manual_probe: {
    label: "MANUAL PROBE",
    fg: C.brass,
    bg: C.brassDim,
    hint: "operator-forced run through the same gated pipeline (demo control)",
  },
};

const OUTCOME_META: Record<string, { label: string; fg: string; bg: string }> = {
  in_progress: { label: "IN PROGRESS", fg: C.brass, bg: C.brassDim },
  executed: { label: "EXECUTED", fg: C.green, bg: C.greenDim },
  escalated: { label: "ESCALATED", fg: C.red, bg: C.redDim },
  failed: { label: "FAILED", fg: C.red, bg: C.redDim },
};

const STEP_PHRASES = [
  "",
  "blocking funds · signing intent mandate",
  "checking shelf level",
  "requesting supplier quote",
  "verifying boundary checks",
  "executing decision",
];

export function TriggerCard({
  trigger,
  onApprove,
  onReject,
  actionBusy,
}: {
  trigger: AgentTrigger;
  onApprove?: (t: AgentTrigger) => void;
  onReject?: (t: AgentTrigger) => void;
  actionBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = REASON_META[trigger.reason] ?? REASON_META.manual_probe;
  const outcome = OUTCOME_META[trigger.outcome] ?? OUTCOME_META.in_progress;
  const capFailed = !!trigger.gate?.checks?.some(
    (c) => c.name === "daily_portfolio_cap" && !c.passed,
  );
  const running = trigger.outcome === "in_progress";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: C.surface,
        border: `1px solid ${trigger.outcome === "escalated" ? "rgba(222,76,74,0.45)" : C.hair}`,
      }}
    >
      <div className="px-3.5 py-3">
        {/* header row */}
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] tracking-wider px-1.5 py-0.5 rounded font-semibold mono shrink-0"
            style={{ color: meta.fg, background: meta.bg }}
            title={meta.hint}
          >
            {meta.label}
          </span>
          <span className="mono text-[13px] font-semibold" style={{ color: C.textHi }}>
            {trigger.sku.replace("SKU-", "")}
          </span>
          <span className="ml-auto flex items-center gap-2 shrink-0">
            <span className="mono text-[9px]" style={{ color: C.textLo }}>
              {new Date(trigger.triggeredAtMs).toLocaleTimeString("en-IN")}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ color: outcome.fg, background: outcome.bg }}
            >
              {outcome.label}
            </span>
            <button onClick={() => setOpen(!open)} style={{ color: C.textLo }} aria-label="details">
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </span>
        </div>

        {/* evidence — three labeled stats */}
        <div className="grid grid-cols-3 gap-2 mt-2.5 rounded-lg py-2 px-2.5" style={{ background: C.raised }}>
          <Stat label="STOCK AT TRIGGER" value={`${trigger.stockAtTrigger} units`} />
          <Stat
            label="VELOCITY"
            value={`${Math.round(trigger.velocityAtTrigger)}/min`}
            tone={trigger.velocityAtTrigger >= 25 ? C.red : C.heat}
          />
          <Stat
            label="PREDICTED STOCKOUT"
            value={
              trigger.predictedSecondsAtTrigger != null
                ? `${Math.round(trigger.predictedSecondsAtTrigger)}s`
                : "—"
            }
          />
        </div>

        {/* pipeline progress */}
        <div className="flex items-center gap-[3px] mt-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full transition-colors duration-300"
              style={{
                background:
                  trigger.outcome === "failed" && i === trigger.currentStep
                    ? C.red
                    : i <= trigger.currentStep
                      ? trigger.outcome === "escalated" && i >= 5
                        ? C.red
                        : C.brass
                      : C.hair,
                opacity: i <= trigger.currentStep || !running ? 1 : 0.6,
              }}
            />
          ))}
        </div>
        {running && (
          <div className="text-[10px] mt-1.5 animate-pulse" style={{ color: C.brass }}>
            agent purchasing — {STEP_PHRASES[Math.min(5, Math.max(1, trigger.currentStep))]}…
          </div>
        )}
        {!running && trigger.outcome === "escalated" && (
          <div className="text-[10px] mt-1.5" style={{ color: capFailed ? C.red : C.textLo }}>
            paused at step {Math.min(5, Math.max(1, trigger.currentStep))} — waiting for a human decision
          </div>
        )}

        {/* outcomes */}
        {trigger.outcome === "executed" && (
          <div
            className="mt-2.5 rounded-r-lg pl-2.5 pr-2 py-2 text-xs"
            style={{
              background: C.greenDim,
              borderLeft: `3px solid ${C.green}`,
            }}
          >
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="mono font-semibold" style={{ color: C.green }}>
                {inr(trigger.amountInr)}
              </span>
              <span style={{ color: C.textHi }}>captured autonomously</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: C.textLo }}>
              gate passed all checks · +{trigger.quantity} units inbound · settled over UPI Reserve Pay
            </div>
          </div>
        )}

        {trigger.outcome === "escalated" && (
          <div
            className="mt-2.5 rounded-r-lg pl-2.5 pr-2 py-2 text-xs"
            style={{
              background: C.redDim,
              borderLeft: `3px solid ${C.red}`,
            }}
          >
            <div className="flex items-center gap-1.5">
              {capFailed ? (
                <>
                  <AlertTriangle size={13} color={C.red} className="shrink-0" />
                  <span className="font-medium" style={{ color: C.red }}>
                    Day's ₹1 lakh authority is fully committed — this cart needs a human yes/no
                  </span>
                </>
              ) : (
                <>
                  <ShieldX size={13} color={C.red} className="shrink-0" />
                  <span className="font-medium" style={{ color: C.red }}>
                    A boundary check failed — funds stayed blocked, nothing captured
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {trigger.paymentLink?.short_url && !trigger.paymentLink.simulated && (
                <a
                  href={trigger.paymentLink.short_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mono text-[11px] px-2 py-1 rounded-md hover:opacity-80 transition-opacity"
                  style={{ background: C.surface, color: C.brass, border: "1px solid rgba(168,127,61,0.4)" }}
                >
                  Open approval link <ExternalLink size={11} />
                </a>
              )}
              {trigger.paymentLink?.simulated && (
                <span
                  className="inline-flex mono text-[10px] px-2 py-1 rounded-md"
                  style={{ background: C.raised, color: C.textLo, border: `1px dashed ${C.hairStrong}` }}
                >
                  simulated link — no live URL
                </span>
              )}
              {onApprove && (
                <button
                  disabled={actionBusy}
                  onClick={() => onApprove(trigger)}
                  className="mono text-[11px] px-2.5 py-1 rounded-md disabled:opacity-40 hover:opacity-80 transition-opacity font-medium"
                  style={{ background: C.greenDim, color: C.green, border: "1px solid rgba(14,159,110,0.4)" }}
                >
                  Approve purchase
                </button>
              )}
              {onReject && (
                <button
                  disabled={actionBusy}
                  onClick={() => onReject(trigger)}
                  className="mono text-[11px] px-2 py-1 rounded-md underline disabled:opacity-40 transition-opacity"
                  style={{ color: C.textLo }}
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        )}

        {trigger.outcome === "failed" && (
          <div
            className="mt-2.5 rounded-r-lg pl-2.5 pr-2 py-2 text-xs mono"
            style={{ background: C.redDim, color: C.red, borderLeft: `3px solid ${C.red}` }}
          >
            pipeline error: {trigger.error ?? "unknown"}
          </div>
        )}

        {/* expanded mandate chain */}
        {open && (
          <div className="mt-3 space-y-2">
            {trigger.mandates ? (
              <>
                <MandateSeal n={1} title="IntentMandate" status="signed"
                  mandate={trigger.mandates.intent}
                  fields={[
                    ["SKU", trigger.sku],
                    ["Order cap", inr(trigger.mandates.intent.credentialSubject.constraints.amount_max_inr)],
                    ["Max qty", `${trigger.mandates.intent.credentialSubject.constraints.max_quantity_per_sku}`],
                  ]}
                />
                <MandateSeal n={2} title="CartMandate" status="signed"
                  mandate={trigger.mandates.cart}
                  fields={[
                    ["Qty", `${trigger.quantity}`],
                    ["Total", inr(trigger.amountInr)],
                    ["Quote", trigger.mandates.cart.credentialSubject.quote_ref],
                  ]}
                />
                <MandateSeal
                  n={3}
                  title="PaymentMandate"
                  status={trigger.outcome === "executed" ? "signed" : "void"}
                  mandate={trigger.mandates.payment}
                  fields={
                    trigger.outcome === "executed"
                      ? [
                          ["Debited", inr(trigger.amountInr)],
                          ["Rail", "UPI Reserve Pay"],
                          ["Ref", trigger.paymentId?.slice(0, 18) ?? "—"],
                        ]
                      : [["Reason", capFailed ? "Daily portfolio cap" : "Boundary breach"], ["Funds moved", "None"]]
                  }
                />
                {trigger.gate && (
                  <div className="rounded-lg p-2.5" style={{ background: C.raised }}>
                    <div className="text-[10px] tracking-wide mb-1.5" style={{ color: C.textLo }}>
                      DETERMINISTIC GATE CHECKS
                    </div>
                    {trigger.gate.checks.map((c) => (
                      <div key={c.name} className="flex items-start gap-1.5 text-[10px] py-0.5">
                        {c.passed ? (
                          <ShieldCheck size={11} color={C.green} className="shrink-0 mt-0.5" />
                        ) : (
                          <ShieldX size={11} color={C.red} className="shrink-0 mt-0.5" />
                        )}
                        <span className="mono shrink-0" style={{ color: c.passed ? C.textLo : C.red }}>
                          {c.name}
                        </span>
                        <span className="truncate" style={{ color: C.textLo }} title={c.message}>
                          {c.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-[11px] mono py-2" style={{ color: C.textLo }}>
                <CircleDollarSign size={12} className="inline mr-1" />
                mandate chain seals appear here as the pipeline completes…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function reasonBadge(t: AgentTrigger) {
  return REASON_META[t.reason]?.label ?? t.reason;
}

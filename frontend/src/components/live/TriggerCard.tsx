import { useState } from "react";
import {
  ChevronDown, ChevronRight, CircleDollarSign, ExternalLink,
  ShieldCheck, ShieldX, AlertTriangle, Activity, Zap
} from "lucide-react";
import { C, inr } from "../../lib/theme";
import type { AgentTrigger } from "../../lib/types";
import { MandateSeal } from "../MandateSeal";

const REASON_META: Record<string, { label: string; icon: any; fg: string; bg: string; hint: string }> = {
  predictive_velocity: {
    label: "Predictive Restock",
    icon: Activity,
    fg: C.heat,
    bg: C.heatDim,
    hint: "fired early — projected stockout entered the agent's lead-time window before shelves ran dry",
  },
  hard_floor: {
    label: "Safety Net Restock",
    icon: ShieldCheck,
    fg: C.textLo,
    bg: C.raised,
    hint: "safety net — stock fell to the absolute minimum before velocity predicted it",
  },
  manual_probe: {
    label: "Manual Override",
    icon: Zap,
    fg: C.brass,
    bg: C.brassDim,
    hint: "operator-forced run through the same gated pipeline (demo control)",
  },
};

const OUTCOME_META: Record<string, { label: string; fg: string; bg: string }> = {
  in_progress: { label: "IN PROGRESS", fg: C.brass, bg: C.brassDim },
  executed: { label: "APPROVED", fg: C.green, bg: C.greenDim },
  escalated: { label: "ESCALATED", fg: C.red, bg: C.redDim },
  failed: { label: "FAILED", fg: C.red, bg: C.redDim },
};

const STEP_PHRASES = [
  "",
  "Blocking funds & signing IntentMandate",
  "Checking shelf level",
  "Requesting supplier quote",
  "Verifying boundary checks",
  "Executing decision",
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
  
  const ReasonIcon = meta.icon;

  return (
    <div
      className="rounded-xl overflow-hidden transition-shadow"
      style={{
        background: C.surface,
        border: `1px solid ${trigger.outcome === "escalated" ? "rgba(222,76,74,0.45)" : C.hair}`,
        boxShadow: trigger.outcome === "escalated" ? "0 2px 8px rgba(222,76,74,0.1)" : "0 1px 2px rgba(0,0,0,0.02)"
      }}
    >
      <div className="px-4 py-4">
        {/* header row */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
              <ReasonIcon size={16} color={meta.fg} />
            </div>
            <div>
              <div className="text-sm font-semibold flex items-center gap-2" style={{ color: C.textHi }}>
                {trigger.sku.replace("SKU-", "")}
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: outcome.fg, background: outcome.bg }}>
                  {outcome.label}
                </span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.textLo }}>
                {meta.label} · {new Date(trigger.triggeredAtMs).toLocaleTimeString("en-IN")}
              </div>
            </div>
          </div>
          <button 
            onClick={() => setOpen(!open)} 
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors" 
            style={{ color: C.textLo }} 
            aria-label="details"
          >
            {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* AI Explanation Block */}
        <div className="mb-5 bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.textLo }}>
            AI Reasoning & Confidence
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="font-semibold w-24 shrink-0" style={{ color: C.textHi }}>Recommendation</span>
              <span style={{ color: C.textLo }}>Purchase {trigger.quantity || 'optimal'} units for {inr(trigger.amountInr)}.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold w-24 shrink-0" style={{ color: C.textHi }}>Why</span>
              <span style={{ color: C.textLo }}>Velocity is {Math.round(trigger.velocityAtTrigger)}/min. Stockout predicted in {trigger.predictedSecondsAtTrigger != null ? Math.round(trigger.predictedSecondsAtTrigger) + 's' : 'unknown time'}.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold w-24 shrink-0" style={{ color: C.textHi }}>Impact</span>
              <span style={{ color: C.textLo }}>Prevents cart abandonment and retains GMV during high traffic.</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="font-semibold w-24 shrink-0" style={{ color: C.textHi }}>Confidence</span>
              <div className="flex items-center gap-1.5" style={{ color: C.green }}>
                <ShieldCheck size={14} />
                <span className="font-medium">98% (AP2 Gate Verified)</span>
              </div>
            </div>
          </div>
        </div>

        {/* pipeline progress */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-all duration-300"
                style={{
                  background:
                    trigger.outcome === "failed" && i === trigger.currentStep
                      ? C.red
                      : i <= trigger.currentStep
                        ? trigger.outcome === "escalated" && i >= 5
                          ? C.red
                          : C.brass
                        : C.hair,
                  opacity: i <= trigger.currentStep || !running ? 1 : 0.4,
                }}
              />
            ))}
          </div>
          
          <div className="flex justify-between items-center text-xs">
            {running ? (
              <span className="font-medium animate-pulse" style={{ color: C.brass }}>
                {STEP_PHRASES[Math.min(5, Math.max(1, trigger.currentStep))]}…
              </span>
            ) : trigger.outcome === "escalated" ? (
              <span className="font-medium" style={{ color: capFailed ? C.red : C.textLo }}>
                Paused at step {Math.min(5, Math.max(1, trigger.currentStep))}
              </span>
            ) : trigger.outcome === "executed" ? (
              <span className="font-medium" style={{ color: C.green }}>Restock complete</span>
            ) : (
              <span className="font-medium" style={{ color: C.red }}>Pipeline failed</span>
            )}
            
            {running && (
              <span className="mono text-[10px]" style={{ color: C.brass }}>
                Step {Math.min(5, Math.max(1, trigger.currentStep))}/5
              </span>
            )}
          </div>
        </div>

        {/* outcomes */}
        {trigger.outcome === "executed" && (
          <div className="mt-4 rounded-lg p-3 text-sm flex items-start gap-3" style={{ background: C.greenDim, border: `1px solid rgba(16,185,129,0.3)` }}>
            <ShieldCheck size={18} color={C.green} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-0.5" style={{ color: C.green }}>
                Purchased {trigger.quantity} units for {inr(trigger.amountInr)}
              </div>
              <div className="text-xs" style={{ color: C.green, opacity: 0.8 }}>
                Gate passed all checks · Settled over UPI Reserve Pay
              </div>
            </div>
          </div>
        )}

        {trigger.outcome === "escalated" && (
          <div className="mt-4 rounded-lg p-4 text-sm" style={{ background: C.redDim, border: `1px solid rgba(220,38,38,0.3)` }}>
            <div className="flex items-start gap-3 mb-3">
              {capFailed ? (
                <>
                  <AlertTriangle size={18} color={C.red} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5" style={{ color: C.red }}>
                      Daily Authority Exceeded
                    </div>
                    <div className="text-xs" style={{ color: C.red, opacity: 0.9 }}>
                      This {inr(trigger.amountInr)} order pushes past the ₹1 lakh daily limit. Human approval required.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <ShieldX size={18} color={C.red} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5" style={{ color: C.red }}>
                      Boundary Check Failed
                    </div>
                    <div className="text-xs" style={{ color: C.red, opacity: 0.9 }}>
                      A deterministic gate check failed. Funds stayed blocked, nothing captured.
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap pt-3" style={{ borderTop: `1px dashed rgba(220,38,38,0.2)` }}>
              {trigger.paymentLink?.short_url && !trigger.paymentLink.simulated && (
                <a
                  href={trigger.paymentLink.short_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                  style={{ background: C.surface, color: C.textHi, border: `1px solid ${C.hairStrong}` }}
                >
                  Review Details <ExternalLink size={12} />
                </a>
              )}
              {trigger.paymentLink?.simulated && (
                <span className="inline-flex text-xs px-2 py-1 rounded-md bg-white/50" style={{ color: C.textLo }}>
                  Simulated Link
                </span>
              )}
              {onApprove && (
                <button
                  disabled={actionBusy}
                  onClick={() => onApprove(trigger)}
                  className="text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: C.red, color: C.surface }}
                >
                  Approve Order
                </button>
              )}
              {onReject && (
                <button
                  disabled={actionBusy}
                  onClick={() => onReject(trigger)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-80 transition-opacity"
                  style={{ color: C.textLo }}
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        )}

        {trigger.outcome === "failed" && (
          <div className="mt-4 rounded-lg p-3 text-xs mono" style={{ background: C.redDim, color: C.red, border: `1px solid rgba(220,38,38,0.3)` }}>
            Pipeline error: {trigger.error ?? "unknown"}
          </div>
        )}

        {/* expanded mandate chain */}
        {open && (
          <div className="mt-5 pt-5" style={{ borderTop: `1px dashed ${C.hairStrong}` }}>
            <div className="text-[11px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.textLo }}>
              Mandate Chain Signatures
            </div>
            <div className="space-y-2">
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
                    <div className="rounded-lg p-3 mt-3" style={{ background: C.raised }}>
                      <div className="text-[10px] font-semibold tracking-wider uppercase mb-2" style={{ color: C.textLo }}>
                        Deterministic Gate Checks
                      </div>
                      <div className="space-y-1.5">
                        {trigger.gate.checks.map((c) => (
                          <div key={c.name} className="flex items-start gap-2 text-xs">
                            {c.passed ? (
                              <ShieldCheck size={14} color={C.green} className="shrink-0 mt-0.5" />
                            ) : (
                              <ShieldX size={14} color={C.red} className="shrink-0 mt-0.5" />
                            )}
                            <span className="mono shrink-0" style={{ color: c.passed ? C.textMuted : C.red }}>
                              {c.name}
                            </span>
                            <span className="truncate" style={{ color: C.textLo }} title={c.message}>
                              {c.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm py-4 text-center flex flex-col items-center gap-2" style={{ color: C.textLo }}>
                  <CircleDollarSign size={20} style={{ color: C.textMuted }} />
                  Mandate chain seals appear here as the pipeline completes…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function reasonBadge(t: AgentTrigger) {
  return REASON_META[t.reason]?.label ?? t.reason;
}

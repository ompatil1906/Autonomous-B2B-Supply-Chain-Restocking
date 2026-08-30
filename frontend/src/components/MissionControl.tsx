import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Link2,
  MessageCircle,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import type { RunResult } from "../lib/types";
import { C, inr } from "../lib/theme";
import { Breaker } from "./Breaker";
import { MandateSeal } from "./MandateSeal";
import { Console } from "./Console";
import { DecisionEvidence } from "./DecisionEvidence";

/**
 * Mission Control — the agent's reasoning + execution trace for the last run.
 * Reads ONLY from the run result the backend produced; never asserts money
 * moved unless the run actually reached an executed capture.
 */
export function MissionControl({
  result,
  liveNode,
  busy,
  onRun,
  onOpenApprovals,
  lowStockSummary,
  skuCount,
  reserveRemaining,
  ceiling,
  dailyCeiling,
}: {
  result: RunResult | null;
  liveNode: string | null;
  busy: boolean;
  onRun: (scenario: string, overrideQuantity?: number) => void;
  onOpenApprovals: () => void;
  lowStockSummary: string;
  skuCount: number;
  reserveRemaining: number | null;
  ceiling: number;
  dailyCeiling?: number;
}) {
  const [revealed, setRevealed] = useState(-1);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const timers = useRef<number[]>([]);

  // Reveal console steps with slightly irregular, human-feeling delays.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!result) return;
    setRevealed(-1);
    let acc = 0;
    result.steps.forEach((_, i) => {
      acc += 350 + Math.floor(Math.random() * 450);
      const t = window.setTimeout(() => setRevealed(i), acc);
      timers.current.push(t);
    });
    return () => timers.current.forEach(clearTimeout);
  }, [result]);

  const steps = result?.steps ?? [];
  const animating = !!result && revealed < steps.length - 1;
  const running = busy || animating;

  const gateIdx = steps.findIndex((s) => s.kind === "gate");
  const negIdx = steps.findIndex((s) => s.kind === "negotiate");
  const payIdx = steps.findIndex((s) => s.kind === "execute" || s.kind === "escalate");

  const breakerState: "idle" | "closed" | "tripped" =
    !result || gateIdx === -1 || revealed < gateIdx
      ? "idle"
      : result.gate.passed
        ? "closed"
        : "tripped";

  const cartTotal =
    result && negIdx !== -1 && revealed >= negIdx
      ? result.cart?.credentialSubject.total_inr ?? 0
      : 0;
  const cartUnit =
    result && cartTotal ? result.cart?.credentialSubject.items[0].unit_price_inr ?? null : null;
  const cartQty =
    result && cartTotal ? result.cart?.credentialSubject.items[0].quantity ?? null : null;

  const paySealed = result && payIdx !== -1 && revealed >= payIdx;
  const executed = result?.status === "executed";
  const failed = result?.status === "blocked";
  const complete = !!result && revealed >= steps.length - 1;

  return (
    <>
      <div
        className="rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3"
        style={{ background: C.surface, border: `1px solid ${C.hair}` }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: C.textHi }}>
          <ShieldAlert size={16} color={C.brass} />
          {lowStockSummary || `Warehouse nominal across all ${skuCount} SKUs — no restock triggers`}
        </div>
        <div className="flex gap-2 flex-wrap">
          <ScenarioBtn
            label="Run: normal restock"
            tone={C.green}
            dim={C.greenDim}
            onClick={() => onRun("happy")}
            disabled={running}
          />
          <ScenarioBtn
            label="Run: price spike (breach)"
            tone={C.red}
            dim={C.redDim}
            onClick={() => onRun("failure")}
            disabled={running}
          />
          <ScenarioBtn
            label="Run: hallucinated qty"
            tone={C.brass}
            dim={C.brassDim}
            onClick={() => onRun("happy", 10000)}
            disabled={running}
          />
        </div>
      </div>

      {liveNode && busy && (
        <div className="mb-4 text-xs mono" style={{ color: C.textLo }}>
          executing node <span style={{ color: C.brass }}>{liveNode}</span>…
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4">
        <Breaker
          state={breakerState}
          cart={cartTotal}
          ceiling={ceiling}
          dailyCeiling={dailyCeiling}
        />

        <div
          className="rounded-2xl p-5"
          style={{ background: C.surface, border: `1px solid ${C.hair}`, minHeight: 380 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs tracking-wide" style={{ color: C.textLo }}>
              LIVE AGENT CONSOLE
            </div>
            {result && (
              <button
                onClick={() => setEvidenceOpen(true)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                style={{ background: C.accentBlueDim, color: C.accentBlue, border: `1px solid rgba(37,99,235,0.3)` }}
              >
                Receipt & evidence
              </button>
            )}
          </div>
          {!result && (
            <div className="text-sm py-16 text-center" style={{ color: C.textLo }}>
              Run a scenario to watch Warden reason through it, step by step.
            </div>
          )}
          <Console steps={steps} revealed={revealed} />

          {failed && complete && (
            <div
              className="mt-5 rounded-xl p-3"
              style={{ background: C.raised, border: `1px solid ${C.hair}` }}
            >
              <div className="flex items-center gap-2 text-xs mb-2" style={{ color: C.textLo }}>
                <MessageCircle size={13} /> WhatsApp — sent to merchant
              </div>
              <div
                className="rounded-lg rounded-tl-none p-3 text-sm max-w-md"
                style={{ background: C.greenDim, color: C.textHi }}
              >
                {result?.whatsapp_message?.message ??
                  "Supplier increased prices — please approve manually."}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap items-center">
                {result?.payment_link?.short_url && !result.payment_link.simulated && (
                  <a
                    href={result.payment_link.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-xs px-3 py-1.5 rounded-lg items-center gap-1.5 transition-opacity hover:opacity-80"
                    style={{
                      background: C.brassDim,
                      color: C.brass,
                      border: "1px solid rgba(168,127,61,0.4)",
                    }}
                  >
                    <Link2 size={12} /> Open secure approval link
                  </a>
                )}
                {result?.payment_link?.simulated && (
                  <span
                    className="text-xs px-3 py-1.5 rounded-lg mono"
                    title="Created by the offline simulator (remote MCP unreachable) — no live URL exists"
                    style={{
                      background: C.raised,
                      color: C.textLo,
                      border: `1px dashed ${C.hairStrong}`,
                    }}
                  >
                    simulated link — no live URL
                  </span>
                )}
                <button
                  onClick={onOpenApprovals}
                  className="inline-flex text-xs px-3 py-1.5 rounded-lg items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ background: C.redDim, color: C.red, border: "1px solid rgba(222,76,74,0.35)" }}
                >
                  Review in Approvals →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <MandateSeal
            n={1}
            title="IntentMandate"
            status="signed"
            mandate={complete ? result.intent : null}
            fields={[
              ["SKU", result?.sku ?? "—"],
              ["Order cap", inr(ceiling)],
            ]}
          />
          <MandateSeal
            n={2}
            title="CartMandate"
            status={cartTotal ? "signed" : "pending"}
            mandate={complete ? result.cart : null}
            fields={
              cartTotal
                ? [
                    ["Qty", `${cartQty} units`],
                    ["Unit price", inr(cartUnit)],
                    ["Total", inr(cartTotal)],
                  ]
                : [["Awaiting", "supplier response"]]
            }
          />
          <MandateSeal
            n={3}
            title="PaymentMandate"
            status={paySealed ? (executed ? "signed" : "void") : "pending"}
            mandate={complete ? result.payment_mandate : null}
            fields={
              paySealed
                ? executed
                  ? [
                      ["Debited", inr(cartTotal)],
                      ["Rail", "UPI Reserve Pay"],
                      ["Ref", result.capture_result?.id?.slice(0, 18) ?? "—"],
                    ]
                  : [
                      ["Reason", "Order cap exceeded"],
                      ["Funds moved", "None"],
                    ]
                : [["Awaiting", "boundary check"]]
            }
          />
        </div>
      </div>

      {executed && complete && (
        <div
          className="mt-6 rounded-xl p-4 flex items-center gap-6 flex-wrap text-xs"
          style={{ background: C.greenDim, border: "1px solid rgba(14,159,110,0.35)" }}
        >
          <span className="flex items-center gap-2 font-medium" style={{ color: C.green }}>
            <CheckCircle2 size={14} /> Settled autonomously
          </span>
          <span className="mono" style={{ color: C.textHi }}>
            {inr(cartTotal)} captured
          </span>
          <span style={{ color: C.textLo }}>
            Daily pool remaining{" "}
            <span className="mono" style={{ color: C.textHi }}>
              {inr(reserveRemaining)}
            </span>
          </span>
          <span style={{ color: C.textLo }}>
            Stock now{" "}
            <span className="mono" style={{ color: C.textHi }}>
              {result?.stock_after[result!.sku]} units
            </span>
          </span>
        </div>
      )}

      <DecisionEvidence
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        run={result}
        sku={result?.sku ?? "—"}
      />
    </>
  );
}

function ScenarioBtn({
  label,
  tone,
  dim,
  onClick,
  disabled,
}: {
  label: string;
  tone: string;
  dim: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition-opacity hover:opacity-90"
      style={{ background: dim, color: tone, border: `1px solid ${tone}59` }}
    >
      <PlayCircle size={14} /> {label}
    </button>
  );
}
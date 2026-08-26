import { useEffect, useRef, useState } from "react";
import { Timer, Trophy, Flame, Package } from "lucide-react";
import { C } from "../../lib/theme";
import type { ProductView, VelocitySnapshot } from "../../lib/types";
import { StatusChip } from "./ui";

const STEPS = [
  "",
  "blocking funds · signing intent mandate",
  "checking shelf level",
  "requesting supplier quote",
  "verifying boundary checks",
  "executing decision",
  "complete",
];

export function ProductRow({
  product,
  snapshot,
  snapshotAgeMs,
  flashKey,
  isBestSeller = false,
}: {
  product: ProductView;
  snapshot?: VelocitySnapshot;
  snapshotAgeMs: number;
  flashKey: number;
  isBestSeller?: boolean;
}) {
  const [flash, setFlash] = useState(false);
  const prevFlash = useRef(flashKey);

  useEffect(() => {
    if (flashKey && flashKey !== prevFlash.current) {
      prevFlash.current = flashKey;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 220);
      return () => clearTimeout(t);
    }
  }, [flashKey]);

  const upm = snapshot?.unitsPerMinute ?? 0;
  const predRaw = snapshot?.predictedSecondsToStockout;
  const predLeft =
    predRaw === null || predRaw === undefined ? null : Math.max(0, predRaw - snapshotAgeMs / 1000);

  const pct =
    product.referenceStock > 0
      ? Math.max(0, Math.min(100, (product.currentStock / product.referenceStock) * 100))
      : 0;

  const barColor =
    product.status === "sold_out" || product.status === "critical" || product.status === "escalated"
      ? C.red
      : product.status === "watch"
        ? C.heat
        : C.green;

  const working = product.status === "triggered" || product.status === "restocking";
  const step = working ? (product.status === "triggered" ? 1 : 4) : 0;

  return (
    <div
      className="rounded-xl px-5 py-4 transition-shadow duration-200"
      style={{
        background: C.surface,
        border: `1px solid ${flash ? "rgba(14,159,110,0.7)" : isBestSeller ? "rgba(180,83,9,0.4)" : C.hair}`,
        borderLeft: `4px solid ${barColor}`,
        boxShadow: flash
          ? "0 0 0 2px rgba(14,159,110,0.15)"
          : isBestSeller
            ? "0 2px 8px rgba(180,83,9,0.08)"
            : "0 1px 2px rgba(0,0,0,0.02)",
      }}
      title={`${product.sku} · order cap ₹${Math.round(product.reorderCeilingRupees).toLocaleString("en-IN")} · restocks in lots of ${product.restockQty} @ ≤ ₹${product.maxUnitPriceRupees}/unit`}
    >
      <div className="flex flex-col gap-3">
        {/* top row: identity + the number that matters */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold truncate flex items-center gap-2" style={{ color: C.textHi }}>
              {product.name}
              {isBestSeller && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded"
                  style={{ color: C.brass, background: C.brassDim }}
                  title="highest revenue rate on the floor right now"
                >
                  <Trophy size={10} /> BEST SELLER
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="mono text-[11px]" style={{ color: C.textLo }}>
                {product.sku}
                {product.festival && " · festival drop"}
              </span>
              <span style={{ color: C.textMuted }}>·</span>
              <span className="text-[11px]" style={{ color: C.textLo }}>
                Cap: ₹{Math.round(product.reorderCeilingRupees).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0 flex items-center gap-4">
            <StatusChip status={product.status} />
          </div>
        </div>

        {/* prominent stock bar with overlay values */}
        <div className="relative h-7 rounded-lg overflow-hidden bg-slate-100 w-full flex items-center mt-1" style={{ border: `1px solid ${C.hair}` }}>
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: `${pct}%`,
              background: barColor,
              opacity: 0.15,
              transition: "width 900ms cubic-bezier(0.22,1,0.36,1), background-color 400ms",
            }}
          />
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: `${pct}%`,
              borderRight: `2px solid ${barColor}`,
              transition: "width 900ms cubic-bezier(0.22,1,0.36,1), border-color 400ms",
            }}
          />
          <div className="relative w-full px-3 flex justify-between items-center text-xs font-medium z-10">
            <span className="flex items-center gap-1.5" style={{ color: C.textHi }}>
              <Package size={14} style={{ color: barColor }} />
              Stock: <span className="mono text-sm">{product.currentStock}</span> / {product.referenceStock}
            </span>
            <span className="mono text-[11px]" style={{ color: C.textLo }}>{Math.round(pct)}%</span>
          </div>
        </div>

        {/* meta row: velocity & stockout prediction */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 mono text-[11px] px-2.5 py-1 rounded-md font-medium"
            style={{
              color: upm >= 25 ? C.red : upm > 0 ? C.heat : C.textLo,
              background: upm >= 25 ? C.redDim : upm > 0 ? C.heatDim : C.raised,
            }}
            title={`units sold per minute, averaged over the last ${snapshot?.windowSeconds ?? 30}s window`}
          >
            <Flame size={12} className={upm >= 25 ? "animate-pulse" : ""} />
            {upm > 0 ? `${Math.round(upm)} units/min` : "No sales"}
          </span>

          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md"
            style={{
              color: predLeft === null ? C.textLo : predLeft <= 90 ? C.red : predLeft <= 270 ? C.heat : C.textHi,
              background: predLeft === null ? C.raised : predLeft <= 90 ? C.redDim : predLeft <= 270 ? C.heatDim : C.raised,
            }}
          >
            <Timer size={12} />
            {predLeft === null
              ? "No prediction"
              : predLeft <= 0
                ? "Stocked out"
                : `Empty in ${fmtCountdown(predLeft)}`}
          </span>
        </div>

        {/* narrated agent progress */}
        {working && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px dashed ${C.hairStrong}` }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium" style={{ color: C.brass }}>
                Agent Restock in Progress
              </span>
              <span className="mono text-[10px]" style={{ color: C.brass }}>
                Step {step} of 6
              </span>
            </div>
            
            <div className="relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 rounded-full" style={{ background: C.hair }} />
              <div 
                className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full transition-all duration-500" 
                style={{ background: C.brass, width: `${(step / 6) * 100}%` }} 
              />
              
              <div className="relative flex justify-between">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full z-10 transition-colors duration-500"
                    style={{ 
                      background: i <= step ? C.brass : C.surface,
                      border: `1.5px solid ${i <= step ? C.brass : C.hairStrong}`
                    }}
                  />
                ))}
              </div>
            </div>
            
            <div className="text-[11px] font-medium mt-2" style={{ color: C.brass }}>
              {STEPS[step]}…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function fmtCountdown(seconds: number): string {
  const s = Math.round(seconds);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

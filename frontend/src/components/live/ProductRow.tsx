import { useEffect, useRef, useState } from "react";
import { Timer, Trophy } from "lucide-react";
import { C, velocityTone } from "../../lib/theme";
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
      className="rounded-xl px-4 py-3 transition-shadow duration-200"
      style={{
        background: C.surface,
        border: `1px solid ${flash ? "rgba(14,159,110,0.7)" : isBestSeller ? "rgba(168,127,61,0.65)" : C.hair}`,
        boxShadow: flash
          ? "0 0 0 2px rgba(14,159,110,0.15)"
          : isBestSeller
            ? "0 1px 6px rgba(168,127,61,0.12)"
            : "none",
      }}
      title={`${product.sku} · order cap ₹${Math.round(product.reorderCeilingRupees).toLocaleString("en-IN")} · restocks in lots of ${product.restockQty} @ ≤ ₹${product.maxUnitPriceRupees}/unit`}
    >
      {/* top row: identity + the number that matters */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: C.textHi }}>
            {product.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="mono text-[10px]" style={{ color: C.textLo }}>
              {product.sku}
              {product.festival && " · festival drop"}
            </span>
            {isBestSeller && (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-wide px-1.5 py-[2px] rounded"
                style={{ color: C.brass, background: C.brassDim }}
                title="highest revenue rate on the floor right now"
              >
                <Trophy size={9} /> BEST SELLER
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="mono text-[22px] font-semibold leading-none" style={{ color: C.textHi }}>
            {product.currentStock}
          </span>
          <span className="text-[10px] ml-1" style={{ color: C.textLo }}>
            units
          </span>
        </div>
      </div>

      {/* draining stock bar */}
      <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: C.raised }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: barColor,
            transition: "width 900ms cubic-bezier(0.22,1,0.36,1), background-color 400ms",
          }}
        />
      </div>

      {/* meta row */}
      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        <span
          className="mono text-[11px] px-2 py-1 rounded-md font-medium"
          style={{
            color: velocityTone(upm),
            background: upm >= 25 ? C.redDim : upm > 0 ? C.heatDim : C.raised,
          }}
          title={`units sold per minute, averaged over the last ${snapshot?.windowSeconds ?? 30}s window`}
        >
          {upm > 0 ? `Sold ${Math.round(upm)} units/min` : "no sales yet"}
        </span>

        <span
          className="inline-flex items-center gap-1 text-[11px]"
          style={{
            color:
              predLeft === null
                ? C.textLo
                : predLeft <= 90
                  ? C.red
                  : predLeft <= 270
                    ? C.heat
                    : C.textLo,
          }}
        >
          <Timer size={11} />
          {predLeft === null
            ? "—"
            : predLeft <= 0
              ? "stocked out"
              : `stockout in ~${fmtCountdown(predLeft)}`}
        </span>

        <span className="ml-auto">
          <StatusChip status={product.status} />
        </span>
      </div>

      {/* narrated agent progress */}
      {working && (
        <div className="mt-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[3px] rounded-full overflow-hidden flex gap-[2px]">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-colors duration-300"
                  style={{ background: i <= step ? C.brass : C.hair }}
                />
              ))}
            </div>
            <span className="mono text-[9px]" style={{ color: C.brass }}>
              {step}/6
            </span>
          </div>
          <div className="text-[10px] mt-1" style={{ color: C.brass }}>
            agent purchasing — {STEPS[step]}…
          </div>
        </div>
      )}
    </div>
  );
}

export function fmtCountdown(seconds: number): string {
  const s = Math.round(seconds);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

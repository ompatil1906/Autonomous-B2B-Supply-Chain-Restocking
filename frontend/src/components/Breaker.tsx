import { Lock } from "lucide-react";
import { C, inr } from "../lib/theme";
export function Breaker({
  state,
  cart,
  ceiling,
  dailyCeiling,
}: {
  state: "idle" | "closed" | "tripped";
  cart: number;
  ceiling: number;
  dailyCeiling?: number;
}) {
  const pct = Math.min(100, Math.round((cart / ceiling) * 100));
  const over = cart > ceiling;
  const knobTop = state === "closed" ? "6%" : state === "tripped" ? "70%" : "38%";
  const glow = state === "closed" ? C.green : state === "tripped" ? C.red : C.textLo;

  return (
    <div className="rounded-2xl p-5 flex flex-col items-center" style={card()}>
      <div className="flex items-center gap-2 mb-4 self-start">
        <Lock size={14} color={C.brass} />
        <span className="text-xs tracking-wide" style={{ color: C.textLo }}>
          AGENT AUTHORITY
        </span>
      </div>

      <div
        className="relative rounded-full mb-4"
        style={{ width: 56, height: 150, background: C.raised, border: `1px solid ${C.hair}` }}
      >
        <div
          className="absolute left-1/2 rounded-full transition-all duration-700 ease-out"
          style={{
            width: 40,
            height: 40,
            top: knobTop,
            transform: "translateX(-50%)",
            background: glow,
            boxShadow:
              state !== "idle"
                ? `0 0 0 6px ${state === "closed" ? C.greenDim : C.redDim}`
                : "none",
          }}
        />
      </div>

      <div className="text-sm font-medium mb-1" style={{ color: C.textHi }}>
        {state === "closed" && "Engaged"}
        {state === "tripped" && "Tripped"}
        {state === "idle" && "Standing by"}
      </div>
      <div className="text-xs mb-4" style={{ color: C.textLo }}>
        {state === "closed" && "Payment executed within order cap"}
        {state === "tripped" && `Exceeds order cap by ${inr(cart - ceiling)}`}
        {state === "idle" && "Waiting for next agent run"}
      </div>

      <div className="w-full">
        <div className="flex justify-between text-xs mb-1" style={{ color: C.textLo }}>
          <span>Rs.0</span>
          <span>Order cap {inr(ceiling)}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: C.raised }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: over ? C.red : cart ? C.green : "transparent",
            }}
          />
        </div>
        <div className="text-xs mt-2 mono" style={{ color: cart ? C.textHi : C.textLo }}>
          Cart: {cart ? inr(cart) : "—"}
        </div>
        {dailyCeiling != null && (
          <div className="text-[10px] mt-2 leading-snug" style={{ color: C.textLo }}>
            Every debit draws from the shared ₹{Math.round(dailyCeiling / 1000)}k day pool — this
            order cap is one run's mandate boundary.
          </div>
        )}
      </div>
    </div>
  );
}

function card(border?: string) {
  return { background: C.surface, border: `1px solid ${border ?? C.hair}` } as const;
}
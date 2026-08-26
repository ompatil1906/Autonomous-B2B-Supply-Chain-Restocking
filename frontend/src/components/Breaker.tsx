import { Lock, AlertTriangle, ShieldCheck } from "lucide-react";
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
  
  const StatusIcon = state === "closed" ? ShieldCheck : state === "tripped" ? AlertTriangle : Lock;

  return (
    <div className="rounded-2xl p-6 flex flex-col items-center relative overflow-hidden" style={card(state)}>
      {/* Background glow effect based on state */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ 
          background: state === "closed" ? C.green : state === "tripped" ? C.red : "transparent",
        }}
      />

      <div className="flex items-center gap-2 mb-6 self-start relative z-10">
        <Lock size={14} style={{ color: C.textLo }} />
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: C.textLo }}>
          Agent Authority Gate
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full mb-8">
        <div 
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-500"
          style={{ 
            background: state === "closed" ? C.greenDim : state === "tripped" ? C.redDim : C.raised,
            border: `2px solid ${state === "closed" ? C.green : state === "tripped" ? C.red : C.hairStrong}`,
            boxShadow: state === "closed" ? `0 0 20px rgba(16,185,129,0.2)` : state === "tripped" ? `0 0 30px rgba(220,38,38,0.3)` : "none"
          }}
        >
          <StatusIcon size={24} style={{ color: state === "closed" ? C.green : state === "tripped" ? C.red : C.textMuted }} />
        </div>

        <div className="text-lg font-bold mb-1 tracking-tight" style={{ color: state === "tripped" ? C.red : C.textHi }}>
          {state === "closed" && "Gate Passed"}
          {state === "tripped" && "Gate Tripped"}
          {state === "idle" && "Standing By"}
        </div>
        <div className="text-xs text-center px-4" style={{ color: C.textLo }}>
          {state === "closed" && "Payment executed within order cap"}
          {state === "tripped" && `Purchase exceeds daily authority by ${inr(cart - ceiling)}`}
          {state === "idle" && "Waiting for next agent run"}
        </div>
      </div>

      <div className="w-full relative z-10">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.textLo }}>
            Cart Value
          </span>
          <span className="mono text-sm font-semibold" style={{ color: cart ? (over ? C.red : C.textHi) : C.textLo }}>
            {cart ? inr(cart) : "—"}
          </span>
        </div>
        
        <div className="relative h-3 rounded-full bg-slate-100 w-full flex items-center mb-2 overflow-visible" style={{ border: `1px solid ${C.hair}` }}>
          {/* Ceiling marker */}
          <div 
            className="absolute top-[-4px] bottom-[-4px] w-0.5 z-20" 
            style={{ 
              left: `${Math.min(100, (ceiling / Math.max(cart, ceiling)) * 100)}%`, 
              background: C.textHi 
            }}
          />
          
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-700 ease-out z-10"
            style={{
              width: `${pct}%`,
              background: over ? C.red : cart ? C.green : "transparent",
            }}
          />
        </div>

        <div className="flex justify-between items-start">
          <span className="text-[10px] mono" style={{ color: C.textLo }}>₹0</span>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium" style={{ color: C.textHi }}>Limit: {inr(ceiling)}</span>
          </div>
        </div>

        {dailyCeiling != null && (
          <div className="mt-5 p-3 rounded-lg text-[10px] leading-relaxed" style={{ background: C.raised, color: C.textLo, border: `1px solid ${C.hair}` }}>
            Every debit draws from the shared <strong style={{ color: C.textHi }}>₹{Math.round(dailyCeiling / 1000)}k</strong> daily pool. This boundary check prevents the agent from draining the entire pool on a single order.
          </div>
        )}
      </div>
    </div>
  );
}

function card(state: string) {
  return { 
    background: C.surface, 
    border: `1px solid ${state === "tripped" ? "rgba(220,38,38,0.4)" : state === "closed" ? "rgba(16,185,129,0.3)" : C.hair}`,
    boxShadow: state === "tripped" ? "0 4px 20px rgba(220,38,38,0.1)" : "0 1px 3px rgba(0,0,0,0.05)"
  } as const;
}
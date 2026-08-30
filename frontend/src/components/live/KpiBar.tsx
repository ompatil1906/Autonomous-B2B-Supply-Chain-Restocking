import { useEffect, useState } from "react";
import { TrendingUp, ShieldAlert, ShoppingCart, Coins, Radio } from "lucide-react";
import type { DailyBudget, Ticker } from "../../lib/types";
import { C } from "../../lib/theme";

export function KpiBar({
  ticker,
  criticalCount,
  activeRestocks,
  budget,
  connected,
  healthy,
  mode,
}: {
  ticker: Ticker;
  criticalCount: number;
  activeRestocks: number;
  budget: DailyBudget;
  connected: boolean;
  healthy: boolean;
  mode?: string;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, (budget.spentRupees / budget.ceilingRupees) * 100);
  const leftToday = Math.max(0, budget.ceilingRupees - budget.spentRupees);

  return (
    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* 1. Demand Pulse */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between h-full min-h-[140px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <TrendingUp size={16} />
          </div>
          <span className="text-sm font-semibold text-slate-700">Demand Pulse</span>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#1B223C]">
              {ticker.unitsLast5m.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-500 font-medium">units / last 5 min</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold" style={{ color: ticker.unitsLast10s > 0 ? C.green : C.textLo }}>
          <TrendingUp size={14} />
          <span>{Math.max(0, Math.round((ticker.unitsLast10s / Math.max(1, ticker.unitsLast5m / 30)) * 100))}% of 5-min rate (last 10 s)</span>
        </div>
      </div>

      {/* 2. Stockout Risk */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between h-full min-h-[140px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <ShieldAlert size={16} />
          </div>
          <span className="text-sm font-semibold text-slate-700">Stockout Risk</span>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#1B223C]">{criticalCount}</span>
            <span className="text-xs text-slate-500 font-medium">SKUs at risk</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <div className={`w-2 h-2 rounded-full ${criticalCount > 0 ? "bg-red-500" : "bg-green-500"}`} />
          {criticalCount > 0 ? <span className="text-red-600">High risk</span> : <span>Low risk</span>}
        </div>
      </div>

      {/* 3. Restock Pipeline */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between h-full min-h-[140px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
            <ShoppingCart size={16} />
          </div>
          <span className="text-sm font-semibold text-slate-700">Restock Pipeline</span>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#1B223C]">{activeRestocks}</span>
            <span className="text-xs text-slate-500 font-medium">in progress</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-green-600">On track</span>
        </div>
      </div>

      {/* 4. Budget Authority */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between h-full min-h-[140px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Coins size={16} />
          </div>
          <span className="text-sm font-semibold text-slate-700">Budget Authority</span>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#1B223C]">
              ₹{Math.round(leftToday).toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-500 font-medium">available to use</span>
          </div>
        </div>
        <div className="mt-3">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] font-semibold text-slate-500">
            {Math.round(pct)}% used
          </div>
        </div>
      </div>

      {/* 5. Telemetry status */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between h-full min-h-[140px]">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: connected ? C.greenDim : C.amberDim, color: connected ? C.green : C.amber }}
          >
            <Radio size={16} />
          </div>
          <span className="text-sm font-semibold text-slate-700">Telemetry</span>
        </div>
        <div className="mt-4">
          <span className="text-xl font-bold" style={{ color: connected ? C.textHi : C.amber }}>
            {healthy ? "Streaming" : connected ? "Reconnecting" : "Offline"}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-0.5 text-xs text-slate-500 font-medium">
          {mode ? <span>exec mode: {mode.replace(/_/g, " ")}</span> : <span>exec mode: unknown</span>}
          <span>{healthy ? "receiving live events" : "stale — HTTP refresh only"}</span>
        </div>
      </div>
    </div>
  );
}

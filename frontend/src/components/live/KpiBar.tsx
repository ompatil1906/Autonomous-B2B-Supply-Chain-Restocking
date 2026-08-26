import { useEffect, useState } from "react";
import { Flame, ShieldAlert, RefreshCcw, Wallet, Sparkles, Square, Rocket } from "lucide-react";
import { C } from "../../lib/theme";
import type { DailyBudget, Ticker } from "../../lib/types";
import { fmtCompact } from "../../lib/format";
import type { LiveModel } from "../../hooks/useLive";
import { MetricCard } from "../ui/MetricCard";

export function KpiBar({
  ticker,
  criticalCount,
  activeRestocks,
  budget,
  live,
  onToggleFestival,
  busy,
}: {
  ticker: Ticker;
  criticalCount: number;
  activeRestocks: number;
  budget: DailyBudget;
  live: LiveModel;
  onToggleFestival: () => void;
  busy: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, (budget.spentRupees / budget.ceilingRupees) * 100);
  const near = pct >= 75;
  const leftToday = Math.max(0, budget.ceilingRupees - budget.spentRupees);

  const dropInS =
    live.festivalDropAtMs != null ? Math.max(0, (live.festivalDropAtMs - Date.now()) / 1000) : null;

  return (
    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* units sold */}
      <MetricCard
        label="Demand Pulse"
        value={ticker.unitsLast5m.toLocaleString("en-IN")}
        icon={<Flame size={16} />}
        delta={{ value: `${ticker.unitsLast10s} / 10s`, trend: ticker.unitsLast10s > 10 ? "up" : ticker.unitsLast10s === 0 ? "neutral" : "up" }}
        explanation="Units sold in last 5 min"
      />

      <MetricCard
        label="Stockout Risk"
        value={criticalCount}
        icon={<ShieldAlert size={16} />}
        highlight={criticalCount > 0 ? "red" : undefined}
        explanation={criticalCount > 0 ? "Inside AI lead-time" : "All shelves safe"}
      />

      <MetricCard
        label="Active Restocks"
        value={activeRestocks}
        icon={<RefreshCcw size={16} />}
        highlight={activeRestocks > 0 ? "brass" : undefined}
        explanation={activeRestocks > 0 ? "Gated pipelines running" : "Agent standing by"}
      />

      <MetricCard
        label="Budget Authority"
        value={`₹${fmtCompact(budget.spentRupees)}`}
        icon={<Wallet size={16} />}
        highlight={near ? "red" : "brass"}
        explanation={`₹${fmtCompact(leftToday)} left in pool`}
      >
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.raised }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: near ? C.red : C.brass }}
          />
        </div>
      </MetricCard>

      {/* festival switch */}
      <div 
        className="rounded-xl p-5 relative overflow-hidden flex flex-col justify-between group transition-colors cursor-pointer"
        style={{ 
          background: live.festivalActive ? C.redDim : C.greenDim,
          border: `1px solid ${live.festivalActive ? "rgba(220,38,38,0.3)" : "rgba(5,150,105,0.3)"}`,
          opacity: busy ? 0.7 : 1
        }}
        onClick={onToggleFestival}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="text-[11px] font-semibold tracking-[0.05em] uppercase" style={{ color: live.festivalActive ? C.red : C.green }}>
            AI Status
          </div>
          <div style={{ color: live.festivalActive ? C.red : C.green }}>
            <Sparkles size={16} />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: C.surface }}>
            {live.festivalActive ? <Square size={14} color={C.red} /> : <Rocket size={14} color={C.green} />}
          </div>
          <div>
            <div className="text-sm font-semibold mb-0.5" style={{ color: live.festivalActive ? C.red : C.green }}>
              {busy ? "Processing…" : live.festivalActive ? "Stop Drop" : "Run Festival Drop"}
            </div>
            <div className="text-[10px] opacity-80" style={{ color: live.festivalActive ? C.red : C.green }}>
              {dropInS != null
                  ? `launching in ${Math.ceil(dropInS)}s`
                  : live.festivalActive
                    ? "drop live — watch the rail"
                    : "Burst-selling scenario"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

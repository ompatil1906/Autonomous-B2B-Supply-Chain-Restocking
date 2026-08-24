import { useEffect, useState } from "react";
import { Flame, ShieldAlert, RefreshCcw, Wallet, Sparkles } from "lucide-react";
import { C } from "../../lib/theme";
import type { DailyBudget, Ticker } from "../../lib/types";
import { fmtCompact } from "../../lib/format";
import type { LiveModel } from "../../hooks/useLive";

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
    <div
      className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-4"
      style={{ background: `linear-gradient(${C.bg} 85%, transparent)` }}
    >
      <div
        className="grid grid-cols-2 md:grid-cols-[1fr_0.8fr_0.8fr_1.3fr_1fr] rounded-2xl overflow-hidden"
        style={{ background: C.surface, border: `1px solid ${C.hair}` }}
      >
        {/* units sold */}
        <Cell>
          <Label icon={<Flame size={11} />}>Units sold · 5 min</Label>
          <Value>{ticker.unitsLast5m.toLocaleString("en-IN")}</Value>
          <Micro>
            {ticker.unitsLast10s} in last 10s
          </Micro>
        </Cell>

        <Cell divider>
          <Label icon={<ShieldAlert size={11} />}>Products critical</Label>
          <Value tone={criticalCount > 0 ? C.red : undefined}>{criticalCount}</Value>
          <Micro>{criticalCount > 0 ? "inside agent lead-time" : "all shelves safe"}</Micro>
        </Cell>

        <Cell divider>
          <Label icon={<RefreshCcw size={11} />}>Active restocks</Label>
          <Value tone={activeRestocks > 0 ? C.brass : undefined}>{activeRestocks}</Value>
          <Micro>{activeRestocks > 0 ? "gated pipelines running" : "agent standing by"}</Micro>
        </Cell>

        <Cell divider>
          <Label icon={<Wallet size={11} />}>Autonomous spend today</Label>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="mono text-lg font-semibold leading-none" style={{ color: near ? C.red : C.textHi }}>
              ₹{Math.round(budget.spentRupees).toLocaleString("en-IN")}
            </span>
            <span className="mono text-[11px]" style={{ color: C.textLo }}>
              / {fmtCompact(budget.ceilingRupees)}
            </span>
          </div>
          <div className="mt-1.5">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: C.raised }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: near ? C.red : C.brass }}
              />
            </div>
            <div className="text-[9px] mono mt-1" style={{ color: C.textLo }}>
              ₹{Math.round(leftToday).toLocaleString("en-IN")} left · all SKUs share one daily pool
            </div>
          </div>
        </Cell>

        {/* festival switch */}
        <Cell divider last>
          <button
            onClick={onToggleFestival}
            disabled={busy}
            className="w-full h-full text-left disabled:opacity-50 group"
          >
            <Label icon={<Sparkles size={11} />}>Festival mode</Label>
            <div
              className="mono text-[13px] font-medium leading-none mt-1 transition-colors"
              style={{ color: live.festivalActive ? C.red : C.green }}
            >
              {busy ? "…" : live.festivalActive ? "Stop drop" : "Run festival drop"}
            </div>
            <Micro tone={live.festivalActive ? C.red : undefined}>
              {dropInS != null
                ? `launching in ${Math.ceil(dropInS)}s`
                : live.festivalActive
                  ? "drop live — watch the rail"
                  : "3 SKUs · burst-selling scenario"}
            </Micro>
          </button>
        </Cell>
      </div>
    </div>
  );
}

function Cell({
  children,
  divider,
  last,
}: {
  children: React.ReactNode;
  divider?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`px-4 py-3 ${last ? "" : ""}`}
      style={divider ? { borderLeft: `1px solid ${C.hair}` } : undefined}
    >
      {children}
    </div>
  );
}

function Label({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.08em] uppercase"
      style={{ color: C.textLo }}
    >
      {icon}
      {children}
    </div>
  );
}

function Value({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div className="mono text-lg font-semibold leading-tight mt-1" style={{ color: tone ?? C.textHi }}>
      {children}
    </div>
  );
}

function Micro({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div className="text-[9px] mt-1 truncate" style={{ color: tone ?? C.textLo }}>
      {children}
    </div>
  );
}

import { useState } from "react";
import { Activity, Zap, Rocket } from "lucide-react";
import { api } from "../../lib/api";
import { C } from "../../lib/theme";
import type { AgentTrigger, AuditRecord } from "../../lib/types";
import type { LiveModel } from "../../hooks/useLive";
import { KpiBar } from "./KpiBar";
import { FestivalRail, ShopFloor } from "./ShopFloor";
import { AgentOpsPanel } from "./AgentOpsPanel";

export function LiveOpsScreen({
  live,
  audit,
  onOpenLedger,
  onApprovalsChanged,
}: {
  live: LiveModel;
  audit: AuditRecord[];
  onOpenLedger: () => void;
  onApprovalsChanged: () => void;
}) {
  const [festivalBusy, setFestivalBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const criticalCount = live.products.filter((p) => p.status === "critical").length;
  const activeRestocks = live.triggers.filter((t) => t.outcome === "in_progress").length;

  const toggleFestival = async () => {
    setFestivalBusy(true);
    try {
      if (live.festivalActive) {
        await api.festivalStop();
      } else {
        await api.festivalStart(10); // drop lands 10s after the click
      }
      await live.refresh();
    } finally {
      setFestivalBusy(false);
    }
  };

  const act = async (t: AgentTrigger, kind: "approve" | "reject") => {
    if (!t.escalationId || actionBusy) return;
    setActionBusy(true);
    try {
      if (kind === "approve") await api.approveApproval(t.escalationId);
      else await api.rejectApproval(t.escalationId);
      onApprovalsChanged();
      await live.refresh();
    } finally {
      setActionBusy(false);
    }
  };

  const calm = !live.festivalActive && live.triggers.length === 0;

  return (
    <div className="pb-12">
      {/* ---------------- top: AI header ---------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.textHi }}>
            Warden Mission Control
          </h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: C.textLo }}>
            <Activity size={14} className={live.healthy ? "text-green-500 animate-pulse" : "text-amber-500"} />
            {live.healthy 
              ? "Agent active · Monitoring 6 SKUs · Velocity engine running"
              : "Connecting to agent..."}
          </p>
        </div>
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: C.textLo }}>Business Overview</h2>
        <p className="text-xs mb-4" style={{ color: C.textMuted }}>Live revenue, inventory health, and active stockouts.</p>
        <KpiBar
          ticker={live.ticker}
          criticalCount={criticalCount}
          activeRestocks={activeRestocks}
          budget={live.budget}
          live={live}
          onToggleFestival={toggleFestival}
          busy={festivalBusy}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[58fr_42fr] gap-6 items-start mt-8">
        {/* ---------------- left: shop floor ---------------- */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-bold tracking-widest uppercase mb-1" style={{ color: C.textLo }}>Growth Opportunities & Floor</h2>
            <p className="text-xs mb-4" style={{ color: C.textMuted }}>Live shelf telemetry and active velocity monitoring.</p>
          </div>
          <FestivalRail products={live.products} snapshots={live.snapshots} />
          
          <ShopFloor
            products={live.products}
            snapshots={live.snapshots}
            snapshotAt={live.snapshotAt}
            lastSaleAt={live.lastSaleAt}
            ticker={live.ticker}
            connected={live.healthy}
          />
          {!live.healthy && (
            <div className="mt-3 text-xs mono text-center py-2 rounded-lg animate-pulse" style={{ background: C.redDim, color: C.red }}>
              event stream offline — retrying (data refreshes over HTTP meanwhile)…
            </div>
          )}
          {calm && (
            <button
              onClick={toggleFestival}
              disabled={festivalBusy}
              className="w-full rounded-xl px-4 py-4 flex items-center gap-4 text-left disabled:opacity-60 transition-all group relative overflow-hidden"
              style={{
                background: C.surface,
                border: "1px solid rgba(14,159,110,0.55)",
                boxShadow: "0 0 0 0 rgba(20,184,166,0.35)",
                animation: "ctaPulse 2s ease-out infinite",
              }}
            >
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                style={{ background: C.greenDim, color: C.green }}
              >
                <Rocket size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold" style={{ color: C.textHi }}>
                  Shelves are calm — launch the burst-selling scenario
                </span>
                <span className="block text-xs mt-0.5" style={{ color: C.textLo }}>
                  Three festival SKUs drop at once. Watch Warden predict stockouts from sales velocity and buy before shelves empty.
                </span>
              </span>
              <span
                className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg group-hover:opacity-90 transition-opacity"
                style={{ background: C.greenDim, color: C.green, border: "1px solid rgba(14,159,110,0.45)" }}
              >
                Launch
                <Zap size={13} />
              </span>
            </button>
          )}
        </div>

        {/* ---------------- right: agent ops ---------------- */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-bold tracking-widest uppercase mb-1" style={{ color: C.textLo }}>AI Intelligence & Execution</h2>
            <p className="text-xs mb-4" style={{ color: C.textMuted }}>Warden agent decisions, spending authority, and ledger.</p>
          </div>
          <AgentOpsPanel
          budget={live.budget}
          triggers={live.triggers}
          ledgerTail={audit}
          actionBusy={actionBusy}
          onApprove={(t) => act(t, "approve")}
          onReject={(t) => act(t, "reject")}
          onOpenLedger={onOpenLedger}
        />
        </div>
      </div>
    </div>
  );
}

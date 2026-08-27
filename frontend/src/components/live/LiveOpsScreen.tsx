import { useState } from "react";
import { Activity, Zap, Rocket, Square } from "lucide-react";
import { api } from "../../lib/api";
import { C } from "../../lib/theme";
import type { AgentTrigger, AuditRecord } from "../../lib/types";
import type { LiveModel } from "../../hooks/useLive";
import { KpiBar } from "./KpiBar";
import { LiveInventoryChart } from "./LiveInventoryChart";
import { AiRecommendations } from "./AiRecommendations";
import { RestockPipeline } from "./RestockPipeline";
import { RecentActivity } from "./RecentActivity";
import { SystemHealth } from "./SystemHealth";

export function LiveOpsScreen({
  live,
  audit,
  onOpenLedger,
  onOpenOverview,
  onApprovalsChanged,
}: {
  live: LiveModel;
  audit: AuditRecord[];
  onOpenLedger: () => void;
  onOpenOverview: () => void;
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
      <div className="mb-8">
        <KpiBar
          ticker={live.ticker}
          criticalCount={criticalCount}
          activeRestocks={activeRestocks}
          budget={live.budget}
        />
      </div>

      <div className="flex flex-col gap-6">
        {/* Middle row: Chart + AI Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LiveInventoryChart products={live.products} snapshots={live.snapshots} />
          </div>
          <div className="lg:col-span-1">
            <AiRecommendations products={live.products} snapshots={live.snapshots} act={act} />
          </div>
        </div>

        {/* Bottom row: Pipeline + Activity + Health */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2">
            <RestockPipeline triggers={live.triggers} products={live.products} onOpenLedger={onOpenLedger} />
          </div>
          <div className="lg:col-span-1">
            <RecentActivity audit={audit} triggers={live.triggers} products={live.products} onOpenLedger={onOpenLedger} />
          </div>
          <div className="lg:col-span-1">
            <SystemHealth connected={live.connected} healthy={live.healthy} onOpenOverview={onOpenOverview} />
          </div>
        </div>
      </div>
    </div>
  );
}

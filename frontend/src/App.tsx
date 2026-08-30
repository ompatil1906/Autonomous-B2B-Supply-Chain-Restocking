import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import type {
  ApprovalRecord,
  AuditRecord,
  Inventory,
  RunResult,
  SystemStatus,
} from "./lib/types";
import type { TabId } from "./lib/nav";
import { C } from "./lib/theme";

import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { TabBar } from "./components/layout/TabBar";
import { Overview } from "./components/Overview";
import { Approvals } from "./components/Approvals";
import { LedgerTable } from "./components/LedgerTable";
import { ConfigureTab } from "./components/ConfigureTab";
import { MissionControl } from "./components/MissionControl";
import { DemoDrawer } from "./components/DemoDrawer";
import { InventoryScreen } from "./components/InventoryScreen";
import { RestockPipelineScreen } from "./components/RestockPipelineScreen";
import { SuppliersScreen } from "./components/SuppliersScreen";
import { PaymentsScreen } from "./components/PaymentsScreen";
import { LandingPage } from "./components/LandingPage";
import { useLive } from "./hooks/useLive";

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [tab, setTab] = useState<TabId>("live");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [reserveRemaining, setReserveRemaining] = useState<number | null>(null);
  const [blockRef, setBlockRef] = useState<string>("—");
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [approvalsList, setApprovalsList] = useState<ApprovalRecord[]>([]);

  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveNode, setLiveNode] = useState<string | null>(null);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">("connecting");

  const ceiling = status?.ap2_limit_inr ?? 10_000;
  const pendingCount = approvalsList.filter((a) => a.status === "pending").length;

  const refresh = useCallback(async () => {
    const [s, inv, aud, appr, res] = await Promise.all([
      api.status(),
      api.inventory(),
      api.audit(),
      api.approvals(),
      api.reserve(),
    ]);
    setStatus(s);
    setInventory(inv);
    setAudit(aud.records.slice().reverse()); // newest-first for feeds
    setApprovalsList([...appr.pending, ...appr.resolved]);
    const blocks = res.blocks ?? [];
    if (blocks.length) {
      setReserveRemaining(blocks[blocks.length - 1].remaining_inr);
      setBlockRef(blocks[blocks.length - 1].block_id.toUpperCase());
    }
  }, []);

  // one socket feeds everything — Live Ops model + mission console + approvals badge
  const handleWsEvent = useCallback(
    (e: any) => {
      if (e.type === "node") setLiveNode(e.node);
      if (e.type === "approval_updated" || e.type === "run_completed") refresh().catch(console.error);
    },
    [refresh],
  );

  const live = useLive(handleWsEvent);

  useEffect(() => {
    refresh().catch(console.error);
    api
      .latest()
      .then((r) => r && r.latest && setResult(r.latest))
      .catch(() => {});
    const check = setInterval(() => {
      api.health()
        .then(() => setWsState("open"))
        .catch(() => setWsState("closed"));
    }, 5000);
    api.health()
      .then(() => setWsState("open"))
      .catch(() => setWsState("closed"));
    return () => clearInterval(check);
  }, [refresh]);

  if (showIntro) {
    return <LandingPage onComplete={() => setShowIntro(false)} />;
  }

  const run = (scenario: string, overrideQuantity?: number) => {
    setBusy(true);
    setLiveNode(null);
    api
      .run({ scenario, override_quantity: overrideQuantity, reset_inventory: true })
      .then((r) => {
        setTab("mission");
        setResult(r);
        setBusy(false);
        refresh().catch(console.error);
      })
      .catch((e) => {
        console.error(e);
        setBusy(false);
      });
  };

  const lowStocks = inventory?.catalog.filter((s) => s.stock < s.reorder_threshold) ?? [];
  const lowStockSummary = lowStocks.length
    ? `Low-stock triggers: ${lowStocks
        .map((s) => `${s.sku} (${s.stock} left, threshold ${s.reorder_threshold})`)
        .join(" · ")}`
    : "";

  const getHeaderInfo = (tabId: TabId) => {
    switch (tabId) {
      case "overview":
        return { title: "Overview", subtitle: "System status and performance metrics" };
      case "live":
        return { title: "Live Intel", subtitle: "Real-time overview of your restocking operations" };
      case "mission":
        return { title: "Mission Control", subtitle: "Agent reasoning and execution trace" };
      case "inventory":
        return { title: "Inventory", subtitle: "Stock, velocity and projected risk per SKU" };
      case "pipeline":
        return { title: "Restock Pipeline", subtitle: "Every decision — in flight, executed or blocked" };
      case "suppliers":
        return { title: "Suppliers", subtitle: "Verified counterparties and actual purchasing" };
      case "approvals":
        return { title: "Approvals", subtitle: "Pending escalations and manual overrides" };
      case "payments":
        return { title: "Payments", subtitle: "Razorpay activity — every leg, honestly labelled" };
      case "ledger":
        return { title: "Audit Trail", subtitle: "Immutable record of all agent actions" };
      case "configure":
        return { title: "Configuration", subtitle: "Constraints, behavior settings and credentials" };
      default:
        return { title: "Mission Control", subtitle: "Real-time overview of your restocking operations" };
    }
  };

  const headerInfo = getHeaderInfo(tab);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg }}>
      <Sidebar
        activeTab={tab}
        onTabSelect={setTab}
        pendingCount={pendingCount}
        skuCount={live.products.length}
        connected={live.connected}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          wsState={wsState}
          mode={status?.razorpay_execution_mode}
          onHome={() => setShowIntro(true)}
        />

        <TabBar activeTab={tab} onTabSelect={setTab} pendingCount={pendingCount} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 relative">
          <div className="max-w-[1400px] mx-auto pb-24">
            {tab === "live" && (
              <LiveOpsHost live={live} audit={audit} status={status} onLedger={() => setTab("ledger")} onOverview={() => setTab("overview")} />
            )}

            {tab === "overview" && (
              <Overview
                status={status}
                inventory={inventory}
                audit={audit}
                pendingCount={pendingCount}
                live={live}
                onOpenMission={() => setTab("mission")}
                onOpenApprovals={() => setTab("approvals")}
              />
            )}

            {tab === "inventory" && <InventoryScreen live={live} inventory={inventory} status={status} />}

            {tab === "pipeline" && <RestockPipelineScreen live={live} />}

            {tab === "suppliers" && <SuppliersScreen />}

            {tab === "payments" && <PaymentsScreen />}

            {tab === "mission" && (
              <MissionControl
                result={result}
                liveNode={liveNode}
                busy={busy}
                onRun={run}
                onOpenApprovals={() => setTab("approvals")}
                lowStockSummary={lowStockSummary}
                skuCount={inventory?.catalog.length ?? 0}
                reserveRemaining={reserveRemaining}
                ceiling={ceiling}
                dailyCeiling={status?.ap2_daily_ceiling_inr}
              />
            )}

            {tab === "approvals" && (
              <Approvals
                reloadKey={audit.length + approvalsList.length}
                names={Object.fromEntries(
                  (live.products.length ? live.products : inventory?.catalog ?? []).map((p) => [p.sku, p.name]),
                )}
              />
            )}

            {tab === "ledger" && <LedgerTable records={audit.slice().reverse()} />}

            {tab === "configure" && (
              <ConfigureTab
                status={status}
                blockRef={blockRef}
                remaining={reserveRemaining}
                ceiling={ceiling}
                dailyCeiling={status?.ap2_daily_ceiling_inr}
                lowStockThreshold={inventory?.catalog.find((s) => s.sku === status?.ap2_sku)?.reorder_threshold}
              />
            )}
          </div>
        </main>
      </div>

      <DemoDrawer live={live} onRun={run} />
    </div>
  );
}

// Live Intel page host — keeps App.tsx from re-declaring wiring.
import { LiveOpsScreen } from "./components/live/LiveOpsScreen";
function LiveOpsHost({
  live,
  audit,
  status,
  onLedger,
  onOverview,
}: {
  live: ReturnType<typeof useLive>;
  audit: AuditRecord[];
  status: SystemStatus | null;
  onLedger: () => void;
  onOverview: () => void;
}) {
  return <LiveOpsScreen live={live} audit={audit} status={status} onOpenLedger={onLedger} onOpenOverview={onOverview} />;
}
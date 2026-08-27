import { useCallback, useEffect, useRef, useState } from "react";
import { Rocket, Square } from "lucide-react";
import { api } from "./lib/api";
import type {
  ApprovalRecord, AuditRecord, Inventory, RunResult, SystemStatus,
} from "./lib/types";
import { C, inr } from "./lib/theme";

// Components
import { Header } from "./components/layout/Header";
import { TabBar, TabId } from "./components/layout/TabBar";
import { Breaker } from "./components/Breaker";
import { MandateSeal } from "./components/MandateSeal";
import { Console } from "./components/Console";
import { Overview } from "./components/Overview";
import { Approvals } from "./components/Approvals";
import { LedgerTable } from "./components/LedgerTable";
import { ConfigureTab } from "./components/ConfigureTab";
import { LiveOpsScreen } from "./components/live/LiveOpsScreen";
import { LandingPage } from "./components/LandingPage";
import { useLive } from "./hooks/useLive";
import { ShieldAlert, PlayCircle, Link2, MessageCircle, CheckCircle2 } from "lucide-react";

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
  const [revealed, setRevealed] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [liveNode, setLiveNode] = useState<string | null>(null);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">("connecting");
  const timers = useRef<number[]>([]);

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
      .then((r) => r.latest && setResult(r.latest))
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

  // Reveal console steps with slightly irregular, human-feeling delays.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!result) return;
    setRevealed(-1);
    let acc = 0;
    result.steps.forEach((_, i) => {
      acc += 350 + Math.floor(Math.random() * 450);
      const t = window.setTimeout(() => setRevealed(i), acc);
      timers.current.push(t);
    });
    return () => timers.current.forEach(clearTimeout);
  }, [result]);

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

  const steps = result?.steps ?? [];
  const animating = !!result && revealed < steps.length - 1;
  const running = busy || animating;

  const gateIdx = steps.findIndex((s) => s.kind === "gate");
  const negIdx = steps.findIndex((s) => s.kind === "negotiate");
  const payIdx = steps.findIndex((s) => s.kind === "execute" || s.kind === "escalate");

  const breakerState: "idle" | "closed" | "tripped" =
    !result || gateIdx === -1 || revealed < gateIdx
      ? "idle"
      : result.gate.passed
        ? "closed"
        : "tripped";

  const cartTotal =
    result && negIdx !== -1 && revealed >= negIdx
      ? result.cart.credentialSubject.total_inr
      : 0;
  const cartUnit =
    result && cartTotal ? result.cart.credentialSubject.items[0].unit_price_inr : null;
  const cartQty = result && cartTotal ? result.cart.credentialSubject.items[0].quantity : null;

  const paySealed = result && payIdx !== -1 && revealed >= payIdx;
  const executed = result?.status === "executed";
  const failed = result?.status === "blocked";
  const complete = !!result && revealed >= steps.length - 1;

  const lowStocks = inventory?.catalog.filter((s) => s.stock < s.reorder_threshold) ?? [];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--color-bg)]">
      <Header wsState={wsState} onHome={() => setShowIntro(true)} />
      <TabBar activeTab={tab} onTabSelect={setTab} pendingCount={pendingCount} />
      
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
        {/* Floating Demo Controls for presentation */}
        <div className="fixed bottom-6 right-6 z-50 w-72 bg-white rounded-2xl p-4 shadow-2xl shadow-black/10 border border-slate-200">
          <div className="text-[10px] font-bold tracking-widest mb-3 text-slate-400">
            PRESENTER TOOLS
          </div>
          <DemoControls live={live} />
        </div>

        <div className="max-w-[1400px] mx-auto animate-slide-in pb-24">
            {tab === "live" && (
              <LiveOpsScreen
                live={live}
                audit={audit}
                onOpenLedger={() => setTab("ledger")}
                onApprovalsChanged={() => refresh().catch(console.error)}
              />
            )}

            {tab === "overview" && (
              <Overview
                status={status}
                inventory={inventory}
                audit={audit}
                pendingCount={pendingCount}
                spentToday={live.budget.spentRupees}
                onOpenMission={() => setTab("mission")}
                onOpenApprovals={() => setTab("approvals")}
              />
            )}

            {tab === "mission" && (
              <>
                <div
                  className="rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3"
                  style={{ background: C.surface, border: `1px solid ${C.hair}` }}
                >
                  <div className="flex items-center gap-2 text-sm" style={{ color: C.textHi }}>
                    <ShieldAlert size={16} color={C.brass} />
                    {lowStocks.length
                      ? `Low-stock triggers: ${lowStocks
                          .map((s) => `${s.sku} (${s.stock} left, threshold ${s.reorder_threshold})`)
                          .join(" · ")}`
                      : `Warehouse nominal across all ${inventory?.catalog.length ?? 0} SKUs — no restock triggers`}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <ScenarioBtn label="Run: normal restock" tone={C.green} dim={C.greenDim} onClick={() => run("happy")} disabled={running} />
                    <ScenarioBtn label="Run: price spike (breach)" tone={C.red} dim={C.redDim} onClick={() => run("failure")} disabled={running} />
                    <ScenarioBtn label="Run: hallucinated qty" tone={C.brass} dim={C.brassDim} onClick={() => run("happy", 10000)} disabled={running} />
                  </div>
                </div>

                {liveNode && busy && (
                  <div className="mb-4 text-xs mono" style={{ color: C.textLo }}>
                    executing node <span style={{ color: C.brass }}>{liveNode}</span>…
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4">
                    <Breaker state={breakerState} cart={cartTotal} ceiling={ceiling} dailyCeiling={status?.ap2_daily_ceiling_inr} />

                  <div
                    className="rounded-2xl p-5"
                    style={{ background: C.surface, border: `1px solid ${C.hair}`, minHeight: 380 }}
                  >
                    <div className="text-xs mb-4 tracking-wide" style={{ color: C.textLo }}>
                      LIVE AGENT CONSOLE
                    </div>
                    {!result && (
                      <div className="text-sm py-16 text-center" style={{ color: C.textLo }}>
                        Run a scenario to watch Warden reason through it, step by step.
                      </div>
                    )}
                    <Console steps={steps} revealed={revealed} />

                    {failed && complete && (
                      <div className="mt-5 rounded-xl p-3" style={{ background: C.raised, border: `1px solid ${C.hair}` }}>
                        <div className="flex items-center gap-2 text-xs mb-2" style={{ color: C.textLo }}>
                          <MessageCircle size={13} /> WhatsApp — sent to merchant
                        </div>
                        <div
                          className="rounded-lg rounded-tl-none p-3 text-sm max-w-md"
                          style={{ background: C.greenDim, color: C.textHi }}
                        >
                          {result?.whatsapp_message?.message ?? "Supplier increased prices — please approve manually."}
                        </div>
                        <div className="mt-2 flex gap-2 flex-wrap items-center">
                          {result?.payment_link?.short_url && !result.payment_link.simulated && (
                            <a
                              href={result.payment_link.short_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-xs px-3 py-1.5 rounded-lg items-center gap-1.5 transition-opacity hover:opacity-80"
                              style={{ background: C.brassDim, color: C.brass, border: "1px solid rgba(168,127,61,0.4)" }}
                            >
                              <Link2 size={12} /> Open secure approval link
                            </a>
                          )}
                          {result?.payment_link?.simulated && (
                            <span
                              className="text-xs px-3 py-1.5 rounded-lg mono"
                              title="Created by the offline simulator (remote MCP unreachable) — no live URL exists"
                              style={{ background: C.raised, color: C.textLo, border: `1px dashed ${C.hairStrong}` }}
                            >
                              simulated link — no live URL
                            </span>
                          )}
                          <button
                            onClick={() => setTab("approvals")}
                            className="inline-flex text-xs px-3 py-1.5 rounded-lg items-center gap-1.5 transition-opacity hover:opacity-80"
                            style={{ background: C.redDim, color: C.red, border: "1px solid rgba(222,76,74,0.35)" }}
                          >
                            Review in Approvals →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <MandateSeal
                      n={1}
                      title="IntentMandate"
                      status="signed"
                      mandate={complete ? result.intent : null}
                      fields={[
                        ["SKU", status?.ap2_sku ?? "—"],
                        ["Max qty", `${status?.ap2_max_qty ?? "—"} units`],
                        ["Max unit price", inr(status?.ap2_max_unit_price)],
                        ["Order cap", inr(ceiling)],
                      ]}
                    />
                    <MandateSeal
                      n={2}
                      title="CartMandate"
                      status={cartTotal ? "signed" : "pending"}
                      mandate={complete ? result.cart : null}
                      fields={
                        cartTotal
                          ? [
                              ["Qty", `${cartQty} units`],
                              ["Unit price", inr(cartUnit)],
                              ["Total", inr(cartTotal)],
                            ]
                          : [["Awaiting", "supplier response"]]
                      }
                    />
                    <MandateSeal
                      n={3}
                      title="PaymentMandate"
                      status={paySealed ? (executed ? "signed" : "void") : "pending"}
                      mandate={complete ? result.payment_mandate : null}
                      fields={
                        paySealed
                          ? executed
                            ? [
                                ["Debited", inr(cartTotal)],
                                ["Rail", "UPI Reserve Pay"],
                                ["Ref", result.capture_result?.id?.slice(0, 18) ?? "—"],
                              ]
                            : [
                                ["Reason", "Order cap exceeded"],
                                ["Funds moved", "None"],
                              ]
                          : [["Awaiting", "boundary check"]]
                      }
                    />
                  </div>
                </div>

                {executed && complete && (
                  <div
                    className="mt-6 rounded-xl p-4 flex items-center gap-6 flex-wrap text-xs"
                    style={{ background: C.greenDim, border: "1px solid rgba(14,159,110,0.35)" }}
                  >
                    <span className="flex items-center gap-2 font-medium" style={{ color: C.green }}>
                      <CheckCircle2 size={14} /> Settled autonomously
                    </span>
                    <span className="mono" style={{ color: C.textHi }}>{inr(cartTotal)} captured</span>
                    <span style={{ color: C.textLo }}>
                      Daily pool remaining{" "}
                      <span className="mono" style={{ color: C.textHi }}>{inr(reserveRemaining)}</span>
                    </span>
                    <span style={{ color: C.textLo }}>
                      Stock now{" "}
                      <span className="mono" style={{ color: C.textHi }}>
                        {result?.stock_after[result!.sku]} units
                      </span>
                    </span>
                  </div>
                )}
              </>
            )}

            {tab === "approvals" && (
              <Approvals
                reloadKey={audit.length + approvalsList.length}
                names={Object.fromEntries(
                  (live.products.length ? live.products : inventory?.catalog ?? []).map((p) => [p.sku, p.name])
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
  );
}

function ScenarioBtn({
  label,
  tone,
  dim,
  onClick,
  disabled,
}: {
  label: string;
  tone: string;
  dim: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition-opacity hover:opacity-90"
      style={{
        background: dim,
        color: tone,
        border: `1px solid ${tone}59`,
      }}
    >
      <PlayCircle size={14} /> {label}
    </button>
  );
}

/** Demo controls moved to a separate component to render inside the sidebar */
function DemoControls({ live }: { live: ReturnType<typeof useLive> }) {
  const [festivalBusy, setFestivalBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);

  const toggleFestival = async () => {
    setFestivalBusy(true);
    try {
      if (live.festivalActive) await api.festivalStop();
      else await api.festivalStart(10);
      await live.refresh();
    } finally {
      setFestivalBusy(false);
    }
  };

  const probe = async (sku: string) => {
    setProbeBusy(true);
    try {
      await api.probe(sku);
    } catch {
      /* already restocking */
    } finally {
      setProbeBusy(false);
    }
  };

  const skus = live.products.length
    ? live.products.map((p) => p.sku)
    : ["SKU-404", "SKU-101", "SKU-203"];

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={toggleFestival}
        disabled={festivalBusy}
        className="w-full flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity font-medium"
        style={{
          background: live.festivalActive ? C.redDim : C.greenDim,
          color: live.festivalActive ? C.red : C.green,
          border: `1px solid ${live.festivalActive ? "rgba(220,38,38,0.3)" : "rgba(5,150,105,0.3)"}`,
        }}
      >
        {live.festivalActive ? <Square size={13} /> : <Rocket size={13} />}
        {festivalBusy ? "…" : live.festivalActive ? "Stop drop" : "Start drop (10s)"}
      </button>

      <div>
        <div className="text-[10px] mb-1.5" style={{ color: C.textLo }}>
          Force a SKU through pipeline:
        </div>
        <div className="flex flex-wrap gap-1">
          {skus.map((sku) => (
            <button
              key={sku}
              disabled={probeBusy}
              onClick={() => probe(sku)}
              className="mono text-[10px] px-2 py-1 rounded disabled:opacity-40 hover:opacity-80 transition-opacity"
              style={{ background: C.raised, color: C.textHi, border: `1px solid ${C.hair}` }}
              title={`manual probe — ${sku}`}
            >
              {sku.replace("SKU-", "")}
            </button>
          ))}
        </div>
      </div>
      
      <div className="text-[10px] leading-relaxed p-2 rounded bg-slate-50 text-slate-500 mt-2">
        Tip: run the festival drop twice to exhaust the ₹1 lakh daily pool and watch the portfolio-cap escalation fire live.
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2, FlaskConical, Link2, Lock, MessageCircle, PlayCircle,
  Radio, Rocket, ShieldAlert, Square,
} from "lucide-react";
import { api } from "./lib/api";
import type {
  ApprovalRecord, AuditRecord, Inventory, RunResult, SystemStatus,
} from "./lib/types";
import { C, inr } from "./lib/theme";
import { Breaker } from "./components/Breaker";
import { MandateSeal } from "./components/MandateSeal";
import { Console } from "./components/Console";
import { Overview } from "./components/Overview";
import { Approvals } from "./components/Approvals";
import { LedgerTable } from "./components/LedgerTable";
import { ConfigureTab } from "./components/ConfigureTab";
import { LiveOpsScreen } from "./components/live/LiveOpsScreen";
import { useLive } from "./hooks/useLive";

type Tab = "live" | "overview" | "mission" | "approvals" | "ledger" | "configure";

export default function App() {
  const [tab, setTab] = useState<Tab>("live");
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
      fetch("/api/reserve").then((r) => r.json()),
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
      fetch("/api/health")
        .then(() => setWsState("open"))
        .catch(() => setWsState("closed"));
    }, 5000);
    fetch("/api/health")
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

  const pillTone =
    wsState === "open" ? C.green : wsState === "connecting" ? C.amber : C.red;

  const tabs: [Tab, string][] = [
    ["live", "Live Ops"],
    ["overview", "Overview"],
    ["mission", "Mission control"],
    ["approvals", "Approvals"],
    ["ledger", "Audit ledger"],
    ["configure", "Configure agent"],
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: C.brassDim, border: "1px solid rgba(168,127,61,0.4)" }}
          >
            <Lock size={16} color={C.brass} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide" style={{ color: C.textHi }}>
              WARDEN
            </div>
            <div className="text-xs" style={{ color: C.textLo }}>
              Autonomous procurement · AP2 × UPI Reserve Pay × Razorpay MCP
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: pillTone }}>
            <Radio size={12} className={wsState === "open" ? "animate-pulse" : ""} />
            {wsState === "open" ? "LIVE · test mode" : wsState === "connecting" ? "CONNECTING" : "BACKEND OFFLINE"}
          </span>
          <DemoControls live={live} />
          <div className="flex gap-1 p-1 rounded-lg flex-wrap" style={{ background: C.raised }}>
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  background: tab === key ? C.surface : "transparent",
                  border: tab === key ? `1px solid ${C.hair}` : "1px solid transparent",
                  color: tab === key ? C.textHi : C.textLo,
                  fontWeight: tab === key ? 500 : 400,
                }}
              >
                {label}
                {key === "approvals" && pendingCount > 0 && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center rounded-full mono"
                    style={{
                      background: C.redDim, color: C.red,
                      fontSize: 10, minWidth: 16, height: 16, padding: "0 4px",
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        {tab === "live" && (
          <LiveOpsScreen
            live={live}
            audit={audit}
            onOpenLedger={() => setTab("ledger")}
            onApprovalsChanged={() => refresh().catch(console.error)}
          />        )}

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

/** Demo controls — tucked into the header so the canvas stays clean. */
function DemoControls({ live }: { live: ReturnType<typeof useLive> }) {
  const [open, setOpen] = useState(false);
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
    <div className="relative">
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative z-40 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors hover:opacity-90"
        style={{
          background: open ? C.brassDim : C.surface,
          border: `1px solid ${open ? "rgba(168,127,61,0.4)" : C.hair}`,
          color: open ? C.brass : C.textLo,
        }}
        title="Demo controls"
      >
        <FlaskConical size={13} />
        Demo
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-xl p-4 shadow-xl z-40"
          style={{ background: C.surface, border: `1px solid ${C.hairStrong}` }}
        >
          <div className="text-[10px] font-semibold tracking-[0.08em] mb-3" style={{ color: C.textLo }}>
            PRESENTER CONTROLS
          </div>

          <button
            onClick={toggleFestival}
            disabled={festivalBusy}
            className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3 disabled:opacity-40 hover:opacity-90 transition-opacity font-medium"
            style={{
              background: live.festivalActive ? C.redDim : C.greenDim,
              color: live.festivalActive ? C.red : C.green,
              border: `1px solid ${live.festivalActive ? "rgba(222,76,74,0.4)" : "rgba(14,159,110,0.4)"}`,
            }}
          >
            {live.festivalActive ? <Square size={13} /> : <Rocket size={13} />}
            {festivalBusy ? "…" : live.festivalActive ? "Stop festival drop" : "Start festival drop (10s)"}
          </button>

          <div className="text-[10px] mb-1.5" style={{ color: C.textLo }}>
            Force a SKU through the gated pipeline:
          </div>
          <div className="flex flex-wrap gap-1">
            {skus.map((sku) => (
              <button
                key={sku}
                disabled={probeBusy}
                onClick={() => probe(sku)}
                className="mono text-[10px] px-2 py-1 rounded-md disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ background: C.raised, color: C.textHi, border: `1px solid ${C.hair}` }}
                title={`manual probe — ${sku}`}
              >
                {sku.replace("SKU-", "")}
              </button>
            ))}
          </div>

          <div className="text-[10px] mt-3 leading-relaxed pt-3" style={{ color: C.textLo, borderTop: `1px solid ${C.hair}` }}>
            Tip: run the festival drop twice to exhaust the ₹1 lakh daily pool and watch the portfolio-cap escalation fire live.
          </div>
        </div>
      )}
    </div>
  );
}

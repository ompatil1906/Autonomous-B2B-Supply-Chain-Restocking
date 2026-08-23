import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2, Link2, Lock, MessageCircle, PlayCircle,
  Radio, ShieldAlert,
} from "lucide-react";
import { api, connectWs } from "./lib/api";
import type {
  ApprovalRecord, AuditRecord, Inventory, RunResult, SystemStatus, WsEvent,
} from "./lib/types";
import { C, inr } from "./lib/theme";
import { Breaker } from "./components/Breaker";
import { MandateSeal } from "./components/MandateSeal";
import { Console } from "./components/Console";
import { Overview } from "./components/Overview";
import { Approvals } from "./components/Approvals";
import { LedgerTable } from "./components/LedgerTable";
import { ConfigureTab } from "./components/ConfigureTab";

type Tab = "overview" | "mission" | "approvals" | "ledger" | "configure";

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
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

  useEffect(() => {
    refresh().catch(console.error);
    api
      .latest()
      .then((r) => r.latest && setResult(r.latest))
      .catch(() => {});
    const close = connectWs((e: WsEvent) => {
      if (e.type === "node") setLiveNode(e.node);
      if (e.type === "approval_updated" || e.type === "run_completed") refresh().catch(console.error);
    });
    const check = setInterval(() => {
      fetch("/api/health")
        .then(() => setWsState("open"))
        .catch(() => setWsState("closed"));
    }, 5000);
    fetch("/api/health")
      .then(() => setWsState("open"))
      .catch(() => setWsState("closed"));
    return () => {
      close();
      clearInterval(check);
    };
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

  const lowStock = inventory?.catalog.find((s) => s.stock < s.reorder_threshold);
  const saves = audit.filter((r) => r.kind === "agent.executed").length;

  const pillTone =
    wsState === "open" ? C.green : wsState === "connecting" ? C.amber : C.red;

  const tabs: [Tab, string][] = [
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
        {tab === "overview" && (
          <Overview
            status={status}
            inventory={inventory}
            audit={audit}
            pendingCount={pendingCount}
            saves={saves}
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
                {lowStock
                  ? `Low-stock trigger: ${lowStock.sku} "${lowStock.name}" — ${lowStock.stock} units on hand (threshold ${lowStock.reorder_threshold})`
                  : "Warehouse nominal — no restock triggers"}
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
              <Breaker state={breakerState} cart={cartTotal} ceiling={ceiling} />

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
                    ["Ceiling", inr(ceiling)],
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
                            ["Reason", "Ceiling exceeded"],
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
                  Reserve remaining{" "}
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

        {tab === "approvals" && <Approvals reloadKey={audit.length + approvalsList.length} />}

        {tab === "ledger" && <LedgerTable records={audit.slice().reverse()} />}

        {tab === "configure" && (
          <ConfigureTab
            status={status}
            blockRef={blockRef}
            remaining={reserveRemaining}
            ceiling={ceiling}
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

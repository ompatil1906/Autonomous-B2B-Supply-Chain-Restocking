import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ShieldCheck, ShieldAlert, CheckCircle2,
  Link2, MessageCircle, Lock, IndianRupee, Radio,
  PlayCircle, Settings2, Wallet, Clock3, Hash, ChevronRight, Ban,
} from "lucide-react";
import { api, connectWs } from "./lib/api";
import type {
  AuditRecord, Inventory, RunResult, SystemStatus, WsEvent,
} from "./lib/types";
import { C, inr } from "./lib/theme";
import { Breaker } from "./components/Breaker";
import { MandateSeal } from "./components/MandateSeal";
import { Console } from "./components/Console";

type Tab = "mission" | "ledger" | "configure";

const REVEAL_MS = 700;

export default function App() {
  const [tab, setTab] = useState<Tab>("mission");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [reserveRemaining, setReserveRemaining] = useState<number | null>(null);
  const [blockRef, setBlockRef] = useState<string>("—");
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [digests, setDigests] = useState<Record<number, string>>({});

  const [result, setResult] = useState<RunResult | null>(null);
  const [revealed, setRevealed] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [liveNode, setLiveNode] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">("connecting");
  const timers = useRef<number[]>([]);

  const ceiling = status?.ap2_limit_inr ?? 10_000;

  const refresh = useCallback(async () => {
    const [s, inv, aud, res] = await Promise.all([
      api.status(),
      api.inventory(),
      api.audit(),
      fetch("/api/reserve").then((r) => r.json()),
    ]);
    setStatus(s);
    setInventory(inv);
    setAudit(aud.records.slice().reverse());
    const blocks = res.blocks ?? [];
    if (blocks.length) {
      setReserveRemaining(blocks[blocks.length - 1].remaining_inr);
      setBlockRef(blocks[blocks.length - 1].block_id.toUpperCase());
    }
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
    const close = connectWs((e: WsEvent) => {
      if (e.type === "node") setLiveNode(e.node);
    });
    const check = setInterval(() => {
      fetch("/api/health")
        .then((r) => r.json())
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

  // Reveal the agent console step by step once a run lands.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!result) return;
    setRevealed(-1);
    const total = result.steps.length;
    for (let i = 0; i < total; i++) {
      const t = window.setTimeout(() => setRevealed(i), REVEAL_MS * (i + 1));
      timers.current.push(t);
    }
    return () => timers.current.forEach(clearTimeout);
  }, [result]);

  // Real SHA-256 content digest per ledger row (tamper-evidence visual).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<number, string> = {};
      for (const r of audit.slice(0, 60)) {
        try {
          const buf = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(JSON.stringify(r))
          );
          out[r.seq] = Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 16);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setDigests(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [audit]);

  const run = (scenario: string, overrideQuantity?: number) => {
    setBusy(true);
    setActiveScenario(scenario);
    setLiveNode(null);
    api
      .run({ scenario, override_quantity: overrideQuantity, reset_inventory: true })
      .then((r) => {
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
  const payIdx =
    steps.findIndex((s) => s.kind === "execute" || s.kind === "escalate");

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
    result && cartTotal
      ? result.cart.credentialSubject.items[0].unit_price_inr
      : null;
  const cartQty =
    result && cartTotal ? result.cart.credentialSubject.items[0].quantity : null;

  const paySealed = result && payIdx !== -1 && revealed >= payIdx;
  const executed = result?.status === "executed";
  const failed = result?.status === "blocked";
  const complete = !!result && revealed >= steps.length - 1;

  const lowStock = inventory?.catalog.find((s) => s.stock < s.reorder_threshold);

  const pillTone =
    wsState === "open"
      ? { fg: C.green }
      : wsState === "connecting"
        ? { fg: C.amber }
        : { fg: C.red };

  return (
    <div className="w-full min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: C.brassDim, border: "1px solid rgba(201,161,92,0.35)" }}
          >
            <Lock size={16} color={C.brass} />
          </div>
          <div>
            <div className="text-sm font-medium tracking-wide" style={{ color: C.textHi }}>
              WARDEN
            </div>
            <div className="text-xs" style={{ color: C.textLo }}>
              Autonomous procurement · AP2 × UPI Reserve Pay × Razorpay MCP
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span
            className="flex items-center gap-1.5 text-xs"
            style={{ color: pillTone.fg }}
          >
            <Radio size={12} className={wsState === "open" ? "animate-pulse" : ""} />
            {wsState === "open" ? "LIVE · test mode" : wsState === "connecting" ? "CONNECTING" : "BACKEND OFFLINE"}
          </span>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: C.surface }}>
            {([
              ["mission", "Mission control"],
              ["ledger", "Audit ledger"],
              ["configure", "Configure agent"],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  background: tab === key ? C.surfaceRaised : "transparent",
                  color: tab === key ? C.textHi : C.textLo,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "mission" && (
        <>
          {/* Alert / scenario runner */}
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
              <ScenarioBtn
                label="Run: normal restock"
                tone={C.green}
                dim={C.greenDim}
                onClick={() => run("happy")}
                disabled={running}
                active={activeScenario === "happy"}
              />
              <ScenarioBtn
                label="Run: price spike (breach)"
                tone={C.red}
                dim={C.redDim}
                onClick={() => run("failure")}
                disabled={running}
                active={activeScenario === "failure"}
              />
              <ScenarioBtn
                label="Run: hallucinated qty"
                tone={C.brass}
                dim={C.brassDim}
                onClick={() => run("happy", 10000)}
                disabled={running}
                active={running && busy}
              />
            </div>
          </div>

          {liveNode && running && (
            <div className="mb-4 text-xs mono" style={{ color: C.textLo }}>
              executing node{" "}
              <span style={{ color: C.brass }}>{liveNode}</span>
              …
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4">
            <Breaker state={breakerState} cart={cartTotal} ceiling={ceiling} />

            {/* Console */}
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
                <div
                  className="mt-5 rounded-xl p-3"
                  style={{ background: C.surfaceRaised, border: `1px solid ${C.hair}` }}
                >
                  <div className="flex items-center gap-2 text-xs mb-2" style={{ color: C.textLo }}>
                    <MessageCircle size={13} /> WhatsApp — sent to merchant
                  </div>
                  <div
                    className="rounded-lg rounded-tl-none p-3 text-sm max-w-md"
                    style={{ background: C.greenDim, color: C.textHi }}
                  >
                    {result?.whatsapp_message?.message ??
                      "Supplier increased prices — please approve manually."}
                  </div>
                  {result?.payment_link?.short_url && (
                    <a
                      href={result.payment_link.short_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs px-3 py-1.5 rounded-lg items-center gap-1.5 transition-opacity hover:opacity-80"
                      style={{ background: C.brassDim, color: C.brass, border: "1px solid rgba(201,161,92,0.35)" }}
                    >
                      <Link2 size={12} /> Open secure approval link
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Mandate chain */}
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

          {/* Settlement strip */}
          {executed && complete && (
            <div
              className="mt-6 rounded-xl p-4 flex items-center gap-6 flex-wrap text-xs"
              style={{ background: C.greenDim, border: "1px solid rgba(62,207,142,0.35)" }}
            >
              <span className="flex items-center gap-2 font-medium" style={{ color: C.green }}>
                <CheckCircle2 size={14} /> Settled autonomously
              </span>
              <span style={{ color: C.textHi }} className="mono">{inr(cartTotal)} captured</span>
              <span style={{ color: C.textLo }}>
                Reserve remaining <span className="mono" style={{ color: C.textHi }}>{inr(reserveRemaining)}</span>
              </span>
              <span style={{ color: C.textLo }}>
                Stock now <span className="mono" style={{ color: C.textHi }}>{result?.stock_after[result!.sku]} units</span>
              </span>
            </div>
          )}
        </>
      )}

      {tab === "ledger" && <LedgerTab records={audit} digests={digests} />}

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
  );
}

function ScenarioBtn({
  label,
  tone,
  dim,
  onClick,
  disabled,
  active,
}: {
  label: string;
  tone: string;
  dim: string;
  onClick: () => void;
  disabled: boolean;
  active: boolean;
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
        outline: active ? `1px solid ${tone}` : "none",
      }}
    >
      <PlayCircle size={14} /> {label}
    </button>
  );
}

function LedgerTab({
  records,
  digests,
}: {
  records: AuditRecord[];
  digests: Record<number, string>;
}) {
  const shown = records.slice(0, 60);
  return (
    <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-sm font-medium" style={{ color: C.textHi }}>
            Append-only audit ledger
          </div>
          <div className="text-xs mt-1 max-w-2xl" style={{ color: C.textLo }}>
            Every mandate signature, boundary decision and Razorpay MCP call is appended with its
            SHA-256 content digest — nothing can be edited without being detectable.
          </div>
        </div>
        <span
          className="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1"
          style={{ background: C.brassDim, color: C.brass, border: "1px solid rgba(201,161,92,0.35)" }}
        >
          <ShieldCheck size={12} /> Tamper-evident
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="text-sm py-14 text-center" style={{ color: C.textLo }}>
          No entries yet — run a scenario from Mission control to populate the ledger.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((r, i) => (
            <div
              key={r.seq}
              className="rounded-lg p-3 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: C.surfaceRaised, border: `1px solid ${C.hair}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ border: `1px solid ${C.hairStrong}`, color: C.textLo }}
                >
                  {records.length - i}
                </div>
                <div className="text-xs max-w-lg" style={{ color: C.textHi }}>
                  <span className="mono mr-2" style={{ color: C.amber }}>{r.kind}</span>
                  {payloadSummary(r)}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs mono" style={{ color: C.textLo }}>
                <span className="flex items-center gap-1">
                  <Clock3 size={11} /> {r.ts.slice(11, 19)}
                </span>
                <span className="flex items-center gap-1">
                  <Hash size={11} /> {digests[r.seq] ?? "…"}
                </span>
                {i > 0 && <ChevronRight size={12} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function payloadSummary(r: AuditRecord): string {
  const parts: string[] = [];
  if (r.amount_inr !== undefined) parts.push(`₹${r.amount_inr}`);
  if (r.sku) parts.push(r.sku);
  if (r.quantity !== undefined) parts.push(`qty ${r.quantity}`);
  if (r.tool) parts.push(`${r.tool}()`);
  if (r.passed !== undefined) parts.push(r.passed ? "PASSED" : "BLOCKED");
  if (r.payment_id) parts.push(String(r.payment_id).slice(0, 14));
  if (r.block_id) parts.push(r.block_id);
  if (r.channel) parts.push(`${r.channel} → ${r.to ?? ""}`);
  if (!parts.length) {
    const skip = new Set(["ts", "kind", "seq"]);
    parts.push(
      Object.entries(r)
        .filter(([k]) => !skip.has(k))
        .slice(0, 2)
        .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 30)}`)
        .join(" ")
    );
  }
  return parts.join(" · ").slice(0, 110);
}

function ConfigureTab({
  status,
  blockRef,
  remaining,
  ceiling,
  lowStockThreshold,
}: {
  status: SystemStatus | null;
  blockRef: string;
  remaining: number | null;
  ceiling: number;
  lowStockThreshold?: number;
}) {
  const rows: [string, string][] = [
    ["SKU", `${status?.ap2_sku ?? "—"} — Minimal Cotton Tee (Black)`],
    ["Max quantity per order", `${status?.ap2_max_qty ?? "—"} units`],
    ["Max price per unit", inr(status?.ap2_max_unit_price)],
    ["Total spending ceiling", inr(ceiling)],
    ["Reorder threshold", `${lowStockThreshold ?? "—"} units`],
    ["Mandate expiry", `${status?.intent_expiry_hours ?? "—"} hours from signing`],
    ["user_cart_confirmation_required", "false (autonomous execution allowed)"],
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Settings2 size={15} color={C.brass} />
          <span className="text-sm font-medium" style={{ color: C.textHi }}>
            IntentMandate — rules of engagement
          </span>
        </div>
        {rows.map(([label, val]) => (
          <div key={label} className="mb-3">
            <div className="text-xs mb-1" style={{ color: C.textLo }}>
              {label}
            </div>
            <input
              readOnly
              value={val}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none mono"
              style={{ background: C.surfaceRaised, color: C.textHi, border: `1px solid ${C.hair}` }}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs mt-2" style={{ color: C.brass }}>
          <ShieldCheck size={13} /> Signed by merchant wallet (Ed25519) — cryptographic mandate active
        </div>
      </div>

      <div className="rounded-2xl p-5 flex flex-col" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={15} color={C.brass} />
          <span className="text-sm font-medium" style={{ color: C.textHi }}>
            UPI Reserve Pay — funds block
          </span>
        </div>
        <div
          className="rounded-xl p-6 flex flex-col items-center justify-center flex-1"
          style={{ background: C.surfaceRaised, border: `1px dashed ${C.hairStrong}` }}
        >
          <IndianRupee size={22} color={C.brass} />
          <div className="text-2xl font-medium mt-2 mono" style={{ color: C.textHi }}>
            {(remaining ?? ceiling).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-1" style={{ color: C.textLo }}>
            blocked in merchant's bank account, dedicated to this agent
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Row label="Block reference" value={blockRef} mono />
          <Row
            label="Status"
            node={
              <span
                className="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1"
                style={{ background: C.greenDim, color: C.green, border: "1px solid rgba(62,207,142,0.35)" }}
              >
                <CheckCircle2 size={11} /> Active
              </span>
            }
          />
          <Row label="Spent this session" value={inr((status?.ap2_limit_inr ?? ceiling) - (remaining ?? ceiling))} mono />
          <Row
            label="Can the agent exceed this?"
            node={
              <span className="flex items-center gap-1" style={{ color: C.red }}>
                <Ban size={12} /> Never
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, node, mono }: { label: string; value?: string; node?: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs items-center">
      <span style={{ color: C.textLo }}>{label}</span>
      {node ?? (
        <span style={{ color: C.textHi }} className={mono ? "mono" : undefined}>
          {value}
        </span>
      )}
    </div>
  );
}
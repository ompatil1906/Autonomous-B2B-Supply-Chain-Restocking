import { useCallback, useEffect, useState } from "react";
import { api, connectWs } from "./lib/api";
import type { AuditRecord, Inventory, RunResult, SystemStatus, WsEvent } from "./lib/types";
import { GatePanel } from "./components/GatePanel";
import { JsonViewer } from "./components/JsonViewer";
import { MandateCard } from "./components/MandateCard";
import { StepTimeline } from "./components/StepTimeline";

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d1322] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold mono ${accent ?? "text-slate-100"}`}>{value}</div>
    </div>
  );
}

function ScenarioButton({
  label,
  sub,
  color,
  onClick,
  disabled,
  active,
}: {
  label: string;
  sub: string;
  color: string;
  onClick: () => void;
  disabled: boolean;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold text-left transition-all ${
        active ? `${color} border-current` : `border-slate-700 text-slate-300 hover:border-slate-500 ${color}`
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {label}
      <span className="block text-[10px] font-normal opacity-70">{sub}</span>
    </button>
  );
}

export default function App() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [liveNode, setLiveNode] = useState<string | null>(null);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">("connecting");

  const refresh = useCallback(async () => {
    const [s, inv, latest, aud] = await Promise.all([
      api.status(),
      api.inventory(),
      api.latest(),
      api.audit(),
    ]);
    setStatus(s);
    setInventory(inv);
    if (latest.latest) setResult(latest.latest);
    setAudit(aud.records.slice().reverse());
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
    const close = connectWs((e: WsEvent) => {
      if (e.type === "run_started") {
        setRunning(true);
        setLiveNode(null);
        setActiveScenario(e.scenario);
      } else if (e.type === "node") {
        setLiveNode(e.node);
      } else if (e.type === "run_completed") {
        setRunning(false);
        setActiveScenario(null);
        setLiveNode(null);
        setResult(e.result);
        refresh().catch(console.error);
      } else if (e.type === "run_failed") {
        setRunning(false);
        setActiveScenario(null);
        setLiveNode(null);
        console.error(e.error);
      }
    });
    const check = setInterval(() => {
      fetch("/api/health")
        .then((r) => r.json())
        .then(() => setWsState("open"))
        .catch(() => setWsState("closed"));
    }, 5000);
    return () => {
      close();
      clearInterval(check);
    };
  }, [refresh]);

  const run = (scenario: string, overrideQuantity?: number) => {
    setRunning(true);
    setResult(null);
    setActiveScenario(scenario);
    api
      .run({ scenario, override_quantity: overrideQuantity, reset_inventory: true })
      .then((r) => {
        setResult(r);
        setRunning(false);
        setActiveScenario(null);
        refresh().catch(console.error);
      })
      .catch(console.error);
  };

  const cap = result?.cart?.credentialSubject?.total_inr ?? 0;
  const executed = result?.status === "executed";
  const wsDot = wsState === "open" ? "bg-emerald-400" : wsState === "connecting" ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-[#0b0f1a] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center gap-4">
          <div className="mr-auto">
            <h1 className="text-lg font-bold text-slate-100">
              AP2-Bounded Restocking Agent
            </h1>
            <p className="text-[11px] text-slate-500">
              UPI Reserve Pay × Google AP2 × Razorpay MCP — autonomous procurement with a
              cryptographic boundary
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1">
              <span className={`w-1.5 h-1.5 rounded-full ${wsDot}`} />
              {wsState}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-1">Razorpay: {status?.razorpay_mode ?? "…"}</span>
            <span className="rounded-full bg-slate-800 px-2.5 py-1">LLM: {status?.agent_llm_provider ?? "…"}</span>
          </div>
          <div className="flex gap-2">
            <ScenarioButton
              label="Run: Restock ✓"
              sub="cart ₹9,800 → capture"
              color="text-emerald-300"
              onClick={() => run("happy")}
              disabled={running}
              active={activeScenario === "happy"}
            />
            <ScenarioButton
              label="Run: Price Hike ✗"
              sub="cart ₹11,000 → blocked"
              color="text-amber-300"
              onClick={() => run("failure")}
              disabled={running}
              active={activeScenario === "failure"}
            />
            <ScenarioButton
              label="Run: Hallucination"
              sub="LLM says 10,000 units"
              color="text-red-300"
              onClick={() => run("happy", 10000)}
              disabled={running}
              active={running && activeScenario === "happy" && result === null}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {running && !result && (
          <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/5 px-4 py-3 text-sm text-indigo-200">
            Agent running{liveNode ? ` — executing node “${liveNode}”` : ""}…
          </div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Reserve blocked" value={`₹${(status?.ap2_limit_inr ?? 0).toLocaleString("en-IN")}`} accent="text-cyan-300" />
          <Kpi
            label="Reserve remaining"
            value={`₹${(result?.reserve_block.remaining_inr ?? status?.ap2_limit_inr ?? 0).toLocaleString("en-IN")}`}
            accent="text-emerald-300"
          />
          <Kpi
            label="Gate verdict"
            value={result ? (result.gate.passed ? "PASSED" : "BLOCKED") : "—"}
            accent={result ? (result.gate.passed ? "text-emerald-300" : "text-red-300") : ""}
          />
          <Kpi
            label="Cart total"
            value={result ? `₹${cap.toLocaleString("en-IN")}` : "—"}
            accent={result ? (result.gate.passed ? "text-slate-100" : "text-red-300") : ""}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Agent execution timeline
              </h2>
              {result?.steps?.length ? (
                <StepTimeline steps={result.steps} />
              ) : (
                <p className="text-sm text-slate-500">
                  Run a scenario to see the agent's auditable steps.
                </p>
              )}
            </div>

            {result && <GatePanel gate={result.gate} />}

            {result && executed && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
                <h3 className="text-sm font-semibold text-emerald-300 mb-2">
                  Autonomous execution — capture_payment (UPI Reserve Pay debit)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-[#0b0f1a] border border-slate-800 p-2">
                    <div className="text-slate-500">payment_id</div>
                    <div className="mono text-emerald-200">{result.capture_result?.id}</div>
                  </div>
                  <div className="rounded-lg bg-[#0b0f1a] border border-slate-800 p-2">
                    <div className="text-slate-500">status</div>
                    <div className="mono text-emerald-200">{result.capture_result?.status}</div>
                  </div>
                  <div className="rounded-lg bg-[#0b0f1a] border border-slate-800 p-2">
                    <div className="text-slate-500">amount</div>
                    <div className="mono text-emerald-200">
                      ₹{((result.capture_result?.amount ?? 0) / 100).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0b0f1a] border border-slate-800 p-2">
                    <div className="text-slate-500">stock after</div>
                    <div className="mono text-emerald-200">{result.stock_after[result.sku]} units</div>
                  </div>
                </div>
                <div className="mt-3">
                  <JsonViewer value={result.capture_result} label="capture_payment result" />
                </div>
              </div>
            )}

            {result && !executed && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4">
                <h3 className="text-sm font-semibold text-red-300 mb-2">
                  Graceful failure — autonomous capture aborted, human escalated
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#0b0f1a] border border-slate-800 p-3">
                    <div className="text-[10px] uppercase text-slate-500 mb-1">Razorpay Payment Link</div>
                    <a
                      href={result.payment_link?.short_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mono text-sm text-amber-300 underline underline-offset-2 break-all"
                    >
                      {result.payment_link?.short_url}
                    </a>
                    <div className="text-xs text-slate-400 mt-1">
                      ₹{((result.payment_link?.amount ?? 0) / 100).toLocaleString("en-IN")} · {result.payment_link?.status}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0b0f1a] border border-slate-800 p-3">
                    <div className="text-[10px] uppercase text-slate-500 mb-1">
                      WhatsApp → {result.whatsapp_message?.to}
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      “{result.whatsapp_message?.message}”
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mandate chain (non-repudiable evidence)
            </h2>
            <MandateCard label="What the human authorized" mandate={result?.intent} />
            <MandateCard label="What the supplier promised" mandate={result?.cart} />
            <MandateCard label="Why the agent paid / aborted" mandate={result?.payment_mandate} />
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-slate-800 bg-[#0d1322] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Warehouse inventory
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Stock</th>
                  <th className="pb-2 text-right">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {(inventory?.catalog ?? []).map((s) => {
                  const below = s.stock < s.reorder_threshold;
                  return (
                    <tr key={s.sku} className="border-t border-slate-800/60">
                      <td className="py-1.5 mono text-slate-300">{s.sku}</td>
                      <td className="py-1.5 text-slate-400">{s.name}</td>
                      <td className={`py-1.5 text-right mono ${below ? "text-red-300 font-semibold" : "text-slate-200"}`}>
                        {s.stock}
                      </td>
                      <td className="py-1.5 text-right mono text-slate-500">{s.reorder_threshold}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-slate-800 bg-[#0d1322] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Audit trail (append-only)
            </h2>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-[11px]">
                <tbody>
                  {audit.slice(0, 40).map((a) => (
                    <tr key={a.seq} className="border-t border-slate-800/60">
                      <td className="py-1 pr-2 mono text-slate-600 whitespace-nowrap">{a.ts}</td>
                      <td className="py-1 pr-2 mono text-indigo-300 whitespace-nowrap">{a.kind}</td>
                      <td className="py-1 text-slate-400 truncate max-w-[260px]">
                        {Object.entries(a)
                          .filter(([k]) => !["ts", "kind", "seq"].includes(k))
                          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                          .join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
import { useCallback, useEffect, useState } from "react";
import { api, connectWs } from "./lib/api";
import type { AuditRecord, Inventory, RunResult, SystemStatus, WsEvent } from "./lib/types";
import { GatePanel } from "./components/GatePanel";
import { JsonViewer } from "./components/JsonViewer";
import { MandateCard } from "./components/MandateCard";
import { StepTimeline } from "./components/StepTimeline";

function Kpi({
  label,
  value,
  accent = "text-slate-900",
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold mono ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ScenarioButton({
  label,
  sub,
  className,
  onClick,
  disabled,
  active,
}: {
  label: string;
  sub: string;
  className: string;
  onClick: () => void;
  disabled: boolean;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold text-left transition-all shadow-sm ${
        active ? className : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
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
  const wsDot =
    wsState === "open"
      ? "bg-emerald-500"
      : wsState === "connecting"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="mr-auto">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                AP2-Bounded Restocking Agent
              </h1>
              <p className="text-xs text-slate-500">
                UPI Reserve Pay × Google AP2 × Razorpay MCP — autonomous procurement with a
                cryptographic boundary
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                <span className={`h-1.5 w-1.5 rounded-full ${wsDot}`} />
                {wsState}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                Razorpay: {status?.razorpay_mode ?? "…"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                LLM: {status?.agent_llm_provider ?? "…"}
              </span>
            </div>
            <div className="flex gap-2">
              <ScenarioButton
                label="Restock ✓"
                sub="cart ₹9,800 → capture"
                className="border-emerald-500 bg-emerald-500 text-white"
                onClick={() => run("happy")}
                disabled={running}
                active={activeScenario === "happy"}
              />
              <ScenarioButton
                label="Price Hike ✗"
                sub="cart ₹11,000 → blocked"
                className="border-amber-500 bg-amber-500 text-white"
                onClick={() => run("failure")}
                disabled={running}
                active={activeScenario === "failure"}
              />
              <ScenarioButton
                label="Hallucination"
                sub="LLM says 10,000 units"
                className="border-red-500 bg-red-500 text-white"
                onClick={() => run("happy", 10000)}
                disabled={running}
                active={running && activeScenario === "happy" && result === null}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {wsState === "closed" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Backend not reachable.</span> Start it with{" "}
            <code className="mono rounded bg-amber-100 px-1.5 py-0.5 text-xs">
              uv run uvicorn app.main:app --port 8000
            </code>{" "}
            from the repo root, then reload this page.
          </div>
        )}

        {running && !result && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
            Agent running{liveNode ? ` — executing node “${liveNode}”` : ""}…
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Reserve blocked"
            value={`₹${(status?.ap2_limit_inr ?? 0).toLocaleString("en-IN")}`}
            accent="text-cyan-600"
          />
          <Kpi
            label="Reserve remaining"
            value={`₹${(result?.reserve_block.remaining_inr ?? status?.ap2_limit_inr ?? 0).toLocaleString("en-IN")}`}
            accent="text-emerald-600"
            sub={result ? `${(result.reserve_block.debits.length)} debit(s) this run` : undefined}
          />
          <Kpi
            label="Gate verdict"
            value={result ? (result.gate.passed ? "PASSED" : "BLOCKED") : "—"}
            accent={result ? (result.gate.passed ? "text-emerald-600" : "text-red-600") : ""}
          />
          <Kpi
            label="Cart total"
            value={result ? `₹${cap.toLocaleString("en-IN")}` : "—"}
            accent={result ? (result.gate.passed ? "text-slate-900" : "text-red-600") : ""}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Agent execution timeline
              </h2>
              {result?.steps?.length ? (
                <StepTimeline steps={result.steps} />
              ) : (
                <p className="text-sm text-slate-400">
                  Run a scenario to see the agent's auditable steps.
                </p>
              )}
            </div>

            {result && <GatePanel gate={result.gate} />}

            {result && executed && (
              <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-emerald-700">
                  Autonomous execution — capture_payment (UPI Reserve Pay debit)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[10px] font-medium uppercase text-slate-400">payment_id</div>
                    <div className="mt-0.5 mono text-emerald-700">{result.capture_result?.id}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[10px] font-medium uppercase text-slate-400">status</div>
                    <div className="mt-0.5 mono text-emerald-700">{result.capture_result?.status}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[10px] font-medium uppercase text-slate-400">amount</div>
                    <div className="mt-0.5 mono text-emerald-700">
                      ₹{((result.capture_result?.amount ?? 0) / 100).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[10px] font-medium uppercase text-slate-400">stock after</div>
                    <div className="mt-0.5 mono text-emerald-700">{result.stock_after[result.sku]} units</div>
                  </div>
                </div>
                <div className="mt-3">
                  <JsonViewer value={result.capture_result} label="capture_payment result" />
                </div>
              </div>
            )}

            {result && !executed && (
              <div className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-red-700">
                  Graceful failure — autonomous capture aborted, human escalated
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Razorpay Payment Link
                    </div>
                    <a
                      href={result.payment_link?.short_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mono break-all text-sm text-amber-600 underline underline-offset-2"
                    >
                      {result.payment_link?.short_url}
                    </a>
                    <div className="mt-1 text-xs text-slate-500">
                      ₹{((result.payment_link?.amount ?? 0) / 100).toLocaleString("en-IN")} ·{" "}
                      {result.payment_link?.status}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      WhatsApp → {result.whatsapp_message?.to}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Warehouse inventory
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
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
                    <tr key={s.sku} className="border-t border-slate-100">
                      <td className="py-1.5 mono text-slate-600">{s.sku}</td>
                      <td className="py-1.5 text-slate-500">{s.name}</td>
                      <td
                        className={`py-1.5 text-right mono ${
                          below ? "font-semibold text-red-600" : "text-slate-700"
                        }`}
                      >
                        {s.stock}
                      </td>
                      <td className="py-1.5 text-right mono text-slate-400">{s.reorder_threshold}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Audit trail (append-only)
            </h2>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-[11px]">
                <tbody>
                  {audit.slice(0, 40).map((a) => (
                    <tr key={a.seq} className="border-t border-slate-100">
                      <td className="whitespace-nowrap py-1 pr-2 mono text-slate-400">{a.ts}</td>
                      <td className="whitespace-nowrap py-1 pr-2 mono text-indigo-600">{a.kind}</td>
                      <td className="max-w-[260px] truncate py-1 text-slate-500">
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
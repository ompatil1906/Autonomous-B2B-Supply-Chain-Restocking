import { useState } from "react";
import { FlaskConical, PlayCircle, Rocket, Square, X } from "lucide-react";
import type { LiveModel } from "../hooks/useLive";
import { api } from "../lib/api";
import { C } from "../lib/theme";

/**
 * Demo drawer — lets the operator drive the six canonical scenarios without
 * leaving the screen. Runs the same API writes an integrator would.
 */
const SCENARIOS: { id: string; label: string; desc: string; run: string }[] = [
  { id: "happy", label: "Normal restock", desc: "Nominal demand, one supplier, BUY", run: "happy" },
  { id: "failure", label: "Price spike (breach)", desc: "Supplier inflates — gate FAILED, no money moved", run: "failure" },
  { id: "halluc", label: "Hallucinated quantity", desc: "Agent proposes 10,000 units — order cap breach", run: "halluc" },
  { id: "festival10", label: "Festival drop — 10s", desc: "Demand surge, 10s to crash", run: "festival10" },
  { id: "festival30", label: "Festival drop — 30s", desc: "Demand surge, 30s to crash", run: "festival30" },
  { id: "probe", label: "Manual probe", desc: "Force a restock trigger on a SKU", run: "probe" },
];

export function DemoDrawer({
  live,
  onRun,
}: {
  live: LiveModel;
  onRun: (scenario: string, overrideQuantity?: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const skus = live.products.length ? live.products.map((p) => p.sku) : ["SKU-404", "SKU-101", "SKU-203"];

  const pick = async (id: string) => {
    setBusy(id);
    try {
      if (id === "festival10") await api.festivalStart(10);
      else if (id === "festival30") await api.festivalStart(30);
      else if (id === "probe") {
        await api.probe(skus[0]);
        await live.refresh();
      } else onRun(id === "halluc" ? "happy" : id, id === "halluc" ? 10000 : undefined);
    } catch {
      /* swallowed — live.refresh() reconciles the UI afterwards */
    } finally {
      setBusy(null);
    }
  };

  const toggleFestival = async () => {
    setBusy("stop");
    try {
      if (live.festivalActive) await api.festivalStop();
      else await api.festivalStart(10);
      await live.refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-float transition hover:-translate-y-0.5"
        style={{ background: C.surface, border: `1px solid ${C.hair}`, color: C.textHi }}
      >
        <FlaskConical size={15} color={C.brass} />
        <span className="text-xs font-semibold">Demo scenarios</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[300px] rounded-2xl p-4"
      style={{ background: C.surface, border: `1px solid ${C.hair}`, boxShadow: C.shadowFloat }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold tracking-widest" style={{ color: C.textMuted }}>
          DEMO SCENARIOS
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-slate-100" aria-label="Close">
          <X size={14} style={{ color: C.textLo }} />
        </button>
      </div>

      <div className="space-y-1.5">
        {live.festivalActive && (
          <button
            onClick={toggleFestival}
            disabled={busy !== null}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: C.redDim, color: C.red, border: `1px solid rgba(220,38,38,0.35)` }}
          >
            <Square size={13} fill="currentColor" />
            {busy === "stop" ? "Stopping…" : "Stop festival drop"}
          </button>
        )}
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            disabled={busy !== null}
            onClick={() => pick(s.id)}
            className="w-full text-left px-3 py-2.5 rounded-lg transition-colors disabled:opacity-50 hover:bg-slate-50"
            style={{ background: C.raised }}
          >
            <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: C.textHi }}>
              {busy === s.id ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
              ) : s.run === "festival10" ? (
                <Rocket size={13} color={C.brass} />
              ) : (
                <PlayCircle size={13} color={C.accentBlue} />
              )}
              {s.label}
            </span>
            <span className="block text-[10.5px] mt-0.5 ml-[21px]" style={{ color: C.textLo }}>
              {s.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
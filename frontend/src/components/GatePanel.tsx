import type { GateVerdict } from "../lib/types";

export function GatePanel({ gate }: { gate: GateVerdict }) {
  const passed = gate.passed;
  return (
    <div
      className={`rounded-xl border p-4 ${
        passed
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-red-500/50 bg-red-500/5"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            passed ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
          }`}
        >
          {passed ? "GATE PASSED" : "GATE BLOCKED"}
        </span>
        <span className="text-sm text-slate-300">{gate.summary}</span>
      </div>
      <ul className="mt-3 space-y-1">
        {gate.checks.map((c) => (
          <li
            key={c.name}
            className={`flex items-start gap-2 text-xs rounded px-2 py-1 ${
              c.passed ? "text-emerald-300/90" : "text-red-300"
            }`}
          >
            <span className="mt-px">{c.passed ? "✓" : "✗"}</span>
            <span>
              <span className="mono text-slate-400">{c.name}</span>
              <span className="text-slate-300"> — {c.message}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
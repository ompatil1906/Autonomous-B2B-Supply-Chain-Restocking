import type { GateVerdict } from "../lib/types";

export function GatePanel({ gate }: { gate: GateVerdict }) {
  const passed = gate.passed;
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        passed
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="mb-2 flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            passed
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {passed ? "GATE PASSED" : "GATE BLOCKED"}
        </span>
        <span className={`text-sm ${passed ? "text-emerald-800" : "text-red-800"}`}>
          {gate.summary}
        </span>
      </div>
      <ul className="mt-3 space-y-1">
        {gate.checks.map((c) => (
          <li
            key={c.name}
            className={`flex items-start gap-2 rounded px-2 py-1 text-xs ${
              passed ? "text-emerald-700" : "text-red-700"
            }`}
          >
            <span className="mt-px font-bold">{c.passed ? "✓" : "✗"}</span>
            <span>
              <span className="mono font-medium text-slate-500">{c.name}</span>
              <span className="text-slate-600"> — {c.message}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
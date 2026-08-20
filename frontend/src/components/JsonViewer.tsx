import { useState } from "react";

export function JsonViewer({ value, label }: { value: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0d1322] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:bg-slate-800/50 transition-colors"
      >
        <span className="mono">
          {label ? `${label} ` : ""}
          <span className="text-slate-600">{text.length} chars</span>
        </span>
        <span className="text-slate-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <pre className="json-view p-3 border-t border-slate-800 max-h-[420px] overflow-auto">
          {text}
        </pre>
      )}
    </div>
  );
}
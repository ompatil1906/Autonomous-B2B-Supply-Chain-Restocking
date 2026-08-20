import { useState } from "react";

export function JsonViewer({ value, label }: { value: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-100"
      >
        <span className="mono">
          {label ? `${label} ` : ""}
          <span className="text-slate-400">{text.length} chars</span>
        </span>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <pre className="json-view max-h-[420px] overflow-auto border-t border-slate-200 p-3">
          {text}
        </pre>
      )}
    </div>
  );
}
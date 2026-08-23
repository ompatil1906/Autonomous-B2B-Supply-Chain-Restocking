import { useState } from "react";
import { Hash, ChevronDown } from "lucide-react";
import type { Mandate } from "../lib/types";
import { C } from "../lib/theme";

type SealStatus = "signed" | "pending" | "void";

export function MandateSeal({
  n,
  title,
  status,
  fields,
  mandate,
}: {
  n: number;
  title: string;
  status: SealStatus;
  fields: [string, string][];
  mandate?: Mandate | null;
}) {
  const [open, setOpen] = useState(false);
  const color =
    status === "signed" ? C.brass : status === "void" ? C.red : C.textLo;
  const label =
    status === "signed" ? "Sealed" : status === "void" ? "Void" : "Pending";
  const borderColor =
    status === "signed"
      ? "rgba(168,127,61,0.35)"
      : status === "void"
        ? "rgba(222,76,74,0.35)"
        : C.hair;

  // Real cryptographic proof value from the signed VC.
  const sig = mandate?.proof?.proofValue
    ? `${mandate.proof.proofValue.slice(0, 20)}…`
    : null;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: C.surface, border: `1px solid ${borderColor}`, opacity: status === "pending" ? 0.55 : 1 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
            style={{ border: `1px solid ${color}`, color }}
          >
            {n}
          </div>
          <span className="text-sm font-medium" style={{ color: C.textHi }}>
            {title}
          </span>
        </div>
        <span className="text-xs mono" style={{ color }}>
          {label}
        </span>
      </div>

      <div className="space-y-1 mb-2">
        {fields.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs gap-3">
            <span style={{ color: C.textLo }}>{k}</span>
            <span className="mono text-right" style={{ color: C.textHi }}>
              {v}
            </span>
          </div>
        ))}
      </div>

      {mandate && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between text-xs pt-2 transition-colors"
            style={{ borderTop: `1px solid ${C.hair}`, color: C.textLo }}
          >
            <span className="flex items-center gap-1 mono">
              <Hash size={11} /> {sig}
            </span>
            <ChevronDown
              size={12}
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 200ms",
              }}
            />
          </button>
          {open && (
            <pre className="json-view mt-2 max-h-64 overflow-auto rounded-lg p-2" style={{ background: C.raised }}>
              {JSON.stringify(mandate, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
import { useState } from "react";
import { Hash, ChevronDown, CheckCircle2, XCircle, Clock } from "lucide-react";
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
    status === "signed" ? C.green : status === "void" ? C.red : C.textLo;
  const label =
    status === "signed" ? "SEALED" : status === "void" ? "VOID" : "PENDING";
  
  const StatusIcon = status === "signed" ? CheckCircle2 : status === "void" ? XCircle : Clock;

  // Real cryptographic proof value from the signed VC.
  const sig = mandate?.proof?.proofValue
    ? `${mandate.proof.proofValue.slice(0, 24)}…`
    : null;

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200"
      style={{ 
        background: C.surface, 
        border: `1px solid ${status === "signed" ? "rgba(16,185,129,0.3)" : status === "void" ? "rgba(220,38,38,0.3)" : C.hair}`,
        opacity: status === "pending" ? 0.6 : 1,
        boxShadow: status === "signed" ? "0 2px 8px rgba(16,185,129,0.05)" : "none"
      }}
    >
      <div 
        className="flex items-center justify-between px-4 py-3 border-b" 
        style={{ 
          borderColor: status === "signed" ? "rgba(16,185,129,0.15)" : status === "void" ? "rgba(220,38,38,0.15)" : C.hair,
          background: status === "signed" ? C.greenDim : status === "void" ? C.redDim : "transparent"
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: status === "signed" ? C.green : status === "void" ? C.red : C.raised, color: status === "pending" ? C.textLo : C.surface }}
          >
            {n}
          </div>
          <span className="text-xs font-bold tracking-wide uppercase" style={{ color: status === "pending" ? C.textHi : color }}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest mono" style={{ color }}>
          {label} <StatusIcon size={12} />
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {fields.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs items-baseline gap-4">
            <span className="uppercase text-[10px] tracking-wider font-semibold" style={{ color: C.textLo }}>{k}</span>
            <span className="mono font-medium text-right truncate" style={{ color: C.textHi }}>
              {v}
            </span>
          </div>
        ))}
      </div>

      {mandate && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between text-[10px] px-3 py-2 rounded-md transition-colors hover:bg-slate-50"
            style={{ border: `1px dashed ${C.hairStrong}`, color: C.textLo }}
          >
            <span className="flex items-center gap-1.5 mono truncate">
              <Hash size={12} style={{ color: C.textMuted }} /> {sig}
            </span>
            <ChevronDown
              size={12}
              className="shrink-0 ml-2"
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 200ms",
              }}
            />
          </button>
          
          {open && (
            <div className="mt-2 rounded-md overflow-hidden" style={{ border: `1px solid ${C.hair}` }}>
              <div className="bg-slate-100 px-3 py-1.5 text-[9px] font-semibold tracking-wider text-slate-500 uppercase border-b border-slate-200">
                Verifiable Credential Payload
              </div>
              <pre className="text-[10px] p-3 overflow-x-auto mono max-h-60 overflow-y-auto" style={{ background: "#f8fafc", color: "#334155" }}>
                {JSON.stringify(mandate, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
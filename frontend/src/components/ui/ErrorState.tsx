import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { C } from "../../lib/theme";

export function ErrorState({
  title,
  body,
  actions,
}: {
  title: string;
  body?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-start gap-3"
      style={{ background: C.redDim, border: `1px solid rgba(220,38,38,0.3)`, color: C.red }}
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {body && <div className="text-xs mt-1 leading-relaxed" style={{ color: C.textLo }}>{body}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
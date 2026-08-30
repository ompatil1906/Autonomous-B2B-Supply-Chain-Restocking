import type { ReactNode } from "react";
import { C } from "../../lib/theme";

/** Compact KPI — number + label + optional sub-context. The building block for
 * the operations-style KPI rows (never oversized). */
export function KpiChip({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col justify-between min-h-[104px]"
      style={{ background: C.surface, border: `1px solid ${C.hair}` }}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.textLo }}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-[26px] font-semibold tracking-tight leading-none mt-3" style={{ color: tone ?? C.textHi }}>
        {value}
      </div>
      {sub && <div className="text-[11px] mt-2" style={{ color: C.textLo }}>{sub}</div>}
    </div>
  );
}
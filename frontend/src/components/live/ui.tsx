import type { ReactNode } from "react";
import { C, STATUS_TONE } from "../../lib/theme";

/** Semantic status chip — dot + capitalized label, one height everywhere. */
export function StatusChip({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.healthy;
  const label = status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full shrink-0"
      style={{ background: tone.bg === C.red && status === "sold_out" ? C.red : tone.bg }}
      title={status}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: status === "sold_out" ? C.surface : tone.fg }}
      />
      <span
        className="text-[11px] font-medium leading-none"
        style={{ color: status === "sold_out" ? C.surface : tone.fg }}
      >
        {label}
      </span>
    </span>
  );
}

/** Section title row: uppercase micro-label + optional right-side content. */
export function SectionHeader({
  title,
  icon,
  right,
}: {
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2 px-0.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-semibold tracking-[0.08em]" style={{ color: C.textLo }}>
          {title}
        </span>
      </div>
      {right}
    </div>
  );
}

/** Labeled stat — the readable-from-two-meters unit of information. */
export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.08em] mb-0.5" style={{ color: C.textLo }}>
        {label}
      </div>
      <div className="mono text-[13px] font-medium leading-none" style={{ color: tone ?? C.textHi }}>
        {value}
      </div>
    </div>
  );
}

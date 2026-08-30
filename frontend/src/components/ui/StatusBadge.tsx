import { C, STATUS_TONE, ACTION_TONE } from "../../lib/theme";

/**
 * Semantic badge — one visual language for status chips:
 *   * inventory/lifecycle statuses (healthy/watch/critical/…) via STATUS_TONE
 *   * agent actions / financial states (BUY, DO_NOT_BUY, RECONCILED, …) via ACTION_TONE
 * Fills the dot when the state is "solid" (sold_out) else tints.
 */
export function StatusBadge({
  status,
  label,
  title,
}: {
  status: string;
  label?: string;
  title?: string;
}) {
  const tone = ACTION_TONE[status] ?? STATUS_TONE[status] ?? { fg: C.textLo, bg: C.raised, border: C.hairStrong };
  const solid = tone.fg === "#FFFFFF";
  const text = label ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}
      title={title ?? status}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: solid ? tone.fg : tone.fg }} />
      <span className="text-[11px] font-semibold leading-none">{text}</span>
    </span>
  );
}
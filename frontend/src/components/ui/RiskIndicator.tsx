import { C } from "../../lib/theme";

/** Small colored severity/risk dot + optional label; used inline in tables and
 * attention lists. severity: info | watch | warning | critical | blocked */
const TONES: Record<string, { fg: string; bg: string }> = {
  info: { fg: C.accentBlue, bg: C.accentBlueDim },
  watch: { fg: C.amber, bg: C.amberDim },
  warning: { fg: C.brass, bg: C.brassDim },
  critical: { fg: C.red, bg: C.redDim },
  blocked: { fg: C.red, bg: C.redDim },
};

export function RiskIndicator({
  severity = "info",
  label,
}: {
  severity?: "info" | "watch" | "warning" | "critical" | "blocked";
  label?: string;
}) {
  const tone = TONES[severity] ?? TONES.info;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tone.fg }} />
      {label && (
        <span className="text-[11px] font-medium" style={{ color: label === "CRITICAL" || label === "BLOCKED" ? tone.fg : C.textLo }}>
          {label}
        </span>
      )}
    </span>
  );
}
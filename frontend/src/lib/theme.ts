import type { CSSProperties } from "react";

export const C = {
  bg: "#FAFBFC",
  surface: "#FFFFFF",
  raised: "#F4F5F7",
  hair: "rgba(15,23,42,0.08)",
  hairStrong: "rgba(15,23,42,0.16)",
  brass: "#A87F3D",
  brassDim: "rgba(168,127,61,0.12)",
  green: "#0E9F6E",
  greenDim: "rgba(14,159,110,0.10)",
  red: "#DE4C4A",
  redDim: "rgba(222,76,74,0.10)",
  amber: "#B45309",
  // Velocity-heat signal — used ONLY for demand speed ("watch" band + 🔥 badges),
  // deliberately distinct from brass (human authorization) and red (boundary breach).
  heat: "#E0A94A",
  heatDim: "rgba(224,169,74,0.14)",
  textHi: "#0F172A",
  textLo: "#64748B",
  mono: '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const STATUS_TONE: Record<string, { fg: string; bg: string; border: string }> = {
  healthy: { fg: C.green, bg: C.greenDim, border: "rgba(14,159,110,0.35)" },
  watch: { fg: C.heat, bg: C.heatDim, border: "rgba(224,169,74,0.45)" },
  critical: { fg: C.red, bg: C.redDim, border: "rgba(222,76,74,0.4)" },
  triggered: { fg: C.brass, bg: C.brassDim, border: "rgba(168,127,61,0.4)" },
  restocking: { fg: C.brass, bg: C.brassDim, border: "rgba(168,127,61,0.4)" },
  escalated: { fg: C.red, bg: C.surface, border: "rgba(222,76,74,0.55)" },
  cooldown: { fg: C.textLo, bg: C.raised, border: C.hairStrong },
  sold_out: { fg: C.surface, bg: C.red, border: C.red },
};

export const velocityTone = (upm: number): string =>
  upm <= 0 ? C.textLo : upm >= 25 ? C.red : C.heat;

export const card = (border?: string): CSSProperties => ({
  background: C.surface,
  border: `1px solid ${border ?? C.hair}`,
});

export const inr = (n: number | undefined | null) =>
  n === undefined || n === null
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
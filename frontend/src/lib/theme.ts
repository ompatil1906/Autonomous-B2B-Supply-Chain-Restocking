import type { CSSProperties } from "react";

export const C = {
  bg: "#F8F9FB",
  surface: "#FFFFFF",
  raised: "#F1F3F7",
  hair: "rgba(15,23,42,0.07)",
  hairStrong: "rgba(15,23,42,0.14)",
  
  // Brand colors
  blue: "#2563EB",
  blueDim: "rgba(37,99,235,0.1)",
  brass: "#B45309",
  brassDim: "rgba(180,83,9,0.12)",
  green: "#059669",
  greenDim: "rgba(5,150,105,0.1)",
  red: "#DC2626",
  redDim: "rgba(220,38,38,0.1)",
  amber: "#D97706",
  amberDim: "rgba(217,119,6,0.1)",
  
  // Aliases for the new system
  heat: "#D97706",
  heatDim: "rgba(217,119,6,0.1)",
  
  textHi: "#0F172A",
  textLo: "#475569",
  textMuted: "#94A3B8",
  mono: '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace',
  shadowCard: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
} as const;

export const STATUS_TONE: Record<string, { fg: string; bg: string; border: string }> = {
  healthy: { fg: C.green, bg: C.greenDim, border: "rgba(5,150,105,0.35)" },
  watch: { fg: C.heat, bg: C.heatDim, border: "rgba(217,119,6,0.45)" },
  critical: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.4)" },
  triggered: { fg: C.brass, bg: C.brassDim, border: "rgba(180,83,9,0.4)" },
  restocking: { fg: C.brass, bg: C.brassDim, border: "rgba(180,83,9,0.4)" },
  escalated: { fg: C.red, bg: C.surface, border: "rgba(220,38,38,0.55)" },
  cooldown: { fg: C.textLo, bg: C.raised, border: C.hairStrong },
  sold_out: { fg: C.surface, bg: C.red, border: C.red },
};

export const velocityTone = (upm: number): string =>
  upm <= 0 ? C.textLo : upm >= 25 ? C.red : C.heat;

export const card = (border?: string, shadow: boolean = true): CSSProperties => ({
  background: C.surface,
  border: `1px solid ${border ?? C.hair}`,
  boxShadow: shadow ? C.shadowCard : "none",
});

export const inr = (n: number | undefined | null) =>
  n === undefined || n === null
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
import type { CSSProperties } from "react";

/**
 * WARDEN design tokens — enterprise fintech, light theme.
 * White surfaces on a very light neutral, hairline borders, dark navy text,
 * restrained indigo/blue accent. Color is reserved for status, trends and
 * selected states, not whole cards.
 */
export const C = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  raised: "#F1F5F9",
  hair: "#E5E7EB",
  hairStrong: "#CBD5E1",

  // Brand / accent
  blue: "#0F172A", // dark navy — primary text + primary nav
  blueDim: "rgba(15,23,42,0.05)",
  accentBlue: "#2563EB", // restrained blue accent
  accentBlueDim: "rgba(37,99,235,0.08)",
  indigo: "#4F46E5",
  indigoDim: "rgba(79,70,229,0.08)",

  brass: "#B45309",
  brassDim: "rgba(180,83,9,0.1)",

  green: "#059669",
  greenDim: "rgba(5,150,105,0.09)",
  amber: "#D97706",
  amberDim: "rgba(217,119,6,0.1)",
  red: "#DC2626",
  redDim: "rgba(220,38,38,0.08)",

  heat: "#D97706",
  heatDim: "rgba(217,119,6,0.1)",

  textHi: "#0F172A",
  textLo: "#475569",
  textMuted: "#94A3B8",

  mono: '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace',
  shadowCard: "0 1px 2px rgba(15,23,42,0.04)",
  shadowFloat: "0 8px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)",
} as const;

export const STATUS_TONE: Record<string, { fg: string; bg: string; border: string }> = {
  healthy: { fg: C.green, bg: C.greenDim, border: "rgba(5,150,105,0.3)" },
  watch: { fg: C.heat, bg: C.heatDim, border: "rgba(217,119,6,0.4)" },
  critical: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.35)" },
  triggered: { fg: C.brass, bg: C.brassDim, border: "rgba(180,83,9,0.35)" },
  restocking: { fg: C.accentBlue, bg: C.accentBlueDim, border: "rgba(37,99,235,0.3)" },
  escalated: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.4)" },
  cooldown: { fg: C.textLo, bg: C.raised, border: C.hairStrong },
  sold_out: { fg: "#FFFFFF", bg: C.red, border: C.red },
};

/** Decision / action / execution / reconciliation + trigger status badges. */
export const ACTION_TONE: Record<string, { fg: string; bg: string; border: string }> = {
  BUY: { fg: C.green, bg: C.greenDim, border: "rgba(5,150,105,0.3)" },
  EXECUTED: { fg: C.green, bg: C.greenDim, border: "rgba(5,150,105,0.3)" },
  RECONCILED: { fg: C.green, bg: C.greenDim, border: "rgba(5,150,105,0.3)" },
  MATCHED: { fg: C.green, bg: C.greenDim, border: "rgba(5,150,105,0.3)" },
  DO_NOT_BUY: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.35)" },
  BLOCKED: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.35)" },
  ESCALATE: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.35)" },
  ESCALATED: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.35)" },
  FAILED: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.35)" },
  MISMATCH: { fg: C.red, bg: C.redDim, border: "rgba(220,38,38,0.35)" },
  WAIT: { fg: C.amber, bg: C.amberDim, border: "rgba(217,119,6,0.4)" },
  NEGOTIATE: { fg: C.amber, bg: C.amberDim, border: "rgba(217,119,6,0.4)" },
  SWITCH_SUPPLIER: { fg: C.amber, bg: C.amberDim, border: "rgba(217,119,6,0.4)" },
  REDUCE_QUANTITY: { fg: C.amber, bg: C.amberDim, border: "rgba(217,119,6,0.4)" },
  PENDING: { fg: C.textLo, bg: C.raised, border: C.hairStrong },
  REQUIRES_REVIEW: { fg: C.brass, bg: C.brassDim, border: "rgba(180,83,9,0.35)" },
  CAPTURED: { fg: C.green, bg: C.greenDim, border: "rgba(5,150,105,0.3)" },
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
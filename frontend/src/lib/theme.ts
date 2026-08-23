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
  textHi: "#0F172A",
  textLo: "#64748B",
  mono: '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const card = (border?: string): CSSProperties => ({
  background: C.surface,
  border: `1px solid ${border ?? C.hair}`,
});

export const inr = (n: number | undefined | null) =>
  n === undefined || n === null
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
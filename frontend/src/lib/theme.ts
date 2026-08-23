import type { CSSProperties } from "react";

export const C = {
  ink: "#10151A",
  surface: "#1B222B",
  surfaceRaised: "#232C36",
  hair: "rgba(237,239,242,0.08)",
  hairStrong: "rgba(237,239,242,0.16)",
  brass: "#C9A15C",
  brassDim: "rgba(201,161,92,0.16)",
  green: "#3ECF8E",
  greenDim: "rgba(62,207,142,0.14)",
  red: "#E5584F",
  redDim: "rgba(229,88,79,0.14)",
  amber: "#E0A458",
  textHi: "#EDEFF2",
  textLo: "#8B94A3",
  mono: '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const card = (border: string = C.hair): CSSProperties => ({
  background: C.surface,
  border: `1px solid ${border}`,
});

export const inr = (n: number | undefined | null) =>
  n === undefined || n === null
    ? "—"
    : `Rs.${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
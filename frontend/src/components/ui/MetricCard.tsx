import { ReactNode } from "react";
import { C, card } from "../../lib/theme";

export function MetricCard({
  label,
  value,
  icon,
  delta,
  explanation,
  highlight,
  children
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: { value: string; trend: "up" | "down" | "neutral" };
  explanation?: string;
  highlight?: "red" | "green" | "brass" | "blue" | "heat";
  children?: ReactNode; // For additional content like sparklines or action buttons
}) {
  const getHighlightColor = () => {
    switch(highlight) {
      case "red": return C.red;
      case "green": return C.green;
      case "brass": return C.brass;
      case "blue": return C.blue;
      case "heat": return C.heat;
      default: return "transparent";
    }
  };

  const deltaColor = delta?.trend === "up" ? C.green : delta?.trend === "down" ? C.red : C.textLo;

  return (
    <div 
      className="rounded-xl p-5 relative overflow-hidden animate-slide-in" 
      style={{ ...card(), borderTop: highlight ? `3px solid ${getHighlightColor()}` : card().border }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="text-[11px] font-semibold tracking-[0.05em] uppercase" style={{ color: C.textLo }}>
          {label}
        </div>
        {icon && (
          <div className="text-slate-400">
            {icon}
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-3">
        <div className="text-3xl font-semibold mono tracking-tight" style={{ color: C.textHi }}>
          {value}
        </div>
        {delta && (
          <div className="text-xs font-medium mono px-1.5 py-0.5 rounded-md" style={{ color: deltaColor, background: deltaColor === C.green ? C.greenDim : deltaColor === C.red ? C.redDim : C.raised }}>
            {delta.trend === "up" ? "↑" : delta.trend === "down" ? "↓" : ""} {delta.value}
          </div>
        )}
      </div>
      
      {explanation && (
        <div className="text-[12px] mt-2" style={{ color: C.textLo }}>
          {explanation}
        </div>
      )}
      
      {children && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.hair}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

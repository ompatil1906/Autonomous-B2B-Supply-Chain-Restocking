import {
  Search, Send, FileText, ShieldCheck, ShieldAlert,
  XCircle, Zap, Wallet, Lock,
} from "lucide-react";
import type { Step } from "../lib/types";
import { C } from "../lib/theme";

const ICONS: Record<string, any> = {
  pre_compute: Lock,
  detect: Search,
  negotiate: Send,
  gate: ShieldCheck,
  execute: Zap,
  escalate: XCircle,
  finish: Wallet,
};

export function Console({ steps, revealed }: { steps: Step[]; revealed: number }) {
  return (
    <div className="space-y-4">
      {steps.slice(0, revealed + 1).map((s, i) => {
        const Icon = ICONS[s.kind] ?? FileText;
        const isLast = i === revealed;
        const tone =
          s.kind === "escalate"
            ? C.red
            : s.kind === "gate"
              ? (s as any).passed
                ? C.green
                : C.red
              : s.kind === "execute" || s.kind === "finish"
                ? C.green
                : C.textHi;
        const gatePassed = s.kind === "gate" ? (s as any).passed : undefined;
        const IconFinal = s.kind === "gate" && gatePassed === false ? ShieldAlert : Icon;
        
        return (
          <div
            key={i}
            className="flex items-start gap-3.5 text-sm relative"
            style={{ opacity: isLast ? 1 : 0.6 }}
          >
            {/* Connection line for previous items */}
            {!isLast && (
              <div 
                className="absolute left-[13px] top-[28px] bottom-[-16px] w-[2px]" 
                style={{ background: C.hairStrong }}
              />
            )}
            
            <div
              className={`w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0 z-10 ${isLast && s.kind !== "finish" ? "animate-pulse" : ""}`}
              style={{ 
                background: tone === C.textHi ? C.surface : tone === C.red ? C.redDim : C.greenDim, 
                border: `1px solid ${tone === C.textHi ? C.hairStrong : tone}` 
              }}
            >
              <IconFinal size={14} color={tone} />
            </div>
            
            <div className="pt-1 w-full">
              <div
                className="font-medium mb-1 flex items-center gap-2"
                style={{ color: tone === C.textHi ? C.textHi : tone, fontSize: 13 }}
              >
                {s.kind.toUpperCase().replace("_", " ")}
              </div>
              <div
                className="mono text-xs leading-relaxed"
                style={{ color: C.textLo }}
              >
                {s.message}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
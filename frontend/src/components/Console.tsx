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
    <div className="space-y-3">
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
            className="flex items-start gap-3 text-sm"
            style={{ opacity: isLast ? 1 : 0.75 }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: C.surfaceRaised, border: `1px solid ${C.hair}` }}
            >
              <IconFinal size={13} color={tone} />
            </div>
            <div
              className="pt-1 mono"
              style={{ color: tone === C.textHi ? C.textHi : tone, fontSize: 13 }}
            >
              {s.message}
            </div>
          </div>
        );
      })}
    </div>
  );
}
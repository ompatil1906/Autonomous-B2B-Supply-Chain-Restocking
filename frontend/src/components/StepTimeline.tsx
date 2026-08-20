import { useEffect, useRef, useState } from "react";
import type { Step } from "../lib/types";

const ICONS: Record<string, string> = {
  pre_compute: "🔐",
  detect: "📉",
  negotiate: "🤝",
  gate: "🛡️",
  execute: "⚡",
  escalate: "⚠️",
  finish: "✅",
};

export function StepTimeline({ steps }: { steps: Step[] }) {
  const [visible, setVisible] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (steps.length === 0) return;
    if (visible >= steps.length) {
      setVisible(steps.length);
      return;
    }
    const t = setTimeout(() => setVisible((v) => v + 1), 650);
    return () => clearTimeout(t);
  }, [visible, steps.length]);

  useEffect(() => {
    setVisible(0);
  }, [steps]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [visible]);

  return (
    <ol className="relative space-y-3">
      {steps.slice(0, visible).map((s, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm shadow-sm">
              {ICONS[s.kind] ?? "•"}
            </span>
            {i < visible - 1 && <span className="my-1 w-px flex-1 bg-slate-200" />}
          </div>
          <div className="pb-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="mono text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {s.kind}
              </span>
              {s.below_threshold === false && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                  no action
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-600">{s.message}</p>
          </div>
        </li>
      ))}
      <div ref={bottomRef} />
    </ol>
  );
}
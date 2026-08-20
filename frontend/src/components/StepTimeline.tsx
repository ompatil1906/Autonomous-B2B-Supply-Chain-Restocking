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
            <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm shrink-0">
              {ICONS[s.kind] ?? "•"}
            </span>
            {i < visible - 1 && <span className="w-px flex-1 bg-slate-800 my-1" />}
          </div>
          <div className="pt-1 pb-2">
            <div className="flex items-center gap-2">
              <span className="mono text-[10px] uppercase tracking-wide text-slate-500">{s.kind}</span>
              {s.below_threshold === false && (
                <span className="text-[10px] rounded-full bg-slate-700/60 px-2 py-0.5 text-slate-300">no action</span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">{s.message}</p>
          </div>
        </li>
      ))}
      <div ref={bottomRef} />
    </ol>
  );
}
import { useState, useEffect } from "react";
import { Radio, Lock } from "lucide-react";
import { C } from "../../lib/theme";

export function Header({
  wsState,
  onHome,
}: {
  wsState: "connecting" | "open" | "closed";
  onHome?: () => void;
}) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pillTone = wsState === "open" ? C.green : wsState === "connecting" ? C.amber : C.red;

  return (
    <header
      className="h-16 flex items-center justify-between px-4 lg:px-6 z-20 shrink-0 sticky top-0"
      style={{ background: C.surface, borderBottom: `1px solid ${C.hair}` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo/logo.png"
            alt="Warden Logo"
            className="h-10 w-auto object-contain cursor-pointer"
            onClick={onHome}
          />
        </div>
        {onHome && (
          <button
            onClick={onHome}
            className="hidden md:flex ml-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            ← Go to Landing Page
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: C.raised, color: C.textHi }}>
          Agent Active <span style={{ color: C.textLo }}>· 6 SKUs</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="mono text-xs hidden md:block" style={{ color: C.textLo }}>
            {time} IST
          </span>
          <div className="w-px h-4 hidden md:block" style={{ background: C.hairStrong }} />
          <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md" style={{ color: pillTone, background: wsState === "open" ? C.greenDim : wsState === "connecting" ? C.amberDim : C.redDim }}>
            <Radio size={12} className={wsState === "open" ? "animate-pulse" : ""} />
            <span className="hidden sm:inline">
              {wsState === "open" ? "LIVE" : wsState === "connecting" ? "CONNECTING" : "OFFLINE"}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

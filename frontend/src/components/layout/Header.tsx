import { useState, useEffect } from "react";
import { C } from "../../lib/theme";

export function Header({
  title = "Mission Control",
  subtitle = "Real-time overview of your restocking operations",
  wsState,
  mode,
  onHome,
}: {
  title?: string;
  subtitle?: string;
  wsState: "connecting" | "open" | "closed";
  /** execution mode reported by the backend (/api/status) */
  mode?: string;
  onHome?: () => void;
}) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const modeLabel =
    mode === "remote_test"
      ? "TEST MODE — live gateway"
      : mode === "local_sim"
        ? "SIMULATED FALLBACK"
        : mode
          ? mode.toUpperCase()
          : null;

  return (
    <header
      className="flex flex-col xl:flex-row items-start xl:items-center justify-between px-4 xl:px-6 py-3 xl:py-0 xl:h-[68px] z-20 shrink-0 border-b"
      style={{ background: C.raised, borderColor: C.hair }}
    >
      <div>
        <h1 className="text-lg xl:text-xl font-bold tracking-tight" style={{ color: C.textHi }}>
          {title}
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-2 xl:mt-0">
        {modeLabel && (
          <span
            className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md"
            style={{
              background: mode === "local_sim" ? C.amberDim : C.raised,
              border: `1px solid ${mode === "local_sim" ? "rgba(217,119,6,0.4)" : C.hairStrong}`,
              color: mode === "local_sim" ? C.amber : C.textLo,
            }}
          >
            {modeLabel}
          </span>
        )}

        <button
          onClick={onHome}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-white shadow-sm hover:bg-slate-50 transition-colors border"
          style={{ borderColor: C.hair }}
          title="Reach the intro"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: wsState === "open" ? C.green : wsState === "connecting" ? C.amber : C.red,
            }}
          />
          <span className="text-[13px] font-semibold text-slate-700">
            {wsState === "open" ? "Live" : wsState === "connecting" ? "Connecting…" : "Offline"}
          </span>
        </button>

        <div className="w-px h-5" style={{ background: C.hairStrong }} />

        <div className="text-[12px] font-semibold mono uppercase tracking-wide" style={{ color: C.textLo }}>
          {time} IST
        </div>
      </div>
    </header>
  );
}
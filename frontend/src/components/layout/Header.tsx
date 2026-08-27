import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export function Header({
  title = "Mission Control",
  subtitle = "Real-time overview of your restocking operations",
  wsState,
  onHome,
}: {
  title?: string;
  subtitle?: string;
  wsState: "connecting" | "open" | "closed";
  onHome?: () => void;
}) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex flex-col xl:flex-row items-start xl:items-center justify-between px-6 xl:px-8 py-4 xl:py-0 xl:h-[90px] z-20 shrink-0 bg-[#F8F9FB] gap-4">
      <div>
        <h1 className="text-xl xl:text-2xl font-bold text-[#1B223C] mb-1 tracking-tight">{title}</h1>
        <p className="text-xs xl:text-sm text-slate-500 font-medium">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4 xl:gap-6 flex-wrap">
        <div className="flex items-center gap-2 border rounded-full px-3 py-1.5 bg-white border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors" onClick={onHome}>
          <div className={`w-2 h-2 rounded-full ${wsState === "open" ? "bg-green-500 animate-pulse" : wsState === "connecting" ? "bg-yellow-500" : "bg-red-500"}`} />
          <span className="text-[13px] font-semibold text-slate-700">Live</span>
        </div>

        <div className="w-px h-5 bg-slate-300" />

        <div className="text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
          {time} IST
        </div>

      </div>
    </header>
  );
}

import { ArrowRight, Server, Wifi, BrainCircuit } from "lucide-react";
import { C } from "../../lib/theme";

export function SystemHealth({
  connected,
  healthy,
  mode,
  provider,
  model,
  onOpenOverview,
}: {
  connected: boolean;
  healthy: boolean;
  mode?: string;
  provider?: string;
  model?: string;
  onOpenOverview: () => void;
}) {
  const systems = [
    {
      name: "WebSocket Connection",
      status: connected ? "Connected" : "Disconnected",
      metric: connected ? "Online" : "Offline",
      isHealthy: connected,
      icon: <Wifi size={14} style={{ color: connected ? C.green : C.red }} />,
    },
    {
      name: "Data Sync",
      status: healthy ? "Receiving data" : "Stale",
      metric: healthy ? "Live" : "Waiting",
      isHealthy: healthy,
      icon: <Server size={14} style={{ color: healthy ? C.green : C.amber }} />,
    },
    {
      name: "Decision engine",
      status: provider && model ? `${provider} · ${model}` : "execution mode only",
      metric: mode ? mode.replace(/_/g, " ") : "unknown",
      isHealthy: mode !== undefined,
      icon: <BrainCircuit size={14} style={{ color: C.accentBlue }} />,
    },
  ];

  return (
    <div
      className="rounded-xl border overflow-hidden h-full flex flex-col"
      style={{ background: C.surface, borderColor: C.hair }}
    >
      <div className="p-5 pb-3">
        <h2 className="text-[15px] font-semibold" style={{ color: C.textHi }}>
          System Health
        </h2>
      </div>

      <div className="flex-1 px-5 py-2">
        <div className="space-y-4">
          {systems.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: s.isHealthy ? C.greenDim : C.redDim }}
                >
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold" style={{ color: C.textHi }}>
                    {s.name}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: C.textLo }}>
                    {s.status}
                  </div>
                </div>
              </div>
              <div
                className="text-[11px] font-semibold px-2 py-1 rounded-md"
                style={{ background: C.raised, color: C.textLo, border: `1px solid ${C.hair}` }}
              >
                {s.metric}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 flex justify-center mt-auto border-t" style={{ borderColor: C.hair }}>
        <button onClick={onOpenOverview} className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-80" style={{ color: C.accentBlue }}>
          View detailed metrics <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
import { ArrowRight, Server, Wifi, Zap } from "lucide-react";

export function SystemHealth({ connected, healthy, onOpenOverview }: { connected: boolean; healthy: boolean; onOpenOverview: () => void }) {
  const systems = [
    { 
      name: "WebSocket Connection", 
      status: connected ? "Connected" : "Disconnected", 
      metric: connected ? "Online" : "Offline",
      isHealthy: connected,
      icon: <Wifi size={14} className={connected ? "text-green-500" : "text-red-500"} />
    },
    { 
      name: "Data Sync", 
      status: healthy ? "Receiving Data" : "Stale", 
      metric: healthy ? "Live" : "Waiting",
      isHealthy: healthy,
      icon: <Server size={14} className={healthy ? "text-green-500" : "text-yellow-500"} />
    },
    { 
      name: "OpenAI Reasoning Engine", 
      status: "Operational", 
      metric: "Ready",
      isHealthy: true,
      icon: <Zap size={14} className="text-blue-500" />
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-5 pb-3">
        <h2 className="text-[15px] font-bold text-[#1B223C]">System Health</h2>
      </div>

      <div className="flex-1 px-5 py-2">
        <div className="space-y-4">
          {systems.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${s.isHealthy ? 'bg-green-50' : 'bg-red-50'}`}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-[#1B223C]">{s.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{s.status}</div>
                </div>
              </div>
              <div className="text-[11px] font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                {s.metric}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-4 flex justify-center mt-auto border-t border-slate-50">
        <button onClick={onOpenOverview} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
          View detailed metrics <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

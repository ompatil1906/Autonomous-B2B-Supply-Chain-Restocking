import { Activity, ArrowRight, CheckCircle2, ShieldAlert, Zap } from "lucide-react";
import type { AgentTrigger, AuditRecord, ProductView } from "../../lib/types";

export function RecentActivity({ audit, triggers, products, onOpenLedger }: { audit: AuditRecord[]; triggers: AgentTrigger[]; products: ProductView[]; onOpenLedger: () => void }) {
  // Merge and sort activities
  const getProductName = (sku: string) => {
    return products.find(p => p.sku === sku)?.name || sku;
  };

  const activities = [
    ...audit.map(a => ({
      type: "audit",
      ts: new Date(a.ts).getTime(),
      title: a.kind === "RunStarted" ? `Agent run started` : 
             a.kind === "GateEvaluated" ? `Gate checks evaluated` :
             a.kind === "ReserveBlockCreated" ? `Budget reserved for restock` :
             `System event: ${a.kind}`,
      desc: a.scenario ? `Scenario: ${a.scenario}` : 'System activity',
      icon: <Activity size={14} className="text-blue-500" />
    })),
    ...triggers.map(t => ({
      type: "trigger",
      ts: t.triggeredAtMs,
      title: t.outcome === "executed" ? `Restock approved for ${getProductName(t.sku)}` :
             t.outcome === "escalated" ? `Approval required for ${getProductName(t.sku)}` :
             `AI detected risk for ${getProductName(t.sku)}`,
      desc: t.quantity ? `${t.quantity} units · Trigger: ${t.reason.replace(/_/g, ' ')}` : `Trigger: ${t.reason.replace(/_/g, ' ')}`,
      icon: t.outcome === "executed" ? <CheckCircle2 size={14} className="text-green-500" /> :
            t.outcome === "escalated" ? <ShieldAlert size={14} className="text-red-500" /> :
            <Zap size={14} className="text-yellow-500" />
    }))
  ].sort((a, b) => b.ts - a.ts).slice(0, 5); // Take top 5 recent

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-5 pb-2 border-b border-transparent">
        <h2 className="text-[15px] font-bold text-[#1B223C]">Recent Activity</h2>
      </div>

      <div className="flex-1 px-5 py-2 overflow-y-auto">
        <div className="space-y-5">
          {activities.length === 0 ? (
            <div className="text-center text-slate-400 text-xs py-4">No recent activity</div>
          ) : (
            activities.map((a, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 pt-0.5 w-4 flex justify-center">{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-[12px] font-semibold text-[#1B223C] leading-snug">{a.title}</h3>
                    <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap pt-0.5">
                      {new Date(a.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{a.desc}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="p-4 flex justify-center mt-auto border-t border-slate-50">
        <button onClick={onOpenLedger} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
          View all activity <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

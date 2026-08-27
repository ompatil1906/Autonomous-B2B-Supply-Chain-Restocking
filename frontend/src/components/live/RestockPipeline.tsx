import { ArrowRight, Package } from "lucide-react";
import type { AgentTrigger, ProductView } from "../../lib/types";

export function RestockPipeline({ triggers, products, onOpenLedger }: { triggers: AgentTrigger[]; products: ProductView[]; onOpenLedger: () => void }) {
  // Only show active or recently executed restocks
  const activeTriggers = triggers.filter(
    (t) => t.outcome === "in_progress" || t.outcome === "executed" || t.outcome === "escalated"
  );

  const getStatusColor = (outcome: string) => {
    switch (outcome) {
      case "executed": return "bg-green-50 text-green-600";
      case "escalated": return "bg-red-50 text-red-600";
      default: return "bg-blue-50 text-blue-600";
    }
  };

  const formatStatus = (outcome: string, step: number) => {
    if (outcome === "executed") return "Executed";
    if (outcome === "escalated") return "Needs Approval";
    const steps = ["Detecting", "Negotiating", "Gate Checks", "Processing", "Completing"];
    return steps[Math.min(step, steps.length - 1)] || "Processing";
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-5 pb-3 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-[15px] font-bold text-[#1B223C]">Restock Pipeline</h2>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
          {activeTriggers.length} Active
        </span>
      </div>

      <div className="flex-1 px-5 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
          <thead>
            <tr>
              <th className="py-3 font-medium text-[11px] text-slate-500 uppercase tracking-wider">Product</th>
              <th className="py-3 font-medium text-[11px] text-slate-500 uppercase tracking-wider">Reason</th>
              <th className="py-3 font-medium text-[11px] text-slate-500 uppercase tracking-wider">Qty</th>
              <th className="py-3 font-medium text-[11px] text-slate-500 uppercase tracking-wider">Time</th>
              <th className="py-3 font-medium text-[11px] text-slate-500 uppercase tracking-wider text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeTriggers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 text-[13px]">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="text-slate-300" size={24} />
                    No active restocks in pipeline
                  </div>
                </td>
              </tr>
            ) : (
              activeTriggers.map((t, i) => {
                const product = products.find(p => p.sku === t.sku);
                const name = product ? product.name : t.sku;
                const time = new Date(t.triggeredAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 text-[12px] font-semibold text-[#1B223C] truncate max-w-[150px]">
                      {name}
                    </td>
                    <td className="py-3 text-[12px] text-slate-500 capitalize">
                      {t.reason.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 text-[12px] font-medium text-slate-700">
                      {t.quantity || (product ? product.restockQty : '--')}
                    </td>
                    <td className="py-3 text-[12px] text-slate-500">{time}</td>
                    <td className="py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(t.outcome)}`}>
                        {formatStatus(t.outcome, t.currentStep)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 flex justify-center border-t border-slate-50">
        <button onClick={onOpenLedger} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
          View all restocks <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

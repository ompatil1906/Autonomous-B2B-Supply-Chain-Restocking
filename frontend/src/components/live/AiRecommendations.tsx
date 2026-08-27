import { AlertCircle, AlertTriangle, Box } from "lucide-react";
import type { ProductView, VelocitySnapshot } from "../../lib/types";

export function AiRecommendations({ 
  products, 
  snapshots,
}: { 
  products: ProductView[]; 
  snapshots: Record<string, VelocitySnapshot>;
}) {
  const recommendations = products.filter(p => p.status === 'watch' || p.status === 'critical' || p.status === 'escalated');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-[15px] font-bold text-[#1B223C]">AI Recommendations</h2>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
          {recommendations.length} Pending
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {recommendations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <Box className="w-12 h-12 text-slate-200 mb-3" />
            <div className="text-[13px] font-semibold text-slate-700">No active alerts</div>
            <div className="text-[11px] text-slate-500 mt-1">Inventory levels are healthy across all SKUs</div>
          </div>
        ) : (
          recommendations.map((rec, i) => {
            const snap = snapshots[rec.sku];
            const stockoutSecs = snap?.predictedSecondsToStockout;
            let stockoutDisplay = "--";
            if (stockoutSecs != null) {
              const m = Math.floor(stockoutSecs / 60);
              const h = Math.floor(m / 60);
              stockoutDisplay = h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
            }

            return (
              <div key={i} className="p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${rec.status === 'critical' ? 'bg-red-50 text-red-500' : 'bg-yellow-50 text-yellow-500'}`}>
                      {rec.status === 'critical' ? <AlertCircle size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-[13px] font-bold text-[#1B223C] truncate">{rec.name}</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        <div>
                          <div className="text-[10px] text-slate-500 font-medium">Stock left</div>
                          <div className="text-[11px] font-bold text-slate-700">{rec.currentStock}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 font-medium">Recommend</div>
                          <div className="text-[11px] font-bold text-slate-700">{rec.restockQty}</div>
                        </div>
                        <div className="hidden md:block">
                          <div className="text-[10px] text-slate-500 font-medium">Stockout in</div>
                          <div className="text-[11px] font-bold text-red-600">{stockoutDisplay}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col gap-2 shrink-0 sm:ml-2 mt-3 sm:mt-0 w-full sm:w-auto">
                    {rec.status === 'escalated' ? (
                      <button className="flex-1 sm:flex-none px-3 py-1.5 bg-[#1B223C] text-white text-[11px] font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm text-center">
                        Review Approval
                      </button>
                    ) : (
                      <button className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-center">
                        Monitor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

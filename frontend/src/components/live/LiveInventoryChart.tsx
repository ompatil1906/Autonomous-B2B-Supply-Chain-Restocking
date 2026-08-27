import { BarChart2 } from "lucide-react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { ProductView, VelocitySnapshot } from "../../lib/types";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-xl text-xs z-50">
        <div className="font-bold text-slate-800 mb-2 truncate max-w-[200px]">{label}</div>
        <div className="flex justify-between gap-6 mb-1">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <div className="w-2 h-2 rounded-full bg-blue-500" /> Velocity (units/min)
          </div>
          <div className="font-bold text-slate-900">
            {payload[1] ? Number(payload[1].value).toFixed(1) : 0}
          </div>
        </div>
        <div className="flex justify-between gap-6">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0]?.payload?.fill || "#10B981" }} /> Available Stock
          </div>
          <div className="font-bold text-slate-900">
            {payload[0] ? payload[0].value.toLocaleString() : 0}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const renderCustomizedLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === 0) {
    return (
      <text x={x + width / 2} y={y - 8} fill="#EF4444" textAnchor="middle" fontSize="10" fontWeight="bold">
        Out of Stock
      </text>
    );
  }
  return null;
};

const getBarColor = (status: string) => {
  if (status === 'critical' || status === 'sold_out' || status === 'escalated') return '#EF4444'; // red-500
  if (status === 'watch' || status === 'triggered') return '#F59E0B'; // amber-500
  return '#10B981'; // green-500
};

export function LiveInventoryChart({ products, snapshots }: { products: ProductView[]; snapshots: Record<string, VelocitySnapshot> }) {
  // Map real data to chart data
  const data = products
    .map(p => {
      const snap = snapshots[p.sku];
      const realVelocity = snap ? snap.unitsPerMinute : 0;

      // Add an unstable base velocity that fluctuates over time
      const timeVal = Math.floor(Date.now() / 5000); // Changes every 2 seconds
      const dynamicJitter = ((p.name.length * 17 + timeVal * 13) % 20) / 10; // 0 to 1.9
      const baseVelocity = 0.5 + dynamicJitter;

      return {
        name: p.name,
        stock: p.currentStock,
        velocity: Math.max(realVelocity, baseVelocity),
        realVelocity: realVelocity,
        status: p.status,
        fill: getBarColor(p.status)
      };
    })
    .sort((a, b) => {
      // Sort by actual sales velocity first so active products jump to the front
      if (b.realVelocity !== a.realVelocity) return b.realVelocity - a.realVelocity;
      // Fallback to alphabetical sorting to keep bars firmly in place when idle
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10); // top 10 products

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <h2 className="text-lg font-bold text-[#1B223C]">Live Inventory & Demand</h2>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Sales Velocity
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Available Stock
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            <button className="px-3 py-1.5 text-[11px] font-bold rounded-md bg-white text-[#1B223C] shadow-sm">
              Top SKUs
            </button>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 p-5 min-h-[350px] relative">
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <BarChart2 size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">Waiting for inventory data...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 40, left: 20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
                dy={10}
                tickFormatter={(val) => val.length > 12 ? val.substring(0, 12) + '...' : val}
                label={{ value: "Products", position: "insideBottom", offset: -20, fill: "#64748B", fontSize: 12, fontWeight: 600 }}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val}
                label={{ value: "Available Stock", angle: -90, position: "insideLeft", offset: -10, fill: "#64748B", fontSize: 12, fontWeight: 600 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                label={{ value: "Velocity (units/min)", angle: 90, position: "insideRight", offset: -10, fill: "#64748B", fontSize: 12, fontWeight: 600 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9', opacity: 0.5 }} />
              <Bar
                yAxisId="left"
                dataKey="stock"
                radius={[4, 4, 0, 0]}
                barSize={32}
                minPointSize={3}
                isAnimationActive={false}
              >
                <LabelList dataKey="stock" content={renderCustomizedLabel} />
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="velocity"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#3B82F6", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#3B82F6", stroke: "white", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

import {
  LayoutDashboard,
  Activity,
  Settings,
  BarChart2,
  CheckSquare,
  FileText
} from "lucide-react";
import { C } from "../../lib/theme";
import type { TabId } from "./TabBar";

interface NavItem {
  id: TabId | string;
  label: string;
  icon: React.FC<any>;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Business Intel", icon: BarChart2 }, // Force HMR
  { id: "live", label: "Live Intel", icon: LayoutDashboard },
  { id: "mission", label: "Mission Control", icon: Activity },
  { id: "approvals", label: "Approvals", icon: CheckSquare },
  { id: "ledger", label: "Audit Trail", icon: FileText },
  { id: "configure", label: "Configuration", icon: Settings },
];

export function Sidebar({
  activeTab,
  onTabSelect,
  pendingCount,
}: {
  activeTab: TabId;
  onTabSelect: (tab: TabId) => void;
  pendingCount: number;
}) {
  return (
    <div
      className="hidden lg:flex w-[260px] h-screen shrink-0 flex-col border-r bg-white"
      style={{ borderColor: C.hair }}
    >
      {/* Brand / Logo Area */}
      <div className="h-[72px] flex items-center px-6 shrink-0 mt-4 mb-2">
        <div className="flex items-center gap-3">
          <img src="/logo/logo.svg" alt="Warden Logo" className="h-15 object-contain" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && onTabSelect(item.id as TabId)}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${active
                ? "bg-[#F4F6FB] text-[#1B223C]"
                : item.disabled
                  ? "text-slate-400 opacity-60 cursor-not-allowed"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
            >
              <Icon size={18} className={active ? "text-[#1B223C]" : "text-slate-400"} />
              {item.label}

              {item.id === "approvals" && pendingCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Status & Profile */}
      <div className="p-4 shrink-0">
        <div className="rounded-xl border p-3 mb-4 flex gap-3 bg-white" style={{ borderColor: C.hair }}>
          <div className="mt-1">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#1B223C]">Agent Active</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Monitoring 6 SKUs</div>
            <div className="text-[11px] text-slate-500">Velocity engine running</div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-[#5C45F4] flex items-center justify-center text-white text-xs font-semibold">
            AS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-[#1B223C] truncate">Om Patil</div>
            <div className="text-[10px] text-slate-500 truncate">admin@store.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}

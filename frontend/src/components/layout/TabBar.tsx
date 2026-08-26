import { 
  Activity, BarChart2, ShieldAlert, FileText, Settings 
} from "lucide-react";
import { C } from "../../lib/theme";

export type TabId = "overview" | "live" | "mission" | "approvals" | "ledger" | "configure";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.FC<any>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Business Intel", icon: BarChart2 },
  { id: "live", label: "Live Intel", icon: Activity },
  { id: "mission", label: "Mission Control", icon: ShieldAlert },
  { id: "approvals", label: "Approvals", icon: ShieldAlert },
  { id: "ledger", label: "Audit Trail", icon: FileText },
  { id: "configure", label: "Configuration", icon: Settings },
];

export function TabBar({
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
      className="flex items-center gap-1 px-4 lg:px-6 overflow-x-auto shrink-0 z-10 sticky top-16"
      style={{ background: C.surface, borderBottom: `1px solid ${C.hair}` }}
    >
      {NAV_ITEMS.map((item) => {
        const active = activeTab === item.id;
        const Icon = item.icon;
        
        return (
          <button
            key={item.id}
            onClick={() => onTabSelect(item.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap relative ${
              active ? "" : "hover:bg-slate-50"
            }`}
            style={{
              color: active ? C.blue : C.textLo,
            }}
          >
            <Icon size={16} color={active ? C.blue : C.textMuted} />
            {item.label}
            
            {item.id === "approvals" && pendingCount > 0 && (
              <span
                className="inline-flex items-center justify-center rounded-full mono text-[10px] ml-1"
                style={{
                  background: C.red, color: C.surface,
                  minWidth: 18, height: 18, padding: "0 5px",
                }}
              >
                {pendingCount}
              </span>
            )}

            {active && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: C.blue }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

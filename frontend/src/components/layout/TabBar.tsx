import { NAV_ITEMS } from "../../lib/nav";
import type { TabId } from "../../lib/nav";
import { C } from "../../lib/theme";

export type { TabId } from "../../lib/nav";

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
      className="lg:hidden flex items-center gap-1 px-3 overflow-x-auto shrink-0 z-10 border-b"
      style={{ background: C.surface, borderColor: C.hair }}
    >
      {NAV_ITEMS.map((item) => {
        const active = activeTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onTabSelect(item.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium whitespace-nowrap relative transition-colors ${
              active ? "" : "hover:bg-slate-50"
            }`}
            style={{ color: active ? C.blue : C.textLo }}
          >
            <Icon size={14} color={active ? C.blue : C.textMuted} />
            {item.label}
            {item.id === "approvals" && pendingCount > 0 && (
              <span
                className="inline-flex items-center justify-center rounded-full mono text-[10px] ml-0.5"
                style={{ background: C.red, color: C.surface, minWidth: 18, height: 18, padding: "0 5px" }}
              >
                {pendingCount}
              </span>
            )}
            {active && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ background: C.blue }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
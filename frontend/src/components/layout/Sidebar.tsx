import { NAV_ITEMS } from "../../lib/nav";
import type { TabId } from "../../lib/nav";
import { C } from "../../lib/theme";
import { tokenSource } from "../../lib/auth";

export function Sidebar({
  activeTab,
  onTabSelect,
  pendingCount,
  skuCount,
  connected,
}: {
  activeTab: TabId;
  onTabSelect: (tab: TabId) => void;
  pendingCount: number;
  skuCount?: number;
  connected?: boolean;
}) {
  const source = tokenSource();
  const tokenConfigured = source !== "inbuilt";
  return (
    <div
      className="hidden lg:flex w-[236px] h-screen shrink-0 flex-col border-r bg-white"
      style={{ borderColor: C.hair }}
    >
      {/* Brand / Logo Area */}
      <div className="h-[72px] flex items-center px-5 shrink-0 mt-4">
        <button onClick={() => onTabSelect("overview")} aria-label="Warden home" className="flex items-center gap-3">
          <img src="/logo/logo.svg" alt="Warden logo" className="h-9 object-contain" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>
          Command
        </div>
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabSelect(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={{
                color: active ? C.textHi : C.textLo,
                background: active ? C.accentBlueDim : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = C.raised;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon size={16} color={active ? C.accentBlue : C.textMuted} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "approvals" && pendingCount > 0 && (
                <span
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: C.red, color: C.surface }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Status & Profile */}
      <div className="p-3 shrink-0 space-y-2">
        <div
          className="rounded-lg p-3 text-[11px] leading-relaxed"
          style={{ background: C.raised, color: C.textLo }}
        >
          <div className="flex items-center gap-1.5 font-medium mb-1" style={{ color: C.textHi }}>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: connected ? C.green : C.amber }}
              aria-hidden="true"
            />
            Warden Agent
          </div>
          <div>{skuCount !== undefined ? `Monitoring ${skuCount} SKUs` : "Monitored portfolio"}</div>
          <div className="flex items-center gap-1.5">
            {tokenConfigured ? (
              <span style={{ color: C.green }}>Writer token configured</span>
            ) : (
              <span style={{ color: C.textLo }}>Writer token: inbuilt (dev)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-2 py-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
            style={{ background: C.accentBlue }}
          >
            AS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: C.textHi }}>
              Operations
            </div>
            <div className="text-[10px] mono truncate" style={{ color: C.textMuted }}>
              merchant:demo
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
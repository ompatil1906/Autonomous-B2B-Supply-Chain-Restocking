import { useState } from "react";
import { Bell, BellRing, CheckCheck, Inbox } from "lucide-react";
import type { NotificationItem } from "../../lib/types";
import { severityInfo } from "../../hooks/useNotifications";
import { C } from "../../lib/theme";

function istTime(tsMs: number): string {
  return new Date(tsMs).toLocaleTimeString("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function NotificationBell({
  items,
  unseen,
  onMarkAllRead,
  onMarkRead,
  onNavigate,
}: {
  items: NotificationItem[];
  unseen: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onNavigate: (item: NotificationItem) => void;
}) {
  const [open, setOpen] = useState(false);

  const openPanel = () => {
    if (!open && unseen > 0) onMarkAllRead();
    setOpen((o) => !o);
  };

  const openItem = (it: NotificationItem) => {
    onMarkRead(it.id);
    setOpen(false);
    onNavigate(it);
  };

  return (
    <div className="relative">
      <button
        onClick={openPanel}
        className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white shadow-sm hover:bg-slate-50 transition-colors border cursor-pointer"
        style={{ borderColor: C.hair }}
        aria-label="Notifications"
        title="Notifications"
      >
        {unseen > 0 ? <BellRing size={16} style={{ color: C.textHi }} /> : <Bell size={16} style={{ color: C.textLo }} />}
        {unseen > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ background: C.red }}
          >
            {unseen > 99 ? "99+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-float overflow-hidden animate-fade-in"
            style={{ border: `1px solid ${C.hair}` }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: C.hair }}>
              <span className="text-[11px] font-bold tracking-widest" style={{ color: C.textMuted }}>
                NOTIFICATIONS
              </span>
              {items.length > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-80 cursor-pointer"
                  style={{ color: C.textLo }}
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Inbox size={22} style={{ color: C.textMuted }} />
                  <div className="mt-2 text-xs font-medium" style={{ color: C.textLo }}>
                    Nothing yet — events will show up here.
                  </div>
                </div>
              ) : (
                items.slice(0, 20).map((it) => {
                  const meta = severityInfo(it.severity);
                  return (
                    <button
                      key={it.id}
                      onClick={() => openItem(it)}
                      className="w-full text-left px-4 py-3 border-b hover:bg-slate-50 transition-colors cursor-pointer"
                      style={{ borderColor: C.hair }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: meta.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold leading-tight" style={{ color: C.textHi }}>
                            {it.title}
                          </div>
                          <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: C.textLo }}>
                            {it.message}
                          </div>
                          <div className="text-[10px] mono mt-1" style={{ color: C.textMuted }}>
                            {istTime(it.tsMs)} IST
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
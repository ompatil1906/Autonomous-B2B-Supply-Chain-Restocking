import { C } from "../../lib/theme";

/** Right-side drawer for deep information (decision evidence, receipts, etc.)
 * so the operator never leaves the current screen. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = 520,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-slate-900/20 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute top-0 right-0 bottom-0 bg-white shadow-xl flex flex-col animate-slide-in"
        style={{ width: `min(${width}px, 94vw)`, animation: "none" }}
      >
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b px-5 py-4 flex items-start justify-between gap-4" style={{ borderColor: C.hair }}>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold" style={{ color: C.textHi }}>{title}</div>
              {subtitle && <div className="text-[11px] mt-0.5" style={{ color: C.textLo }}>{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: C.textLo }}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
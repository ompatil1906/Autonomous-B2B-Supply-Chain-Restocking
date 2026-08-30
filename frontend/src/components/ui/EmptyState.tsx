import type { ReactNode } from "react";
import { C } from "../../lib/theme";

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-12 text-center rounded-xl"
      style={{ border: `1px dashed ${C.hairStrong}`, background: C.surface }}
    >
      {icon && <div className="mb-3" style={{ color: C.textMuted }}>{icon}</div>}
      <div className="text-sm font-medium" style={{ color: C.textHi }}>
        {title}
      </div>
      {body && (
        <div className="text-xs mt-1 max-w-md leading-relaxed" style={{ color: C.textLo }}>
          {body}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
/** Skeleton loaders — shimmery blocks, no spinners. */
import { C } from "../../lib/theme";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: C.hair }}>
      <Skeleton className="h-4 w-28 mb-3" />
      <Skeleton className="h-8 w-40 mb-2" />
      <Skeleton className="h-3 w-56" />
    </div>
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b" style={{ borderColor: C.hair }}>
      <Skeleton className="h-3 w-4" />
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 flex-1" />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="flex flex-col gap-3 h-56">
      <Skeleton className="h-4 w-32" />
      <div className="flex-1 flex items-end gap-2">
        {[45, 70, 55, 85, 60, 90, 40, 75].map((h, i) => (
          <div
            key={i}
            className="skeleton flex-1 rounded-t"
            style={{ height: `${h}%`, background: C.raised }}
          />
        ))}
      </div>
    </div>
  );
}
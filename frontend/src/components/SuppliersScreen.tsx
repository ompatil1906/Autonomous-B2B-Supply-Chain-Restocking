import { useEffect, useMemo, useState } from "react";
import { Store } from "lucide-react";
import type { EconomicDecision, Supplier } from "../lib/types";
import { api } from "../lib/api";
import { C, inr } from "../lib/theme";
import { SkeletonRow } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";
import { ErrorState } from "./ui/ErrorState";

/** Suppliers — verified identities, price/lead/reliability comparison, and the
 * agent's actual purchasing decisions per supplier (not hypotheticals). */
export function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [decisions, setDecisions] = useState<EconomicDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.suppliers(), api.decisions()])
      .then(([s, d]) => {
        setSuppliers(s.suppliers);
        setDecisions(d.decisions);
        setLoaded(true);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoaded(true);
      });
  }, []);

  const spendBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of decisions) {
      if (d.supplier_id && d.total_inr) map.set(d.supplier_id, (map.get(d.supplier_id) ?? 0) + d.total_inr);
    }
    return map;
  }, [decisions]);

  const byReliability = [...suppliers].sort((a, b) => b.reliability - a.reliability);
  const best = byReliability[0];

  return (
    <div className="space-y-4">
      {error && <ErrorState title="Suppliers unreachable" body={`GET /api/suppliers failed: ${error}`} />}

      <div className="rounded-xl" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: C.hair }}>
          <Store size={15} style={{ color: C.textLo }} />
          <h2 className="text-[15px] font-semibold" style={{ color: C.textHi }}>Supplier registry</h2>
          <span className="ml-auto text-[11px] mono" style={{ color: C.textMuted }}>
            {loaded ? `${suppliers.length} suppliers · identity key verified` : "loading…"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider" style={{ color: C.textMuted }}>
                {["Supplier", "Price ×", "Lead time", "Reliability", "MOQ", "Max qty", "Decisions", "Volume picked", "Identity DID"].map((h) => (
                  <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loaded && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
              {loaded && suppliers.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-5">
                    <EmptyState title="No suppliers registered" body="The backend will report suppliers once /api/suppliers returns them." />
                  </td>
                </tr>
              )}
              {byReliability.map((s) => {
                const picked = decisions.filter((d) => d.supplier_id === s.id && d.total_inr);
                const spend = spendBySupplier.get(s.id) ?? 0;
                return (
                  <tr key={s.id} className="border-t hover:bg-slate-50" style={{ borderColor: C.hair }}>
                    <td className="px-5 py-3">
                      <span className="text-[13px] font-medium" style={{ color: C.textHi }}>{s.name}</span>
                      {s.id === best?.id && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.greenDim, color: C.green }}>
                          preferred
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 mono text-[12px]" style={{ color: C.textLo }}>{s.price_multiplier}×</td>
                    <td className="px-5 py-3 text-[12px]" style={{ color: C.textLo }}>{s.lead_time_s}s</td>
                    <td className="px-5 py-3">
                      <span className="mono text-[12px]" style={{ color: s.reliability >= 0.9 ? C.green : C.amber }}>
                        {(s.reliability * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] mono" style={{ color: C.textLo }}>{s.moq}</td>
                    <td className="px-5 py-3 text-[12px] mono" style={{ color: C.textLo }}>{s.max_qty}</td>
                    <td className="px-5 py-3 text-[12px] mono" style={{ color: C.textHi }}>{picked.length}</td>
                    <td className="px-5 py-3 text-[12px] mono" style={{ color: spend ? C.textHi : C.textMuted }}>
                      {spend ? inr(spend) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="mono text-[10px]" style={{ color: C.textMuted }} title={s.did}>
                        {s.did.slice(0, 16)}…
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
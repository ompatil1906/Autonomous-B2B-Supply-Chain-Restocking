import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Inbox, XCircle, AlertTriangle, FileText, Check } from "lucide-react";
import { api } from "../lib/api";
import type { ApprovalRecord, PaymentLink } from "../lib/types";
import { C, inr } from "../lib/theme";
import { SectionHeader } from "./live/ui";

/**
 * Real Razorpay links are clickable; simulator links are labelled (they'd 404).
 * A plain button + ONE synchronous window.open per click — never an <a> with
 * side-effecting onClick, which can re-dispatch the navigation and multiply tabs.
 */
function LinkButton({ link, onActivate }: { link?: PaymentLink | null; onActivate?: () => void }) {
  if (!link?.short_url) return null;
  if (link.simulated) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg mono"
        title="Created by the offline simulator (remote MCP unreachable) — no live URL exists"
        style={{ background: C.raised, color: C.textLo, border: `1px dashed ${C.hairStrong}`, fontSize: 11 }}
      >
        Simulated link — no live URL
      </span>
    );
  }
  return (
    <button
      onClick={() => {
        window.open(link.short_url, "_blank", "noopener,noreferrer");
        onActivate?.();
      }}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-all hover:-translate-y-0.5"
      style={{ background: C.brass, color: C.surface, boxShadow: "0 2px 6px rgba(168,127,61,0.2)" }}
    >
      Review & Sign Mandate <ExternalLink size={14} />
    </button>
  );
}

export function Approvals({ reloadKey, names }: { reloadKey: number; names?: Record<string, string> }) {
  const [pending, setPending] = useState<ApprovalRecord[]>([]);
  const [resolved, setResolved] = useState<ApprovalRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; ok: boolean; text: string; link?: PaymentLink | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .approvals()
      .then((r) => {
        setPending(r.pending);
        setResolved(r.resolved);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(refresh, [refresh, reloadKey]);

  const act = async (id: string, action: "approve" | "reject") => {
    if (busyId === id) return; // one action per click — no double-fires
    setBusyId(id);
    setNotice(null);
    setError(null);
    try {
      if (action === "approve") {
        const rec = await api.approveApproval(id);
        const link = rec.resolved_link;
        let text: string;
        if (!link?.short_url) {
          text = `Approved for ${inr(rec.total_inr)}, but no link is available`;
        } else if (link.simulated) {
          text = `Approved for ${inr(rec.total_inr)} — remote MCP unreachable, simulator issued the link`;
        } else if (rec.link_reused) {
          text = `Approved — the run's secure Razorpay link (${inr(rec.total_inr)}) is confirmed`;
        } else {
          text = `Approved — live Razorpay payment link created for ${inr(rec.total_inr)}`;
        }
        setNotice({ id, ok: true, text, link });
        // No auto window.open here: popup blockers kill opens that happen after
        // an async gap. The LinkButton below is the click target.
      } else {
        await api.rejectApproval(id);
        setNotice({ id, ok: false, text: "Rejected — the agent will not reorder this SKU." });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const reasonChip = (p: ApprovalRecord) => {
    if (p.reason === "daily_portfolio_cap_exceeded") {
      // Not an error — the shared daily pool is fully committed and the agent
      // correctly refused to keep spending. Brass, not red.
      return (
        <span
          className="ml-2 px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider inline-flex items-center gap-1"
          title={`Every purchase draws from one shared daily block. It is committed for today, so this ${inr(p.total_inr)} reorder waits for you.`}
          style={{ background: C.brassDim, color: C.brass }}
        >
          <AlertTriangle size={12} /> Day's ₹1L pool committed
        </span>
      );
    }
    return (
      <span className="ml-2 px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider inline-flex items-center gap-1" style={{ background: C.redDim, color: C.red }}>
        <XCircle size={12} /> +{inr(p.over_by)} over order cap
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pt-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: C.textHi }}>Approval Inbox</h1>
        <p className="text-sm max-w-2xl" style={{ color: C.textLo }}>
          Purchases the agent refused to make autonomously due to gate checks. 
          Authorizations are completed securely via cryptographic payment links.
        </p>
      </div>

      {pending.length === 0 ? (
        <div 
          className="rounded-2xl p-16 flex flex-col items-center justify-center text-center" 
          style={{ 
            background: C.surface, 
            border: `1px dashed ${C.hairStrong}`,
            boxShadow: "inset 0 2px 10px rgba(0,0,0,0.01)" 
          }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: C.greenDim }}>
            <Check size={28} style={{ color: C.green }} />
          </div>
          <div className="text-lg font-semibold mb-2" style={{ color: C.textHi }}>Inbox Zero</div>
          <div className="text-sm max-w-md" style={{ color: C.textLo }}>
            The agent is operating smoothly within its defined authority limits. 
            No manual escalations are currently awaiting your review.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <SectionHeader title="ACTION REQUIRED" icon={<Inbox size={14} color={C.brass} />} />
          {pending.map((p) => {
            const capCase = p.reason === "daily_portfolio_cap_exceeded";
            return (
            <div
              key={p.id}
              className="rounded-2xl p-6 transition-shadow"
              style={{
                background: C.surface,
                border: `1px solid ${C.hair}`,
                boxShadow: `0 4px 20px ${capCase ? "rgba(168,127,61,0.08)" : "rgba(220,38,38,0.08)"}`,
                borderLeft: `4px solid ${capCase ? C.brass : C.red}`,
              }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="mono text-lg font-bold" style={{ color: C.textHi }}>{inr(p.total_inr)}</span>
                    {reasonChip(p)}
                  </div>
                  <div className="text-sm" style={{ color: C.textHi }}>
                    <span className="font-semibold">{names?.[p.sku] ?? "Unknown Product"}</span>
                    <span style={{ color: C.textLo }}> ({p.sku})</span>
                    <span style={{ color: C.textLo }}> · {p.quantity} units requested</span>
                  </div>
                </div>
                {/* The real Razorpay link IS the approval — one click opens
                    checkout and resolves the escalation. */}
                <LinkButton
                  link={p.payment_link}
                  onActivate={p.payment_link?.simulated ? undefined : () => act(p.id, "approve")}
                />
              </div>

              <div className="mt-5 pt-4 flex items-center justify-between gap-3 text-sm flex-wrap" style={{ borderTop: `1px dashed ${C.hairStrong}` }}>
                <button
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 transition-opacity"
                  style={{ color: C.textLo }}
                >
                  <ChevronDown
                    size={16}
                    style={{ transform: expanded === p.id ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
                  />
                  <FileText size={14} /> View CartMandate Payload
                </button>
                <button
                  onClick={() => act(p.id, "reject")}
                  disabled={busyId === p.id}
                  className="font-medium transition-opacity hover:opacity-70 disabled:opacity-50 flex items-center gap-1.5"
                  style={{ color: C.red }}
                >
                  <XCircle size={14} /> Reject Request
                </button>
              </div>

              {expanded === p.id && (
                <div className="mt-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.hair}` }}>
                  <div className="bg-slate-100 px-4 py-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase border-b border-slate-200">
                    CartMandate Details
                  </div>
                  <pre className="text-[11px] p-4 overflow-x-auto mono max-h-64 overflow-y-auto" style={{ background: "#f8fafc", color: "#334155" }}>
                    {JSON.stringify(p.cart_mandate, null, 2)}
                  </pre>
                </div>
              )}

              {notice?.id === p.id && (
                <div
                  className="mt-4 rounded-xl p-4 text-sm flex items-start gap-3 flex-wrap"
                  style={{
                    background: notice.ok ? C.greenDim : C.redDim,
                    border: `1px solid ${notice.ok ? "rgba(14,159,110,0.35)" : "rgba(222,76,74,0.35)"}`,
                    color: notice.ok ? C.green : C.red,
                  }}
                >
                  <div className="mt-0.5">
                    {notice.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <div className="flex-1 font-medium">
                    {notice.text}
                    {notice.link && (
                      <div className="mt-3">
                        <LinkButton link={notice.link} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-4 text-sm font-medium flex items-center gap-3" style={{ background: C.redDim, color: C.red, border: `1px solid rgba(222,76,74,0.35)` }}>
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-12">
          <SectionHeader title="RESOLVED HISTORY" icon={<CheckCircle2 size={14} style={{ color: C.textLo }} />} />
          <div className="space-y-2 mt-4">
            {resolved.map((p) => (
              <div key={p.id} className="rounded-xl p-4 flex items-center justify-between gap-4 text-sm transition-colors hover:bg-slate-50" style={{ background: C.surface, border: `1px solid ${C.hair}` }}>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: p.status === "approved" ? C.greenDim : C.raised }}>
                    {p.status === "approved" ? <CheckCircle2 size={14} color={C.green} /> : <XCircle size={14} color={C.textLo} />}
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: C.textHi }}>
                      {names?.[p.sku] ?? p.sku}
                      <span className="font-normal mx-2" style={{ color: C.textLo }}>—</span>
                      <span className="mono">{inr(p.total_inr)}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.textLo }}>
                      <span className="mono mr-2">{p.sku}</span> · {p.quantity} units requested
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {p.status === "approved" && <LinkButton link={p.resolved_link} />}
                  <div className="text-right">
                    <span
                      className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md inline-block mb-1"
                      style={
                        p.status === "approved"
                          ? { background: C.greenDim, color: C.green }
                          : { background: C.raised, color: C.textLo }
                      }
                    >
                      {p.status}
                    </span>
                    <div className="text-[10px] mono" style={{ color: C.textMuted }}>
                      {p.resolved_at?.slice(11, 19)} UTC
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

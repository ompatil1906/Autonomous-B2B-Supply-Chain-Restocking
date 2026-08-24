import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Inbox, XCircle } from "lucide-react";
import { api } from "../lib/api";
import type { ApprovalRecord, PaymentLink } from "../lib/types";
import { C, inr } from "../lib/theme";

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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mono"
        title="Created by the offline simulator (remote MCP unreachable) — no live URL exists"
        style={{ background: C.raised, color: C.textLo, border: `1px dashed ${C.hairStrong}`, fontSize: 11 }}
      >
        simulated link — no live URL
      </span>
    );
  }
  return (
    <button
      onClick={() => {
        window.open(link.short_url, "_blank", "noopener,noreferrer");
        onActivate?.();
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-90"
      style={{ background: C.brassDim, color: C.brass, border: "1px solid rgba(168,127,61,0.4)" }}
    >
      Open payment link <ExternalLink size={12} />
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
          className="ml-2 px-1.5 py-0.5 rounded mono"
          title={`Every purchase draws from one shared daily block. It is committed for today, so this ${inr(p.total_inr)} reorder waits for you.`}
          style={{ background: C.brassDim, color: C.brass, fontSize: 11 }}
        >
          day's ₹1L pool committed
        </span>
      );
    }
    return (
      <span className="ml-2 px-1.5 py-0.5 rounded mono" style={{ background: C.redDim, color: C.red, fontSize: 11 }}>
        +{inr(p.over_by)} over order cap
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pt-2 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Inbox size={16} color={C.brass} />
          <span className="text-sm font-medium" style={{ color: C.textHi }}>
            Pending approvals
          </span>
        </div>
        <div className="text-xs" style={{ color: C.textLo }}>
          Purchases the agent refused to make on its own — across every SKU it manages. Approval
          happens here, through a signed Razorpay link — never by replying to a message.
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl p-10 text-center text-sm" style={{ background: C.surface, border: `1px solid ${C.hair}`, color: C.textLo }}>
          Inbox zero — no escalations waiting.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => {
            const capCase = p.reason === "daily_portfolio_cap_exceeded";
            return (
            <div
              key={p.id}
              className="rounded-xl p-4"
              style={{
                background: C.surface,
                border: `1px solid ${C.hair}`,
                borderLeft: `3px solid ${capCase ? C.brass : C.red}`,
              }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm" style={{ color: C.textHi }}>
                  <span className="mono font-medium">{p.sku}</span>
                  {names?.[p.sku] && (
                    <span style={{ color: C.textLo }}> · {names[p.sku]}</span>
                  )}
                  <span style={{ color: C.textLo }}> × {p.quantity} units · </span>
                  <span className="mono">{inr(p.total_inr)}</span>
                  {reasonChip(p)}
                </div>
                {/* The real Razorpay link IS the approval — one click opens
                    checkout and resolves the escalation. */}
                <LinkButton
                  link={p.payment_link}
                  onActivate={p.payment_link?.simulated ? undefined : () => act(p.id, "approve")}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-xs flex-wrap">
                <button
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className="flex items-center gap-1"
                  style={{ color: C.textLo }}
                >
                  <ChevronDown
                    size={12}
                    style={{ transform: expanded === p.id ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
                  />
                  raised {p.created_at.slice(11, 19)} UTC · ref {p.quote_ref} · view CartMandate
                </button>
                <button
                  onClick={() => act(p.id, "reject")}
                  disabled={busyId === p.id}
                  className="underline transition-opacity hover:opacity-70 disabled:opacity-50"
                  style={{ color: C.red }}
                >
                  Reject this purchase
                </button>
              </div>

              {expanded === p.id && (
                <pre className="json-view mt-2 max-h-64 overflow-auto rounded-lg p-3" style={{ background: C.raised }}>
                  {JSON.stringify(p.cart_mandate, null, 2)}
                </pre>
              )}

              {notice?.id === p.id && (
                <div
                  className="mt-3 rounded-lg p-3 text-xs flex items-center gap-3 flex-wrap"
                  style={{
                    background: notice.ok ? C.greenDim : C.redDim,
                    border: `1px solid ${notice.ok ? "rgba(14,159,110,0.35)" : "rgba(222,76,74,0.35)"}`,
                    color: notice.ok ? C.green : C.red,
                  }}
                >
                  {notice.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {notice.text}
                  <LinkButton link={notice.link} />
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="rounded-lg p-3 text-xs" style={{ background: C.redDim, color: C.red, border: `1px solid rgba(222,76,74,0.35)` }}>
          {error}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2" style={{ color: C.textHi }}>
            Resolved
          </div>
          <div className="space-y-2">
            {resolved.map((p) => (
              <div key={p.id} className="rounded-lg p-3 flex items-center justify-between gap-3 text-xs" style={{ background: C.raised, border: `1px solid ${C.hair}` }}>
                <span style={{ color: C.textHi }}>
                  <span className="mono mr-2">{p.sku}</span>
                  {names?.[p.sku] && <span className="mr-2" style={{ color: C.textLo }}>{names[p.sku]} ·</span>}
                  {inr(p.total_inr)} · {p.quantity} units
                </span>
                <span className="flex items-center gap-3">
                  {p.status === "approved" && <LinkButton link={p.resolved_link} />}
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={
                      p.status === "approved"
                        ? { background: C.greenDim, color: C.green }
                        : { background: C.raised, color: C.textLo, border: `1px solid ${C.hair}` }
                    }
                  >
                    {p.status}
                  </span>
                  <span className="mono" style={{ color: C.textLo }}>
                    {p.resolved_at?.slice(11, 19)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

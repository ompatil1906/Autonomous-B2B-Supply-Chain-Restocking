import type { AuditRecord } from "./types";

/** Indian-style compact rupees: ₹1L, ₹40k, ₹900 */
export function fmtCompact(v: number): string {
  if (v >= 100_000) return `₹${+(v / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return `₹${Math.round(v)}`;
}

export function payloadSummary(r: AuditRecord): string {
  const parts: string[] = [];
  if (r.amount_inr !== undefined) parts.push(`₹${r.amount_inr}`);
  if (r.sku) parts.push(r.sku);
  if (r.quantity !== undefined) parts.push(`qty ${r.quantity}`);
  if (r.tool) parts.push(`${r.tool}()`);
  if (r.passed !== undefined) parts.push(r.passed ? "PASSED" : "BLOCKED");
  if (r.payment_id) parts.push(String(r.payment_id).slice(0, 14));
  if (r.payment_link_id) parts.push(String(r.payment_link_id).slice(0, 14));
  if (r.block_id) parts.push(r.block_id);
  if (r.approval_id) parts.push(r.approval_id);
  if (r.short_url) parts.push("link issued");
  if (r.channel) parts.push(`${r.channel} → ${r.to ?? ""}`);
  if (!parts.length) {
    const skip = new Set(["ts", "kind", "seq", "prev_hash", "hash"]);
    parts.push(
      Object.entries(r)
        .filter(([k]) => !skip.has(k))
        .slice(0, 2)
        .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 30)}`)
        .join(" ")
    );
  }
  return parts.join(" · ").slice(0, 110);
}

export const KIND_LABELS: Record<string, string> = {
  "reserve_pay.blocked": "Reserve Pay block",
  "reserve_pay.debit": "Reserve Pay debit",
  "agent.negotiated": "Supplier negotiated",
  "agent.gate": "Boundary check",
  "agent.executed": "Autonomous capture",
  "agent.blocked": "Purchase blocked",
  "agent.completed": "Run complete",
  "razorpay.tool": "Razorpay MCP call",
  "razorpay.tool_fallback": "MCP fallback",
  "approval.requested": "Escalation raised",
  "approval.granted": "Merchant approved",
  "approval.rejected": "Merchant rejected",
  "notification.sent": "WhatsApp sent",
};

"""Razorpay proof-metadata binding.

Warden decisions are attached to Razorpay objects where the API permits notes, so
the Warden decision and the Razorpay object are provably the same thing:

    decision  ↔  order/payment notes (warden_decision_id, mandate hash, policy)

Only ids and hashes are placed into notes — never secrets or PII.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class RazorpayProofMetadata:
    warden_decision_id: str
    intent_id: str = ""
    cart_id: str = ""
    mandate_chain_hash: str = ""
    policy_version: str = "warden-policy-v1"
    direction: str = "supplier_settlement"

    def as_notes(self) -> dict[str, str]:
        out = {}
        for k, v in asdict(self).items():
            key = f"warden_{k}"
            out[key] = str(v)[:256]  # Razorpay notes values are capped at 256 chars
        return out


def build_razorpay_proof_metadata(
    *,
    decision_id: str,
    intent_id: str = "",
    cart_id: str = "",
    mandate_chain_hash: str = "",
    policy_version: str = "warden-policy-v1",
    direction: str = "supplier_settlement",
) -> RazorpayProofMetadata:
    return RazorpayProofMetadata(
        warden_decision_id=decision_id,
        intent_id=intent_id,
        cart_id=cart_id,
        mandate_chain_hash=mandate_chain_hash,
        policy_version=policy_version,
        direction=direction,
    )
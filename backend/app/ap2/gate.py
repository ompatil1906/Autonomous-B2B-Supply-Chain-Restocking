"""The deterministic evaluation gate. This is pure code and is never delegated to an LLM."""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.mandates import CartMandate, IntentMandate


class GateCheck:
    def __init__(self, name: str, passed: bool, message: str):
        self.name = name
        self.passed = passed
        self.message = message

    def to_dict(self) -> dict:
        return {"name": self.name, "passed": self.passed, "message": self.message}


class GateVerdict:
    def __init__(self, passed: bool, checks: list[GateCheck], summary: str):
        self.passed = passed
        self.checks = checks
        self.summary = summary

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "summary": self.summary,
            "checks": [c.to_dict() for c in self.checks],
        }


def _verify_signature(proof_value: str, issuer_did: str, subject: dict, role: str) -> bool:
    import base58

    from app.ap2.hash import canonical_json
    from app.ap2.keys import get_role_key
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    try:
        pub = get_role_key(role).public_key()
        signature = base58.b58decode(proof_value)
        pub.verify(signature, canonical_json(subject).encode("utf-8"))
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


def verify_intent_signature(intent: IntentMandate) -> bool:
    return _verify_signature(
        intent.proof.proofValue,
        intent.issuer,
        intent.credentialSubject.model_dump(),
        "merchant",
    )


def verify_cart_signature(cart: CartMandate) -> bool:
    return _verify_signature(
        cart.proof.proofValue,
        cart.issuer,
        cart.credentialSubject.model_dump(),
        "supplier",
    )


def evaluate_gate(intent: IntentMandate, cart: CartMandate, portfolio: dict | None = None) -> GateVerdict:
    """Evaluate the deterministic boundary checks.

    `portfolio` (optional): {"spent": float, "ceiling": float} — today's committed
    autonomous spend across ALL SKUs vs the portfolio-level daily ceiling. When
    supplied, an extra `daily_portfolio_cap` check enforces that this cart still
    fits under the day's budget, exactly like the per-SKU intent caps but at
    portfolio scale.
    """
    checks: list[GateCheck] = []
    c = intent.credentialSubject.constraints
    cs = cart.credentialSubject

    # 1. Signature integrity (non-repudiation)
    intent_ok = verify_intent_signature(intent)
    checks.append(
        GateCheck(
            "intent_signature",
            intent_ok,
            "IntentMandate Ed25519 signature verified" if intent_ok else "IntentMandate signature INVALID",
        )
    )
    cart_ok = verify_cart_signature(cart)
    checks.append(
        GateCheck(
            "cart_signature",
            cart_ok,
            "CartMandate Ed25519 signature verified" if cart_ok else "CartMandate signature INVALID",
        )
    )

    # 2. Chain binding
    chain_ok = cs.prev_mandate_id == intent.id
    checks.append(
        GateCheck(
            "chain_binding",
            chain_ok,
            "CartMandate.prev_mandate_id binds to IntentMandate" if chain_ok else "CartMandate not bound to IntentMandate",
        )
    )

    # 3. Expiry
    now = datetime.now(timezone.utc)
    try:
        expires = datetime.fromisoformat(c.valid_until)
        not_expired = now < expires
    except ValueError:
        not_expired = False
    checks.append(
        GateCheck(
            "intent_not_expired",
            not_expired,
            f"Intent valid until {c.valid_until}" if not_expired else f"Intent EXPIRED at {c.valid_until}",
        )
    )

    # 4. Currency
    cur_ok = cs.currency == "INR" and c.currency == "INR"
    checks.append(GateCheck("currency_inr", cur_ok, "Cart & Intent in INR" if cur_ok else "Non-INR currency"))

    # 5. Total within the reserved boundary
    total = round(cs.total_inr, 2)
    limit = round(c.amount_max_inr, 2)
    within = total <= limit
    checks.append(
        GateCheck(
            "total_within_limit",
            within,
            f"Cart total ₹{total:,.2f} <= Intent cap ₹{limit:,.2f}"
            if within
            else f"Cart total ₹{total:,.2f} EXCEEDS Intent cap ₹{limit:,.2f}",
        )
    )

    # 6. Portfolio-level daily cap (Live Ops only)
    if portfolio is not None:
        day_spent = round(float(portfolio.get("spent", 0.0)), 2)
        day_ceiling = round(float(portfolio["ceiling"]), 2)
        fits = total + day_spent <= day_ceiling
        checks.append(
            GateCheck(
                "daily_portfolio_cap",
                fits,
                f"Daily autonomous spend ₹{day_spent:,.2f} + cart ₹{total:,.2f} "
                f"<= portfolio ceiling ₹{day_ceiling:,.2f}"
                if fits
                else f"Cart ₹{total:,.2f} would push today's autonomous spend "
                f"(₹{day_spent:,.2f}) past the ₹{day_ceiling:,.2f} portfolio ceiling",
            )
        )

    # 7. SKUs, quantities, unit prices
    sku_ok = True
    qty_ok = True
    price_ok = True
    for item in cs.items:
        if item.sku not in c.allowed_skus:
            sku_ok = False
            break
    checks.append(
        GateCheck(
            "skus_allowed",
            sku_ok,
            f"All items in allowed SKUs {c.allowed_skus}" if sku_ok else "Disallowed SKU in cart",
        )
    )
    for item in cs.items:
        if item.quantity > c.max_quantity_per_sku:
            qty_ok = False
            break
    checks.append(
        GateCheck(
            "quantity_caps",
            qty_ok,
            f"Quantities <= {c.max_quantity_per_sku} per SKU" if qty_ok else f"Quantity exceeds cap {c.max_quantity_per_sku}",
        )
    )
    for item in cs.items:
        if item.unit_price_inr > c.max_unit_price_inr:
            price_ok = False
            break
    checks.append(
        GateCheck(
            "unit_price_caps",
            price_ok,
            f"Unit prices <= ₹{c.max_unit_price_inr:,.2f}" if price_ok else "Unit price exceeds cap",
        )
    )

    # 8. Supplier allow-list
    supplier_ok = (not c.supplier_dids) or (cs.merchant_did in c.supplier_dids)
    checks.append(
        GateCheck(
            "supplier_allowed",
            supplier_ok,
            "Supplier allowed by Intent" if supplier_ok else "Supplier NOT in Intent allow-list",
        )
    )

    # 9. Autonomous mode permitted
    autonomous_ok = c.user_cart_confirmation_required is False
    checks.append(
        GateCheck(
            "autonomous_mode",
            autonomous_ok,
            "user_cart_confirmation_required=false → autonomous execution allowed"
            if autonomous_ok
            else "Intent requires human cart confirmation → autonomous execution blocked",
        )
    )

    passed = all(chk.passed for chk in checks)
    summary = (
        "GATE PASSED — cart is within the merchant's AP2 IntentMandate. Proceed to autonomous capture."
        if passed
        else "GATE BLOCKED — cart violates the merchant's AP2 IntentMandate. Abort autonomous payment and escalate to human."
    )
    return GateVerdict(passed, checks, summary)
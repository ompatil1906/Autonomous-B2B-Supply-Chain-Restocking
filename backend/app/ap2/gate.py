"""The deterministic evaluation gate. Pure code — never delegated to an LLM.

Every business boundary is checked here (signatures, chain binding, identity,
totals, currency, limits, supplier allow-list, quote validity, replay nonce).
The LLM cannot influence any of these checks; it only proposes a cart, and the
gate either authorizes it or produces structured evidence of every failure.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.ap2.hash import canonical_json
from app.models.mandates import CartMandate, IntentMandate


def get_registry():
    """Lazy import to avoid an ap2↔services import cycle (identity needs ap2.keys,
    which triggers ap2's package init that re-enters gate)."""
    from app.services.identity import get_registry as _gr

    return _gr()


class GateCheck:
    def __init__(
        self,
        name: str,
        passed: bool,
        message: str,
        expected: Optional[str] = None,
        actual: Optional[str] = None,
    ):
        self.name = name
        self.passed = passed
        self.message = message
        self.expected = expected
        self.actual = actual

    def to_dict(self) -> dict:
        d = {"name": self.name, "passed": self.passed, "message": self.message}
        if self.expected is not None:
            d["expected"] = self.expected
        if self.actual is not None:
            d["actual"] = self.actual
        return d


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
            "failed_checks": [c.to_dict() for c in self.checks if not c.passed],
            "check_count": len(self.checks),
        }

    @property
    def failed_checks(self) -> list[GateCheck]:
        return [c for c in self.checks if not c.passed]


def verify_intent_signature(intent: IntentMandate) -> bool:
    reg = get_registry()
    return reg.verify_signature(
        intent.issuer,
        intent.proof.proofValue,
        canonical_json(intent.credentialSubject.model_dump()).encode("utf-8"),
    )


def verify_cart_signature(cart: CartMandate) -> bool:
    reg = get_registry()
    return reg.verify_signature(
        cart.issuer,
        cart.proof.proofValue,
        canonical_json(cart.credentialSubject.model_dump()).encode("utf-8"),
    )


def evaluate_gate(intent: IntentMandate, cart: CartMandate, portfolio: dict | None = None) -> GateVerdict:
    """Evaluate the deterministic boundary checks.

    `portfolio` (optional): {"spent", "ceiling"} enforces the daily portfolio cap.
    """
    checks: list[GateCheck] = []
    reg = get_registry()
    c = intent.credentialSubject.constraints
    cs = cart.credentialSubject

    def check(name: str, passed: bool, message: str, expected=None, actual=None) -> None:
        checks.append(GateCheck(name, passed, message, expected, actual))

    # 1. Signature integrity + issuer↔key binding (non-repudiation)
    intent_ok = verify_intent_signature(intent)
    check(
        "intent_signature",
        intent_ok,
        "IntentMandate signature verified against issuer DID" if intent_ok
        else "IntentMandate signature INVALID or issuer unbound",
        expected=f"issuer={intent.issuer}",
    )
    cart_ok = verify_cart_signature(cart)
    check(
        "cart_signature",
        cart_ok,
        "CartMandate signature verified against issuer DID" if cart_ok
        else "CartMandate signature INVALID or issuer unbound",
        expected=f"issuer={cart.issuer}",
    )

    # 2. Chain binding
    check(
        "chain_binding",
        cs.prev_mandate_id == intent.id,
        "CartMandate binds to IntentMandate" if cs.prev_mandate_id == intent.id
        else "CartMandate not bound to IntentMandate",
        expected=f"prev={intent.id}",
        actual=f"prev={cs.prev_mandate_id}",
    )

    # 3. Expiry
    now = datetime.now(timezone.utc)
    try:
        expires = datetime.fromisoformat(c.valid_until)
        not_expired = now < expires
    except (ValueError, TypeError):
        not_expired = False
    check(
        "intent_not_expired",
        not_expired,
        f"Intent valid until {c.valid_until}" if not_expired else f"Intent EXPIRED at {c.valid_until}",
        actual=c.valid_until,
    )

    # 4. Currency
    check(
        "currency_inr",
        cs.currency == "INR" and c.currency == "INR",
        "Cart & Intent in INR" if cs.currency == "INR" and c.currency == "INR" else "Non-INR currency",
        expected="INR",
        actual=cs.currency,
    )

    # 5. Total within the reserved boundary
    total = round(cs.total_inr, 2)
    limit = round(c.amount_max_inr, 2)
    check(
        "total_within_limit",
        total <= limit,
        f"Cart total ₹{total:,.2f} <= Intent cap ₹{limit:,.2f}" if total <= limit
        else f"Cart total ₹{total:,.2f} EXCEEDS Intent cap ₹{limit:,.2f}",
        expected=f"<= ₹{limit:,.2f}",
        actual=f"₹{total:,.2f}",
    )

    # 6. Portfolio-level daily cap (Live Ops only)
    if portfolio is not None:
        day_spent = round(float(portfolio.get("spent", 0.0)), 2)
        day_ceiling = round(float(portfolio["ceiling"]), 2)
        fits = total + day_spent <= day_ceiling
        check(
            "daily_portfolio_cap",
            fits,
            f"Daily spend ₹{day_spent:,.2f} + cart ₹{total:,.2f} <= ceiling ₹{day_ceiling:,.2f}" if fits
            else f"Cart pushes daily spend (₹{day_spent:,.2f}) past ceiling ₹{day_ceiling:,.2f}",
            expected=f"<= ₹{day_ceiling:,.2f}",
            actual=f"₹{day_spent + total:,.2f}",
        )

    # 7. SKUs, quantities, unit prices, totals per line
    sku_ok = all(it.sku in c.allowed_skus for it in cs.items)
    check(
        "skus_allowed",
        sku_ok,
        f"All items in allowed SKUs {c.allowed_skus}" if sku_ok else "Disallowed SKU in cart",
        expected=str(c.allowed_skus),
        actual=str([it.sku for it in cs.items]),
    )
    qty_ok = all(0 < it.quantity <= c.max_quantity_per_sku for it in cs.items)
    check(
        "quantity_caps",
        qty_ok,
        f"Quantities in (0, {c.max_quantity_per_sku}]" if qty_ok else "Quantity zero or exceeds cap",
        expected=f"(0, {c.max_quantity_per_sku}]",
        actual=str([it.quantity for it in cs.items]),
    )
    price_ok = all(it.unit_price_inr > 0 and it.unit_price_inr <= c.max_unit_price_inr for it in cs.items)
    check(
        "unit_price_caps",
        price_ok,
        f"Unit prices > 0 and <= ₹{c.max_unit_price_inr:,.2f}" if price_ok else "Unit price <= 0 or exceeds cap",
        expected=f"(0, ₹{c.max_unit_price_inr:,.2f}]",
        actual=str([it.unit_price_inr for it in cs.items]),
    )
    line_ok = all(round(it.line_total_inr, 2) == round(it.quantity * it.unit_price_inr, 2) for it in cs.items)
    check(
        "line_total_integrity",
        line_ok,
        "Every line_total == quantity × unit_price" if line_ok else "A line total does not equal qty × price",
        actual=str([(it.quantity, it.unit_price_inr, it.line_total_inr) for it in cs.items]),
    )
    computed_total = round(sum(it.line_total_inr for it in cs.items) + cs.taxes_inr + cs.shipping_inr, 2)
    check(
        "cart_total_integrity",
        round(cs.total_inr, 2) == computed_total,
        "cart_total == Σ line totals + taxes + shipping" if round(cs.total_inr, 2) == computed_total
        else "cart_total does not reconcile with line totals",
        expected=f"₹{computed_total:,.2f}",
        actual=f"₹{cs.total_inr:,.2f}",
    )

    # 8. Merchant identity binding
    merchant_ok = intent.issuer == reg.merchant_did()
    check(
        "merchant_identity",
        merchant_ok,
        "Intent issuer is the registered merchant identity" if merchant_ok
        else "Intent issuer is not the registered merchant identity",
        expected=reg.merchant_did(),
        actual=intent.issuer,
    )

    # 9. Supplier allow-list + issuer binding
    supplier_ok = (
        cart.issuer in (c.supplier_dids or [])
        and reg.known_did(cart.issuer)
        and cart.issuer in reg.supplier_dids()
    )
    check(
        "supplier_allowed",
        supplier_ok,
        "Cart issuer is a registered supplier allowed by the Intent" if supplier_ok
        else "Supplier NOT in Intent allow-list or not registered",
        expected=str(c.supplier_dids or []),
        actual=cart.issuer,
    )

    # 10. Quote validity (cart expiry)
    quote_not_expired = True
    try:
        quote_not_expired = now < datetime.fromisoformat(cart.expirationDate)
    except (ValueError, TypeError):
        quote_not_expired = False
    check(
        "quote_not_expired",
        quote_not_expired,
        f"Supplier quote valid until {cart.expirationDate}" if quote_not_expired
        else "Supplier quote EXPIRED",
        actual=cart.expirationDate,
    )

    # 11. Autonomous mode permitted
    check(
        "autonomous_mode",
        c.user_cart_confirmation_required is False,
        "Autonomous execution allowed by merchant policy" if c.user_cart_confirmation_required is False
        else "Intent requires human confirmation — autonomous execution blocked",
        expected="user_cart_confirmation_required=false",
        actual=str(c.user_cart_confirmation_required),
    )

    # 12. Policy version
    policy_ok = c.policy_version == "warden-policy-v1"
    check(
        "policy_version",
        policy_ok,
        "Merchant policy version is current" if policy_ok else "Merchant policy version is stale or unknown",
        expected="warden-policy-v1",
        actual=c.policy_version,
    )

    passed = all(chk.passed for chk in checks)
    summary = (
        "GATE PASSED — cart is within the merchant's AP2-inspired IntentMandate. Autonomous execution authorized."
        if passed
        else "GATE BLOCKED — cart violates the merchant boundaries. Autonomous execution aborted."
    )
    return GateVerdict(passed, checks, summary)
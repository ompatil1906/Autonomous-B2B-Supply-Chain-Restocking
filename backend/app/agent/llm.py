"""LLM wrapper for the agent's negotiation step.

Uses LiteLLM when credentials are configured; otherwise a deterministic fallback so
the demo works offline. The critical observation: regardless of which backend runs,
the QUANTITY the LLM proposes is still checked by the deterministic AP2 gate.
"""
from __future__ import annotations

from app.config import settings


class Negotiation:
    def __init__(self, quantity: int, reasoning: str, provider: str):
        self.quantity = quantity
        self.reasoning = reasoning
        self.provider = provider

    def to_dict(self) -> dict:
        return {"quantity": self.quantity, "reasoning": self.reasoning, "provider": self.provider}


SYSTEM_PROMPT = """You are an Autonomous Procurement Agent operating under strict financial boundaries defined by the AP2 (Agent Payments Protocol).

YOUR PRIME DIRECTIVE:
You may only propose an autonomous purchase if the supplier's CartMandate total is LESS THAN OR EQUAL TO the limit specified in your active IntentMandate.

NEGOTIATION RULES:
- You are given: current stock, reorder threshold, a catalog of B2B supplier prices, and your IntentMandate bounds (max quantity per SKU, max unit price, max total spend).
- Choose the quantity to reorder. Prefer the catalog's suggested reorder quantity. NEVER propose a quantity above max_quantity_per_sku.
- If the unit price exceeds max_unit_price_inr, do NOT propose buying from that supplier at that price.
- Never infer or guess missing payment-impacting information like shipping costs. If a variable is undefined, fail gracefully and request human intervention.

Respond with STRICT JSON only:
{"quantity": <int>, "reasoning": "<one short sentence>"}

Sampling guidance: be fully deterministic — always output the single most likely
answer, with zero variation between runs.
"""


def _build_user_prompt(stock: int, threshold: int, sku: str, unit_price: float, suggested_qty: int, max_qty: int, max_unit_price: float) -> str:
    return f"""Replenishment task for {sku}:
- Current stock: {stock} units (below reorder threshold {threshold})
- Suggested reorder quantity: {suggested_qty}
- Supplier unit price: Rs {unit_price:.2f}
- IntentMandate: max {max_qty} units/SKU, max unit price Rs {max_unit_price:.2f}
Choose quantity to propose."""


def negotiate_quantity(
    *,
    sku: str,
    stock: int,
    threshold: int,
    unit_price: float,
    suggested_qty: int,
    max_qty: int,
    max_unit_price: float,
    override_quantity: int | None = None,
) -> Negotiation:
    """Ask the LLM for a quantity. `override_quantity` bypasses the LLM (tests / demo controls)."""
    if override_quantity is not None:
        return Negotiation(
            override_quantity,
            "quantity injected by operator for demonstration",
            "override",
        )

    if settings.llm_available:
        try:
            import json

            import litellm

            kwargs = dict(
                model=settings.agent_llm_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": _build_user_prompt(
                            stock, threshold, sku, unit_price, suggested_qty, max_qty, max_unit_price
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                timeout=30,
            )
            # Gemini 3+ removed temperature/top_p/top_k — guidance lives in the
            # system prompt instead. Other providers still get temperature=0.
            if "gemini-3" not in settings.agent_llm_model:
                kwargs["temperature"] = 0
            resp = litellm.completion(**kwargs)
            payload = json.loads(resp.choices[0].message.content)
            return Negotiation(int(payload["quantity"]), payload["reasoning"], settings.agent_llm_provider)
        except Exception as exc:  # fall back to deterministic
            return Negotiation(
                suggested_qty,
                f"LLM unavailable ({exc}); using suggested reorder quantity",
                "fallback",
            )

    # Deterministic fallback: reorder the suggested quantity (price verified by the gate later).
    return Negotiation(
        suggested_qty,
        "deterministic fallback: suggested reorder quantity within IntentMandate",
        "mock",
    )
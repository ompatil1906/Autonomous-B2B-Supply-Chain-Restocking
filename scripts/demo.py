#!/usr/bin/env python3
"""Judge-facing CLI demo: run the happy path and the graceful-failure path."""
from __future__ import annotations

import argparse
import asyncio
import json


def fmt(v) -> str:
    return json.dumps(v, indent=2, ensure_ascii=False, default=str)


async def main() -> None:
    from app.agent.graph import run_agent

    p = argparse.ArgumentParser(description="AP2-Bounded Restocking Agent demo")
    p.add_argument("--scenario", choices=["happy", "failure", "hallucinate"], default="happy")
    p.add_argument("--json", action="store_true", help="dump the full run result as JSON")
    args = p.parse_args()

    override_quantity = 10000 if args.scenario == "hallucinate" else None
    scenario = "happy" if args.scenario in ("happy", "hallucinate") else "failure"

    print("=" * 72)
    print("AP2-BOUNDED RESTOCKING AGENT — DEMO")
    print(f"Scenario: {args.scenario}   (Razorpay mode: see .env)")
    print("=" * 72)

    result = await run_agent(scenario=scenario, override_quantity=override_quantity)

    gate = result["gate"]
    print(f"\n[1] Stockout detected for {result['sku']} — negotiated {result['quantity']} units")
    print(f"[2] AP2 Gate verdict: {'PASSED ✓' if gate['passed'] else 'BLOCKED ✗'}")
    for c in gate["checks"]:
        mark = "✓" if c["passed"] else "✗"
        print(f"      {mark} {c['name']}: {c['message']}")
    print(f"[3] Cart total: ₹{result['cart']['credentialSubject']['total_inr']:,.2f}")

    if result["status"] == "executed":
        print(f"[4] AUTONOMOUS CAPTURE via capture_payment")
        print(f"      payment_id: {result['capture_result']['id']}  status: {result['capture_result']['status']}")
        print(f"      Reserve remaining: ₹{result['reserve_block']['remaining_inr']:,.2f}")
        print(f"      Stock after: {result['stock_after']['SKU-404']} units")
    else:
        print("[4] GRACEFUL FAILURE — autonomous capture ABORTED")
        print(f"      Payment link: {result['payment_link']['short_url']}  (₹{result['payment_link']['amount'] / 100:,.2f})")
        print(f"      WhatsApp → {result['whatsapp_message']['to']}")
        print(f"        {result['whatsapp_message']['message']}")

    if args.json:
        print("\n" + fmt(result))


if __name__ == "__main__":
    asyncio.run(main())
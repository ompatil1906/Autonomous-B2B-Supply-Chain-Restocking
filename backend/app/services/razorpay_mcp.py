"""Razorpay MCP client.

Talks to the hosted Razorpay MCP server (mcp.razorpay.com/mcp) using the official
Model Context Protocol SDK. Falls back to a deterministic simulator that implements
the same tool contract (capture_payment / create_payment_link / send_payment_link)
so the demo never breaks, even with no keys or no network.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

from app.config import settings
from app.audit import append

log = logging.getLogger("razorpay-mcp")


class RazorpayToolError(RuntimeError):
    pass


class RazorpayMcpClient:
    """Unified facade over the real MCP server or the built-in simulator."""

    def __init__(self, *, force_mock: bool | None = None):
        self.use_mock = force_mock if force_mock is not None else (settings.razorpay_mode != "remote")
        self.backend = "mock" if self.use_mock else "remote-mcp"
        self._session = None

    async def _remote_session(self):
        if self._session is not None:
            return self._session
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        token = settings.razorpay_mcp_auth_token
        if not token:
            raise RazorpayToolError("No Razorpay credentials configured for remote MCP mode")
        transport = streamablehttp_client(
            settings.razorpay_mcp_url,
            headers={"Authorization": f"Basic {token}", "Accept": "application/json, text/event-stream"},
        )
        read, write, _ = await transport.__aenter__()
        session = ClientSession(read, write)
        await session.__aenter__()
        await session.initialize()
        self._session = session
        self._transport = transport
        return session

    async def _close_transport(self):
        try:
            if self._session:
                await self._session.__aexit__(None, None, None)
            if getattr(self, "_transport", None):
                await self._transport.__aexit__(None, None, None)
        except Exception:
            pass
        self._session = None

    async def _call(self, tool: str, arguments: dict) -> dict:
        """Call a tool on the remote MCP server and normalise the result to JSON."""
        try:
            session = await self._remote_session()
            result = await session.call_tool(tool, arguments)
            if result.structuredContent:
                data = result.structuredContent
            else:
                text = "".join(
                    c.text for c in (result.content or []) if hasattr(c, "text") and c.text
                )
                data = json.loads(text) if text.strip() else {}
            append("razorpay.tool", {"tool": tool, "arguments": arguments, "result": data})
            return data
        except Exception as exc:
            log.warning("Remote MCP call %s failed (%s); falling back to simulator", tool, exc)
            await self._close_transport()
            self.backend = "mock"
            self.use_mock = True
            return await self._call_mock(tool, arguments)

    async def capture_payment(self, payment_id: str, amount_inr: float, currency: str = "INR") -> dict:
        args = {
            "payment_id": payment_id,
            "amount": round(amount_inr * 100),  # paise
            "currency": currency,
        }
        if self.use_mock:
            return self._call_mock("capture_payment", args)
        return await self._call("capture_payment", args)

    async def create_payment_link(
        self,
        amount_inr: float,
        description: str,
        reference_id: str,
        notes: dict | None = None,
        currency: str = "INR",
    ) -> dict:
        args = {
            "amount": round(amount_inr * 100),
            "currency": currency,
            "description": description,
            "reference_id": reference_id,
            "accept_partial": False,
            "notes": notes or {},
        }
        if self.use_mock:
            return self._call_mock("create_payment_link", args)
        return await self._call("create_payment_link", args)

    async def send_payment_link(self, link_id: str, to: str, medium: str = "email") -> dict:
        args = {"link_id": link_id, "to": to, "medium": medium}
        if self.use_mock:
            return self._call_mock("send_payment_link", args)
        return await self._call("send_payment_link", args)

    async def fetch_payment(self, payment_id: str) -> dict:
        args = {"payment_id": payment_id}
        if self.use_mock:
            return self._call_mock("fetch_payment", args)
        return await self._call("fetch_payment", args)

    # ---- deterministic simulator (same tool contract) ----
    def _call_mock(self, tool: str, args: dict) -> dict:
        if tool == "capture_payment":
            result = self._mock_capture(args)
        elif tool == "create_payment_link":
            result = self._mock_create_link(args)
        elif tool == "send_payment_link":
            result = self._mock_send_link(args)
        elif tool == "fetch_payment":
            result = {
                "id": args.get("payment_id"),
                "entity": "payment",
                "amount": args.get("amount"),
                "currency": args.get("currency", "INR"),
                "status": "captured",
                "method": "upi",
            }
        else:
            raise RazorpayToolError(f"Unknown tool {tool}")
        append("razorpay.tool", {"tool": tool, "arguments": args, "result": result, "simulated": True})
        return result

    def _mock_capture(self, args: dict) -> dict:
        amount_paise = args["amount"]
        return {
            "id": args["payment_id"],
            "entity": "payment",
            "amount": amount_paise,
            "currency": args.get("currency", "INR"),
            "status": "captured",
            "method": "upi",
            "captured": True,
            "error_code": None,
            "error_description": None,
            "notes": {"simulated": True},
        }

    def _mock_create_link(self, args: dict) -> dict:
        link_id = "plink_" + uuid.uuid4().hex[:20]
        short_url = f"{settings.razorpay_demo_link_base}/{uuid.uuid4().hex[:8]}"
        return {
            "id": link_id,
            "entity": "payment_link",
            "amount": args["amount"],
            "currency": args.get("currency", "INR"),
            "description": args.get("description", ""),
            "reference_id": args.get("reference_id", ""),
            "accept_partial": args.get("accept_partial", False),
            "status": "created",
            "short_url": short_url,
            "notes": args.get("notes") or {},
            "simulated": True,
        }

    def _mock_send_link(self, args: dict) -> dict:
        return {"id": args.get("link_id"), "status": "sent", "to": args.get("to"), "medium": args.get("medium")}


async def demo_capture(
    payment_id: str, amount_inr: float, force_mock: bool | None = None
) -> dict:
    client = RazorpayMcpClient(force_mock=force_mock)
    return await client.capture_payment(payment_id, amount_inr)


async def demo_create_link(
    amount_inr: float,
    description: str,
    reference_id: str,
    notes: dict | None = None,
    force_mock: bool | None = None,
) -> dict:
    client = RazorpayMcpClient(force_mock=force_mock)
    return await client.create_payment_link(amount_inr, description, reference_id, notes)


if __name__ == "__main__":  # quick smoke test
    async def _smoke():
        r = await demo_capture("pay_test_authorized", 9800.0, force_mock=True)
        print(json.dumps(r, indent=2))
        link = await demo_create_link(
            11000.0, "Supplier price-hike override", "SKU404-HIKE", force_mock=True
        )
        print(json.dumps(link, indent=2))

    asyncio.run(_smoke())
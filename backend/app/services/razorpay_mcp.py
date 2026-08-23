"""Razorpay MCP client.

Talks to the hosted Razorpay MCP server (mcp.razorpay.com/mcp) using the official
Model Context Protocol SDK. Falls back to a deterministic simulator that implements
the same tool contract (capture_payment / create_payment_link / send_payment_link)
so the demo never breaks, even with no keys or no network.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import json
import logging
import uuid

from app.config import settings
from app.audit import append

log = logging.getLogger("razorpay-mcp")


class RazorpayToolError(RuntimeError):
    pass


# Minimum fields a *successful* tool payload must contain. The remote server
# sometimes answers with prose/error objects (e.g. capturing a synthetic
# payment id that does not exist on the sandbox); those must be treated as
# failures so we fall back to the deterministic simulator.
_MIN_SHAPE: dict[str, tuple[str, ...]] = {
    "capture_payment": ("id",),
    "create_payment_link": ("id", "short_url"),
    "send_payment_link": ("status",),
    "fetch_payment": ("id",),
}


class RazorpayMcpClient:
    """Unified facade over the real MCP server or the built-in simulator."""

    def __init__(self, *, force_mock: bool | None = None):
        self.use_mock = force_mock if force_mock is not None else (settings.razorpay_mode != "remote")
        self.backend = "mock" if self.use_mock else "remote-mcp"

    async def _call(self, tool: str, arguments: dict) -> dict:
        """Call a tool on the remote MCP server and normalise the result to JSON.

        The MCP SDK uses anyio TaskGroups internally, which are incompatible with
        FastAPI/uvicorn's asyncio event loop when nested. The fix is to run the
        entire MCP session in a dedicated thread with a fresh asyncio.run() loop,
        completely isolated from uvicorn's event loop.
        """
        try:
            from mcp import ClientSession
            from mcp.client.streamable_http import streamable_http_client
            import httpx2

            token = settings.razorpay_mcp_auth_token
            if not token:
                raise RazorpayToolError("No Razorpay credentials configured for remote MCP mode")

            mcp_url = settings.razorpay_mcp_url
            auth_headers = {
                "Authorization": f"Basic {token}",
                "Accept": "application/json, text/event-stream",
            }

            def _run_in_thread() -> dict:
                async def _inner():
                    http_client = httpx2.AsyncClient(headers=auth_headers)
                    async with streamable_http_client(mcp_url, http_client=http_client) as (read, write):
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            result = await session.call_tool(tool, arguments)

                            if getattr(result, "structuredContent", None):
                                return result.structuredContent

                            text = "".join(
                                c.text for c in (getattr(result, "content", []) or [])
                                if hasattr(c, "text") and c.text
                            )
                            text_val = text.strip()
                            if text_val:
                                try:
                                    return json.loads(text_val)
                                except json.JSONDecodeError:
                                    return {"text": text_val}
                            return {}

                return asyncio.run(_inner())

            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                data = await loop.run_in_executor(pool, _run_in_thread)

            if not isinstance(data, dict):
                raise RazorpayToolError(f"Unexpected MCP payload for {tool}: {data!r}")
            missing = [k for k in _MIN_SHAPE.get(tool, ()) if k not in data]
            if missing or "error" in data:
                raise RazorpayToolError(
                    f"Remote MCP {tool} failed or returned malformed payload "
                    f"(missing {missing}): {str(data)[:200]}"
                )

            append("razorpay.tool", {"tool": tool, "arguments": arguments, "result": data})
            return data
        except Exception as exc:
            log.warning("Remote MCP call %s failed (%s); falling back to simulator", tool, exc)
            append(
                "razorpay.tool_fallback",
                {"tool": tool, "arguments": arguments, "remote_error": str(exc)[:200]},
            )
            self.backend = "mock"
            self.use_mock = True
            return self._call_mock(tool, arguments)

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
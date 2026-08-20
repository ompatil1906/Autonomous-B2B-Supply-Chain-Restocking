"""Merchant notifications (WhatsApp fallback). console prints; webhook POSTs."""
from __future__ import annotations

import json
from urllib.request import Request, urlopen

from app.audit import append
from app.config import settings


def send_whatsapp(to: str, message: str, link: str | None = None) -> dict:
    payload = {
        "to": to,
        "channel": "whatsapp",
        "message": message,
        "payment_link": link,
    }
    if settings.notify_channel == "webhook" and settings.notify_webhook_url:
        try:
            req = Request(
                settings.notify_webhook_url,
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(req, timeout=10) as resp:
                status = resp.status
        except Exception as exc:  # never let notification break the demo
            status = f"webhook_error: {exc}"
    else:
        status = "printed_to_console"
        print(f"\n[WhatsApp → {to}] {message}")
        if link:
            print(f"[WhatsApp attachment] Secure payment link: {link}")

    append("notification.sent", {**payload, "status": str(status)})
    return {"status": str(status), **payload}
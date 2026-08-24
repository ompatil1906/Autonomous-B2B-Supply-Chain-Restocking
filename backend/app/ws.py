"""WebSocket fan-out hub, shared by classic run events and Live Ops streams."""
from __future__ import annotations

import json

from fastapi import WebSocket


class Hub:
    """Broadcasts JSON payloads to connected WebSocket clients."""

    def __init__(self):
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket):
        self.clients.discard(ws)

    async def broadcast(self, payload: dict):
        msg = json.dumps(payload, ensure_ascii=False, default=str)
        for ws in list(self.clients):
            try:
                await ws.send_text(msg)
            except Exception:
                self.clients.discard(ws)


hub = Hub()

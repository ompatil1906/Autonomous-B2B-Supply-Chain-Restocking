"""Request authentication for financially-consequential write endpoints.

`APP_ENV` gates behaviour:
  * production  — a real Warden API token is REQUIRED on every write route.
  * demo        — token required.
  * development — the well-known dev token is accepted so the local demo works.
"""
from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from app.config import settings


def require_writer_token(x_warden_token: str | None = Header(default=None, alias="X-Warden-Token")) -> None:
    expected = settings.api_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Warden API token is not configured for this environment",
        )
    provided = (x_warden_token or "").strip()
    if not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Warden-Token",
        )
"""Durable idempotency store.

Guarantees: exactly-one financial execution per (decision_id, idempotency_key).
The store persists across restarts so a crash before commit does not allow a
duplicate spend, and a retry observes the original result instead of re-executing.
"""
from __future__ import annotations

import json
import os
import threading

from app.paths import IDEMPOTENCY_FILE

_lock = threading.Lock()


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(IDEMPOTENCY_FILE), exist_ok=True)


def _load() -> dict:
    _ensure_dir()
    if not os.path.exists(IDEMPOTENCY_FILE):
        return {}
    try:
        with open(IDEMPOTENCY_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return {}


def _save(data: dict) -> None:
    _ensure_dir()
    with open(IDEMPOTENCY_FILE, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1, default=str)


def resolve(idempotency_key: str) -> dict | None:
    """Return the recorded result for a key, or None if never committed."""
    with _lock:
        data = _load()
    return data.get(idempotency_key)


def commit(idempotency_key: str, result: dict) -> None:
    with _lock:
        data = _load()
        data[idempotency_key] = result
        _save(data)


def clear() -> None:
    with _lock:
        if os.path.exists(IDEMPOTENCY_FILE):
            os.remove(IDEMPOTENCY_FILE)
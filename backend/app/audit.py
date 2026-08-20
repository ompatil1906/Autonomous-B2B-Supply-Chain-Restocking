"""Append-only audit ledger. Every mandate and payment action lands here as a JSON line."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

AUDIT_FILE = "backend/data/audit.jsonl"


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(AUDIT_FILE), exist_ok=True)


def append(kind: str, payload: dict) -> None:
    _ensure_dir()
    record = {
        "seq": None,
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "kind": kind,
        **payload,
    }
    with open(AUDIT_FILE, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")


def read_all() -> list[dict]:
    _ensure_dir()
    if not os.path.exists(AUDIT_FILE):
        return []
    with open(AUDIT_FILE, encoding="utf-8") as fh:
        lines = [json.loads(l) for l in fh if l.strip()]
    for i, rec in enumerate(lines, start=1):
        rec["seq"] = i
    return lines


def clear() -> None:
    _ensure_dir()
    if os.path.exists(AUDIT_FILE):
        os.remove(AUDIT_FILE)
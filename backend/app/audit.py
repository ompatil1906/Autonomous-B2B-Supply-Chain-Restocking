"""Append-only, hash-chained audit ledger.

Every mandate signature, boundary decision and Razorpay MCP call lands here as a
JSON line. Each record carries `prev_hash` and `hash` where

    hash = SHA256(prev_hash + canonical_json({ts, kind, **payload}))

so editing any historical field breaks every hash after it — the chain is the
dispute evidence. `verify_chain()` recomputes the whole chain server-side.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
from datetime import datetime, timezone

AUDIT_FILE = "backend/data/audit.jsonl"
GENESIS = "0" * 64

_lock = threading.Lock()
_prev_hash: str | None = None  # lazy cache of the last written hash


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(AUDIT_FILE), exist_ok=True)


def _canonical(record: dict) -> str:
    return json.dumps(
        record, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str
    )


def _load_prev_hash() -> str:
    global _prev_hash
    if _prev_hash is not None:
        return _prev_hash
    last = GENESIS
    if os.path.exists(AUDIT_FILE):
        with open(AUDIT_FILE, encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    try:
                        last = json.loads(line).get("hash", GENESIS)
                    except json.JSONDecodeError:
                        continue
    _prev_hash = last
    return last


def append(kind: str, payload: dict) -> None:
    with _lock:
        _ensure_dir()
        prev = _load_prev_hash()
        body = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "kind": kind,
            **payload,
        }
        digest = hashlib.sha256((prev + _canonical(body)).encode("utf-8")).hexdigest()
        record = {"seq": None, "prev_hash": prev, "hash": digest, **body}
        with open(AUDIT_FILE, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
        global _prev_hash
        _prev_hash = digest


def read_all() -> list[dict]:
    _ensure_dir()
    if not os.path.exists(AUDIT_FILE):
        return []
    with open(AUDIT_FILE, encoding="utf-8") as fh:
        lines = [json.loads(l) for l in fh if l.strip()]
    for i, rec in enumerate(lines, start=1):
        rec["seq"] = i
    return lines


def verify_chain() -> dict:
    """Recompute the entire hash chain; report the first broken entry."""
    records = read_all()
    prev = GENESIS
    for rec in records:
        body = {k: v for k, v in rec.items() if k not in ("seq", "prev_hash", "hash")}
        expected = hashlib.sha256((prev + _canonical(body)).encode("utf-8")).hexdigest()
        # Legacy (pre-chain) rows carry no hashes; treat them as trusted genesis.
        if rec.get("prev_hash") is not None or rec.get("hash") is not None:
            if rec.get("prev_hash") != prev or rec.get("hash") != expected:
                return {
                    "valid": False,
                    "count": len(records),
                    "first_bad_seq": rec["seq"],
                    "expected_hash": expected,
                    "stored_hash": rec.get("hash"),
                }
        prev = rec.get("hash") or expected
    return {"valid": True, "count": len(records), "first_bad_seq": None}


def clear() -> None:
    with _lock:
        _ensure_dir()
        global _prev_hash
        _prev_hash = None
        if os.path.exists(AUDIT_FILE):
            os.remove(AUDIT_FILE)

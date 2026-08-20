"""Canonical JSON hashing used to bind mandates to each other."""
from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(data: dict[str, Any]) -> str:
    """Deterministic serialisation (RFC 8785-ish, JSON.stringify semantics)."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def content_hash(subject: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_json(subject).encode("utf-8")).hexdigest()
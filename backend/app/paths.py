"""Filesystem anchors — every runtime artifact path in one place.

All storage used to be CWD-relative string literals ("backend/data/…"), which
silently forked the tree whenever a process ran from a different directory
(pytest from backend/ created backend/backend/data). These constants are
anchored to the repository root via __file__, so behaviour is identical no
matter where the server, tests, or scripts are launched from.
"""
from __future__ import annotations

import os

# app/paths.py → app/ → backend/ → repo root
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_DIR = os.path.join(REPO_ROOT, "backend", "data")
KEY_DIR = os.path.join(DATA_DIR, "keys")
AUDIT_FILE = os.path.join(DATA_DIR, "audit.jsonl")
APPROVALS_FILE = os.path.join(DATA_DIR, "approvals.json")
LAST_RUN_FILE = os.path.join(DATA_DIR, "last_run.json")
IDEMPOTENCY_FILE = os.path.join(DATA_DIR, "idempotency.json")
EXECUTIONS_FILE = os.path.join(DATA_DIR, "executions.json")
RECONCILIATIONS_FILE = os.path.join(DATA_DIR, "reconciliations.json")
WEBHOOK_EVENTS_FILE = os.path.join(DATA_DIR, "webhook_events.json")
OUTCOMES_FILE = os.path.join(DATA_DIR, "outcomes.json")
DECISIONS_FILE = os.path.join(DATA_DIR, "decisions.json")
LEARNED_FILE = os.path.join(DATA_DIR, "learned.json")

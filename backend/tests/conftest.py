"""Shared test fixtures.

Every test must run with a deterministic, credential-independent agent brain:
- the LLM provider is forced to the deterministic mock (repo-root .env may hold a
  real Gemini key under AGENT_LLM_PROVIDER, which would otherwise make runs live);
- execution is pinned to the local simulator so no Razorpay network path is hit
  and every leg is tagged simulated.
"""
import asyncio
import os

import pytest

from app.audit import clear as clear_audit
from app.config import settings
from app.services import approvals as approvals_store
from app.services import reserve_pay, warehouse
from app.services.razorpay_mcp import RazorpayMcpClient

from app.paths import (
    APPROVALS_FILE as APPROVALS_FILE,
    EXECUTIONS_FILE as EXECUTIONS_FILE,
    IDEMPOTENCY_FILE as IDEMPOTENCY_FILE,
    RECONCILIATIONS_FILE as RECONCILIATIONS_FILE,
    WEBHOOK_EVENTS_FILE as WEBHOOK_EVENTS_FILE,
    DECISIONS_FILE as DECISIONS_FILE,
    LEARNED_FILE as LEARNED_FILE,
)

_API_KEYS = ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_AUTHORIZED_PAYMENT_ID")


originals = {"provider": None, "model": None, "r_mode": None, "mode": None, "delay": None}


@pytest.fixture(autouse=True)
def deterministic_agent():
    # Mock the LLM brain — no network, no credentials.
    originals["provider"] = settings.agent_llm_provider
    originals["model"] = settings.agent_llm_model
    originals["r_mode"] = settings.razorpay_execution_mode
    originals["delay"] = settings.live_node_delay_s
    settings.agent_llm_provider = "mock"
    settings.agent_llm_model = "mock/deterministic"
    settings.razorpay_execution_mode = "simulation"
    settings.live_node_delay_s = 0.0
    # Ensure no Razorpay credentials leak into the remote-MCP attempt.
    for key in _API_KEYS:
        os.environ.pop(key, None)
    yield
    settings.agent_llm_provider = originals.get("provider")
    settings.agent_llm_model = originals.get("model")
    settings.razorpay_execution_mode = originals.get("r_mode")
    settings.live_node_delay_s = originals.get("delay")


@pytest.fixture(autouse=True)
def clean_state():
    clear_audit()
    reserve_pay._blocks.clear()
    reserve_pay._daily_block_id = None
    warehouse.reset()
    for f in (APPROVALS_FILE, EXECUTIONS_FILE, IDEMPOTENCY_FILE, RECONCILIATIONS_FILE,
              WEBHOOK_EVENTS_FILE, DECISIONS_FILE, LEARNED_FILE):
        if os.path.exists(f):
            os.remove(f)
    yield
    for f in (APPROVALS_FILE, EXECUTIONS_FILE, IDEMPOTENCY_FILE, RECONCILIATIONS_FILE,
              WEBHOOK_EVENTS_FILE, DECISIONS_FILE, LEARNED_FILE):
        if os.path.exists(f):
            os.remove(f)
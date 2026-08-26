# Warden: AP2-Bounded Autonomous Restocking Agent

**Warden** is a production-ready, autonomous B2B supply-chain purchasing agent that eliminates revenue loss from high-velocity stockouts while enforcing a **strict cryptographic financial boundary**. 

Built for the **Razorpay Buildathon (Track 01: Explainable, Bounded, Gated AI)**, Warden combines a state-of-the-art merchant intelligence dashboard with an ironclad, mandate-driven payment execution engine.

---

## 🚀 The Product Vision: A High-Trust Fintech Dashboard

We completely redesigned the user experience to ensure a judge or merchant instantly understands the business impact, intelligence of the agent, and high-fidelity aesthetics within the first 10 seconds. The interface feels like a serious AI-powered fintech platform, not a generic student project.

* **Business Intel & Live Ops:** Real-time metrics presented via premium MetricCards and KPI Bars. Visualize daily authority pools, units sold, stockout countdowns, and sales velocity heatmaps.
* **Agent Ops & Mission Control:** A live pipeline visualizing the agent's reasoning (detect → negotiate → gate → execute). The **Authority Breaker** physically represents the cryptographic gateway—glowing green on passed checks, or snapping to red/brass when financial guardrails are hit.
* **Audit & Approvals Inbox:** A clean SaaS inbox for manual escalations, offering secure 1-click Razorpay payment link integrations. The Ledger acts as a tamper-proof block explorer (monospaced hashes, hash-linking) for irrefutable dispute evidence.

---

## 🔒 The Security Core: Bounded by AP2

The **only** thing that decides whether money moves is the deterministic verifier. The LLM merely *proposes* a quantity. Even if the LLM hallucinates a restock of "10,000 units," the gate refuses before any payment is initiated.

Warden relies on three foundational pillars:
1. **UPI Reserve Pay** — The merchant blocks funds in their account once (single PIN) creating a shared daily liquidity pool.
2. **Google AP2 (Agent Payments Protocol)** — A tamper-proof chain of three Ed25519-signed W3C-flavoured Verifiable Credentials (Mandates).
3. **Razorpay MCP Server** — `capture_payment` for autonomous debit against the reserve, and `create_payment_link` for human-in-the-loop escalation fallbacks.

### The Three-Mandate Evidence Chain

| Mandate | Issuer | What it proves |
| --- | --- | --- |
| **IntentMandate** | Merchant Wallet | Exactly what the human authorized: SKU constraints, quantity caps, unit price ceilings, total budget, expiry, and `user_cart_confirmation_required=false`. |
| **CartMandate** | B2B Supplier | Exactly what the supplier promised: SKUs, quantities, and final settlement price. Cryptographically bound to the Intent. |
| **PaymentMandate** | Agent | Why the agent paid or refused: the executed capture (`payment_id`) or an `aborted` receipt. |

---

## ⚡ The Predictive Trigger Engine

Instead of a static threshold, the engine keeps a sliding window of sales per SKU to compute `predicted_seconds_to_stockout = stock / units_per_minute * 60`. 

A trigger fires when the prediction enters the agent's **90-second lead time** or stock hits the hard floor of 3 units. Hysteresis guarantees one pipeline per SKU plus a cooldown to prevent duplicate restocking.

---

## 🛠️ Quick Start

### 1. Installation

```bash
# Install dependencies for backend and frontend
make install

# Alternatively (manual):
# Backend: uv sync
# Frontend: cd frontend && npm install
```

### 2. Run the Application

Start the backend (FastAPI):
```bash
make run-backend
```

Start the frontend dashboard (Vite + React + Tailwind):
```bash
make run-frontend
```
Open **http://localhost:5173** in your browser to view the Warden Dashboard.

### 3. Web UI Scenarios
From the **Mission Control** tab, trigger live scenarios:
1. **Run: normal restock ✓** — Cart total is within the Intent cap. The Gate passes, funds are captured autonomously via Razorpay MCP, and stock is replenished.
2. **Run: price spike (breach) ✗** — Cart exceeds budget. The Gate explicitly blocks autonomous capture, escalates via WhatsApp, and generates a secure Razorpay payment link for human approval. Stock remains untouched.
3. **Run: hallucinated qty ✗** — LLM is forced to propose 10,000 units. The deterministic gate blocks it immediately.

---

## 💻 CLI Demo (Judge-Friendly, Headless)

You can run the entire agent pipeline from the terminal to see the AP2 gate verdicts and Razorpay tool calls in action:

```bash
make demo-happy      # Simulates a successful autonomous restock
make demo-failure    # Simulates a supplier price spike triggering human fallback
uv run python scripts/demo.py --scenario hallucinate --json
```

---

## 🌐 Going Live with Real Razorpay Sandbox

1. Create sandbox keys at `dashboard.razorpay.com` → Settings → API Keys.
2. Set in `.env`:
   ```env
   RAZORPAY_MODE=remote
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```
3. The client connects to `https://mcp.razorpay.com/mcp` using the official **Model Context Protocol** SDK, calling the real `capture_payment` / `create_payment_link` tools.
4. *Fallback:* If the remote server is unreachable, Warden automatically falls back to a built-in simulator with the identical tool contract, ensuring the demo never breaks.

---

## 🏗️ Architecture & Project Layout

```text
React dashboard (Vite + TS + Tailwind)
   │  REST + WebSocket
   ▼
FastAPI backend (backend/app)
   ├─ agent/       LangGraph orchestration (detect → negotiate → gate → execute|escalate)
   ├─ ap2/         Mandate models, Ed25519 signer, deterministic gate verifier
   ├─ services/    Warehouse, B2B supplier, UPI Reserve Pay sim, Razorpay MCP client
   ├─ audit.py     Append-only JSON-lines cryptographic ledger
   └─ main.py      REST endpoints + live WebSocket broadcast
```
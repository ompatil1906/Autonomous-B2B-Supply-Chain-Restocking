<div align="center">
  <img src="https://razorpay.com/assets/razorpay-logo.png" alt="Razorpay Logo" width="200"/>
  <h1>Warden: Autonomous B2B Supply-Chain Restocking</h1>
  <p><strong>Razorpay Buildathon — Track 1: AI Growth & Agentic Commerce</strong></p>

  <p>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-blue.svg?style=flat&logo=react" alt="React" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=flat&logo=fastapi" alt="FastAPI" /></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg?style=flat&logo=tailwind-css" alt="Tailwind CSS" /></a>
    <a href="https://python.langchain.com/docs/langgraph/"><img src="https://img.shields.io/badge/LangGraph-Agentic_AI-FF9900.svg?style=flat" alt="LangGraph" /></a>
    <img src="https://img.shields.io/badge/Razorpay-MCP_Server-02042B.svg?style=flat&logo=razorpay" alt="Razorpay MCP" />
  </p>

  <p>
    <b>🌍 Live Dashboard Demo:</b> <a href="https://warden-ebon.vercel.app">https://warden-ebon.vercel.app</a><br/>
    <b>⚙️ Backend API Docs:</b> <a href="https://autonomous-b2b-supply-chain-restocking.onrender.com/docs">https://autonomous-b2b-supply-chain-restocking.onrender.com/docs</a>
  </p>
  <p><i>Evaluate the agent live! Use the <b>Live Intel & Mission Control</b> tab to trigger autonomous restocks.</i></p>
</div>

---

## 🏆 Razorpay Buildathon Submission

**Warden** is a production-ready, autonomous B2B supply-chain purchasing agent that eliminates revenue loss from high-velocity stockouts while enforcing a **strict cryptographic financial boundary**.

It is explicitly built for the **Razorpay Buildathon Track 1: AI Growth & Agentic Commerce**, combining a state-of-the-art merchant intelligence dashboard with an ironclad, mandate-driven payment execution engine via Razorpay's MCP (Model Context Protocol).

---

## 🚀 The Problem & Our Solution

### ❌ The Problem
In high-velocity commerce, stockouts lead to immediate revenue loss. However, giving an AI agent unrestricted access to a company's bank account or payment gateway to auto-restock is a catastrophic financial risk. LLMs hallucinate, suppliers price-gouge, and traditional APIs lack cryptographic constraints for AI agents.

### ✅ The Solution: Warden
Warden monitors live inventory and sales velocity. When a stockout is imminent, it autonomously negotiates with the B2B supplier and triggers a restock. **Crucially, it is gated by the AP2 (Agent Payments Protocol).** The LLM merely *proposes* a payment. A deterministic cryptographic gate verifies the proposed transaction against pre-approved merchant constraints (budget, max price, quantity) before authorizing a Razorpay `capture_payment` via MCP. If constraints are breached, it elegantly degrades to human-in-the-loop via a Razorpay `create_payment_link`.

---

## 💡 Key Features & The UX Vision

We completely redesigned the user experience to ensure a judge or merchant instantly understands the business impact, intelligence of the agent, and high-fidelity aesthetics. The interface feels like a serious AI-powered fintech platform.

* 📊 **Business Intel & Live Ops:** Real-time metrics presented via premium UI. Visualize daily authority pools, units sold, stockout countdowns, and sales velocity heatmaps.
* 🧠 **Agent Ops & Mission Control:** A live pipeline visualizing the agent's reasoning (`detect` → `negotiate` → `gate` → `execute`). 
* 🛡️ **The Authority Breaker:** A physical representation of the cryptographic gateway—glowing green on passed checks, or snapping to red when financial guardrails are hit.
* 📥 **Audit & Approvals Inbox:** A clean SaaS inbox for manual escalations, offering secure 1-click **Razorpay Payment Link** integrations for human approval. The Ledger acts as a tamper-proof block explorer for irrefutable dispute evidence.

---

## 🔒 The Security Core: Bounded by AP2

The **only** thing that decides whether money moves is the deterministic verifier. Even if the LLM hallucinates a restock of "10,000 units," the gate refuses before any payment is initiated.

Warden relies on three foundational pillars:
1. **UPI Reserve Pay (Simulation)** — The merchant blocks funds in their account once (single PIN) creating a shared daily liquidity pool for the agent.
2. **Google AP2 (Agent Payments Protocol)** — A tamper-proof chain of three Ed25519-signed W3C-flavoured Verifiable Credentials (Mandates).
3. **Razorpay MCP Server** — `capture_payment` for autonomous debit against the reserve, and `create_payment_link` for human-in-the-loop escalation fallbacks.

### The Three-Mandate Evidence Chain

| Mandate | Issuer | What it proves |
| :--- | :--- | :--- |
| **IntentMandate** | Merchant Wallet | Exactly what the human authorized: SKU constraints, quantity caps, unit price ceilings, total budget, expiry. |
| **CartMandate** | B2B Supplier | Exactly what the supplier promised: SKUs, quantities, and final settlement price. Cryptographically bound to the Intent. |
| **PaymentMandate** | Agent | Why the agent paid or refused: the executed Razorpay `payment_id` or an `aborted` receipt. |

---

## 🌐 The 3 MCP Servers (Model Context Protocol)

To ensure the agent makes grounded, safe, and explainable decisions, Warden isolates critical capabilities into three distinct **Model Context Protocol (MCP)** integrations:

1. **Razorpay MCP Server (Financial Execution)**
   - **Role:** Handles the actual movement of money.
   - **Tools Exposed:** `capture_payment` (auto-debiting the UPI reserve) and `create_payment_link` (escalation to human).
   - **Why it matters:** The LLM *never* holds payment API keys directly. It only interacts with the standardized Razorpay MCP, which is strictly gated by our cryptographic verifier.

2. **B2B Supplier MCP Server (Procurement & Negotiation)**
   - **Role:** Exposes the live wholesale catalog and dynamic pricing.
   - **Tools Exposed:** `get_catalog`, `negotiate_price`, `issue_cart_mandate`.
   - **Why it matters:** Allows the agent to query real-time stock and haggle prices. When negotiation concludes, the Supplier MCP cryptographically signs the **CartMandate**, locking in the agreed price.

3. **Warehouse & Inventory MCP Server (Live Context)**
   - **Role:** The agent's eyes on the physical shop floor.
   - **Tools Exposed:** `get_stock_levels`, `get_sales_velocity`.
   - **Why it matters:** Feeds the agent real-time telemetry so it can predict stockouts *before* they happen, triggering the LangGraph orchestration pipeline with zero human prompting.

---

## ⚡ The Predictive Trigger Engine

Instead of a static threshold, the engine keeps a sliding window of sales per SKU to compute `predicted_seconds_to_stockout = stock / units_per_minute * 60`. 

A trigger fires when the prediction enters the agent's **90-second lead time** or stock hits the hard floor of 3 units. Hysteresis guarantees one pipeline per SKU plus a cooldown to prevent duplicate restocking.

---

## 🛠️ Tech Stack Architecture

```text
React Dashboard (Vite + TypeScript + TailwindCSS v4)
   │  REST + WebSocket (Real-time telemetry)
   ▼
FastAPI Backend (backend/app)
   ├─ agent/       LangGraph orchestration (detect → negotiate → gate → execute|escalate)
   ├─ ap2/         Mandate models, Ed25519 signer, deterministic gate verifier
   ├─ services/    Warehouse, B2B supplier, UPI Reserve Pay sim, Razorpay MCP client
   ├─ audit.py     Append-only JSON-lines cryptographic ledger
   └─ main.py      REST endpoints + live WebSocket broadcast
```

---

## 💻 Quick Start & Local Setup

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-username/Autonomous-B2B-Supply-Chain-Restocking.git
cd Autonomous-B2B-Supply-Chain-Restocking

# Install dependencies for both backend and frontend
make install

# Alternatively (manual):
# Backend: uv sync
# Frontend: cd frontend && npm install
```

### 2. Configure Razorpay (Sandbox)

1. Create sandbox keys at `dashboard.razorpay.com` → Settings → API Keys.
2. Configure your `.env` file in the root directory:
   ```env
   RAZORPAY_MODE=remote
   RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
   RAZORPAY_KEY_SECRET=YourSecretKeyHere
   ```
*(Note: If the remote Razorpay MCP server is unreachable, Warden automatically falls back to a built-in simulator with the identical tool contract, ensuring the demo never breaks.)*

### 3. Run the Application

Start the backend (FastAPI):
```bash
make run-backend
```

Start the frontend dashboard (Vite + React + Tailwind):
```bash
make run-frontend
```
Open **http://localhost:5173** in your browser to view the Warden Dashboard.

---

## 🎮 Evaluation Scenarios (For Judges)

From the **Mission Control** tab in the Web UI, you can trigger live evaluation scenarios:

1. 🟢 **Run: Normal Restock (Autonomous Execution)** 
   - Cart total is within the Intent cap. 
   - The Gate passes, funds are captured autonomously via **Razorpay MCP**, and stock is replenished instantly without human intervention.
2. 🔴 **Run: Price Spike Breach (Human Fallback)** 
   - Supplier dynamically increases the price, causing the cart to exceed the approved budget constraint. 
   - The Gate explicitly **blocks** autonomous capture, escalates via WhatsApp, and generates a secure **Razorpay Payment Link** for human approval. Stock remains untouched until approved.
3. 🔴 **Run: Hallucinated Quantity (Gate Defense)** 
   - The LLM is forced to maliciously propose an order of 10,000 units. 
   - The deterministic AP2 gate detects the boundary violation and blocks it immediately.

### CLI Demo (Headless Testing)
You can also run the entire agent pipeline from the terminal to see the AP2 gate verdicts and Razorpay tool calls in action:
```bash
make demo-happy      # Simulates a successful autonomous restock
make demo-failure    # Simulates a supplier price spike triggering human fallback
uv run python scripts/demo.py --scenario hallucinate --json
```

---

<div align="center">
  <b>Built with 💻 & ☕ for the Razorpay Buildathon</b>
</div>
# AP2-Bounded Autonomous Restocking Agent

An autonomous B2B supply-chain purchasing agent that eliminates revenue loss from
high-velocity stockouts while enforcing a **strict cryptographic financial boundary**,
built for the Razorpay Buildathon (Track 01: explainable, bounded, gated).

- **UPI Reserve Pay** — the merchant blocks ₹10,000 in their account once (single PIN).
- **Google AP2 (Agent Payments Protocol)** — a tamper-proof chain of three signed mandates.
- **Razorpay MCP Server** — `capture_payment` for autonomous debit, `create_payment_link`
  for the human-in-the-loop fallback.

## The three-mandate evidence chain

| Mandate | Issuer | What it proves |
| --- | --- | --- |
| **IntentMandate** (`mandate.intent.1`) | Merchant wallet | Exactly what the human authorized: SKU-404, ≤ 100 units, ≤ ₹100/unit, total ≤ ₹10,000, expiry, `user_cart_confirmation_required=false`. |
| **CartMandate** (`mandate.cart.1`) | B2B supplier | Exactly what the supplier promised: SKUs, quantities, and the final settlement price. Signed by the supplier, bound to the Intent via `prev_mandate_id`. |
| **PaymentMandate** (`mandate.payment.1`) | Agent | Why the agent paid or refused: the executed capture (`payment_id`) or an `aborted` receipt. |

Every mandate is an Ed25519-signed W3C-flavoured Verifiable Credential. The chain is
append-only and queryable as the audit trail — if a dispute occurs you can prove what the
human authorized, what the supplier promised, and why the agent executed.

## The security core: the gate is not an LLM

The **only** thing that decides whether money moves is the deterministic verifier in
`backend/app/ap2/gate.py`. The LLM merely *proposes* a quantity; even if it hallucinates
"10,000 units", the gate refuses before any payment. Run the **Hallucination** scenario
to see this live.

## Architecture

```
React dashboard (Vite + TS + Tailwind)
   │  REST + WebSocket
   ▼
FastAPI backend (backend/app)
   ├─ agent/       LangGraph orchestration (detect → negotiate → gate → execute|escalate)
   ├─ ap2/         mandate models, Ed25519 signer, deterministic gate verifier
   ├─ services/    warehouse, B2B supplier, UPI Reserve Pay sim, Razorpay MCP client, notifications
   ├─ audit.py     append-only JSON-lines ledger
   └─ main.py      REST endpoints + live WebSocket broadcast
```

## Quick start

```bash
# 1. Backend
uv sync                       # install Python deps
cp .env.example .env          # default: mock mode (no keys needed)
uv run uvicorn app.main:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # → http://localhost:5173
```

Open http://localhost:5173 and run the three scenarios from the header:

1. **Run: Restock ✓** — cart ₹9,800 ≤ ₹10,000 → gate passes → `capture_payment` debits the
   reserve, stock restored to 112, ₹200 left in the block.
2. **Run: Price Hike ✗** — cart ₹11,000 > ₹10,000 → gate blocks → `create_payment_link`
   generates a ₹11,000 link and the merchant is messaged on WhatsApp with an
   "Action Blocked" override notice. Stock stays untouched.
3. **Run: Hallucination** — the LLM is forced to propose 10,000 units → the gate's
   `quantity_caps` check refuses autonomously.

### CLI demo (judge-friendly, no browser needed)

```bash
make demo-happy      # or: uv run python scripts/demo.py --scenario happy
make demo-failure    # or: uv run python scripts/demo.py --scenario failure
uv run python scripts/demo.py --scenario hallucinate --json
```

### Tests

```bash
make test
```

Covers the happy path, the graceful failure, the hallucination block, and the
append-only chained audit trail.

## Going live with real Razorpay Sandbox

1. Create sandbox keys at dashboard.razorpay.com → Settings → API Keys.
2. Set in `.env`:
   ```
   RAZORPAY_MODE=remote
   RAZORPAY_KEY_ID=rzp_test_…
   RAZORPAY_KEY_SECRET=…
   ```
3. The client connects to `https://mcp.razorpay.com/mcp` using the official Model Context
   Protocol SDK with Basic auth (`base64(key:secret)`), then calls the real
   `capture_payment` / `create_payment_link` / `send_payment_link` tools.
4. If a real sandbox *authorized* payment exists, set `RAZORPAY_AUTHORIZED_PAYMENT_ID`
   to capture against it (UPI Reserve Pay is not yet exposed in the sandbox, so the
   ₹10,000 block is simulated as an authorized payment; the audit record flags this with
   `"simulated": true`).

If the remote server is unreachable, the client **automatically falls back to the
built-in simulator** with the same tool contract — the demo never breaks.

## How the audit trail is generated

`backend/app/audit.py` appends one hash-chained JSON line per event: `reserve_pay.blocked`,
`agent.negotiated`, `agent.gate`, `razorpay.tool` (every MCP call + arguments + result),
`agent.executed` / `agent.blocked`, `notification.sent`,
`approval.requested` / `approval.granted` / `approval.rejected`.

Every record carries `prev_hash` and `hash = SHA256(prev_hash + canonical_json(body))`
(genesis `prev_hash = 0x00…00`), so editing any historical field breaks every hash after it.
`GET /api/audit/verify` recomputes the whole chain server-side; the dashboard's *Verify chain*
button calls it live during the demo.

## Human-in-the-loop approvals

When the gate blocks a purchase, `backend/app/services/approvals.py` registers a pending
escalation (persisted to `backend/data/approvals.json`) and the merchant resolves it from the
dashboard:

- `GET  /api/approvals` — pending + resolved inbox
- `POST /api/approvals/{id}/approve` — creates a **fresh** payment link via the Razorpay MCP
  server at click time, marks the escalation approved, lands `approval.granted` in the ledger
- `POST /api/approvals/{id}/reject` — refuses; nothing is ever charged

The WhatsApp message is a notification only — authorization happens through the signed
payment link, never by replying.

Other endpoints: `/api/runs/latest` and `backend/data/last_run.json` persist the last run so a
page refresh (or backend restart) keeps state; concurrent `/api/run` calls are serialized with
an asyncio lock, making the no-double-spend guarantee demonstrable.

## Security notes

- Never guess shipping/taxes: the supplier's CartMandate locks every payment-impacting
  field, and the gate compares the exact totals.
- `user_cart_confirmation_required=false` is what enables autonomy; the gate re-checks it
  every run so a mutated intent can never silently re-enable human confirmation.
- Keys for the three roles are generated on first run under `backend/data/keys/`
  (gitignored).

## Project layout

```
backend/app/
  ap2/         AP2 mandate engine + gate verifier
  agent/       LangGraph agent + LLM wrapper
  models/      Pydantic mandate schemas
  services/    warehouse, supplier, reserve-pay, razorpay-mcp, notifications
  main.py      FastAPI app (REST + WebSocket)
  audit.py     append-only ledger
frontend/src/  React dashboard
scripts/       CLI demo
backend/tests/ pytest suite
```
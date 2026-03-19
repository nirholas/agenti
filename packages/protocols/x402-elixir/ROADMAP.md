# x402 Elixir SDK — Roadmap

> Internal roadmap. Living document — update as priorities shift.

## Current State (v0.1.0)

✅ Protocol primitives (PaymentRequired, PaymentSignature, PaymentResponse)
✅ Facilitator client (verify/settle via GenServer + Finch)
✅ Plug middleware (PaymentGate)
✅ Wallet validation (EVM + Solana)
✅ Telemetry events
✅ 99% test coverage, Dialyzer-clean
✅ Published on Hex.pm

---

## v0.2 — Protocol Extensions

**Goal:** Parity with the latest x402 spec extensions.

### Payment-Identifier (Idempotency)
- [x] `X402.Extensions.PaymentIdentifier` — encode/decode payment ID in payloads
- [x] Cache behaviour (`X402.Extensions.PaymentIdentifier.Cache`)
- [x] Default ETS adapter (no deps)
- [ ] Optional Redis adapter (via Redix)
- [ ] Plug integration — auto-deduplicate in PaymentGate
- [ ] Configurable TTL per route

### Lifecycle Hooks
- [x] `before_verify/2` — inspect/transform payment before facilitator call
- [x] `after_settle/2` — post-settlement logic (logging, webhooks, analytics)
- [x] `on_reject/2` — custom handling for failed/invalid payments
- [x] Hook behaviour + default no-op implementation
- [x] Plug option: `hooks: MyApp.PaymentHooks`

### "upto" Scheme
- [x] Encode/decode "upto" scheme in PaymentRequired
- [ ] Max-price bidding validation in PaymentSignature
- [ ] Facilitator client support for upto verification
- [ ] Tests + docs

---

## v0.3 — SIWX (Sign-In-With-X)

**Goal:** Repeat access without repayment. "Sessions for crypto."

- [ ] `X402.Extensions.SIWX` — CAIP-122 message construction
- [ ] EVM signature verification (EIP-4361 / SIWE)
- [ ] Solana signature verification
- [ ] Storage behaviour (`X402.Extensions.SIWX.Storage`)
  - [ ] ETS adapter (default)
  - [ ] Mnesia adapter (distributed)
  - [ ] Ecto adapter (bring your DB)
- [ ] Plug integration — challenge/response flow in PaymentGate
- [ ] `SIGN-IN-WITH-X` header encode/decode
- [ ] Configurable access TTL (how long a wallet stays "signed in")

---

## v0.4 — Bazaar Client (Discovery)

**Goal:** Elixir clients and AI agents can discover x402 services programmatically.

- [ ] `X402.Bazaar` — query facilitator `/list` endpoints
- [ ] Filtering by network, price range, category
- [ ] Response parsing into typed structs
- [ ] Caching layer (avoid hammering discovery endpoints)
- [ ] `X402.Bazaar.Agent` — GenServer that maintains a local service catalog
- [ ] Optional: LiveView component for browsing available services

---

## v0.5 — Client SDK (Buyer Side)

**Goal:** Make Elixir a first-class x402 buyer, not just seller.

- [ ] `X402.Client` — wraps HTTP clients (Req, Finch)
- [ ] Auto-detect 402 responses → parse requirements → prepare payment
- [ ] Pluggable wallet/signer behaviour (`X402.Client.Signer`)
- [ ] Auto-retry with payment after 402
- [ ] Support for all schemes (exact, upto)
- [ ] Transparent to caller — `X402.Client.get(url)` just works
- [ ] Telemetry events for client-side payments

---

## v1.0 — Production Ready

**Goal:** Battle-tested, fully documented, community-ready.

- [ ] LiveDashboard integration (payment metrics, settlement rates, latency)
- [ ] Rate limiting per wallet address
- [ ] Multi-facilitator support (failover + load balancing)
- [ ] Comprehensive guides:
  - [ ] "Build a paid API in 5 minutes"
  - [ ] "x402 for AI agents"
  - [ ] "Deploying x402 on Fly.io"
- [ ] Example Phoenix app (full reference implementation)
- [ ] `mix x402.gen.paywall` generator
- [ ] Security audit of crypto verification paths
- [ ] Hex v1.0 publish

---

## Moonshots

Things we might build if the ecosystem demand is there.

### Self-Hosted Facilitator → **PROMOTED: Now building as `x402_facilitator`**
- Separate private repo
- Full facilitator implementation in Elixir (Phoenix)
- Uses this library (`x402`) for all protocol types
- GenServer per payment flow (BEAM's sweet spot)

### LiveView Paywall Component
- Drop-in `<.paywall>` component for Phoenix LiveView
- WalletConnect integration
- Shows price, accepts payment, reveals content
- Zero JS framework dependencies (just LiveView)

### x402 + Oban (Background Settlements)
- Oban job for async settlement (don't block request)
- Retry logic with exponential backoff
- Dead letter queue for failed settlements
- Dashboard in Oban Web

---

## Priorities

Rough order based on impact and ecosystem gaps:

1. **v0.2** — Extensions are table stakes, every other SDK has them
2. **v0.5** — Buyer-side client is the biggest gap vs TS/Python/Go
3. **v0.3** — SIWX unlocks real-world usage patterns
4. **v0.4** — Bazaar is forward-looking, depends on ecosystem growth
5. **v1.0** — Polish pass once core features land
6. **Moonshots** — Facilitator is the big bet if we go deep

---

*Last updated: 2026-02-16*

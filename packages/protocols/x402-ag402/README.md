<p align="center">
  <h1 align="center">Ag402</h1>
  <p align="center">
    <strong>Give your AI agent a wallet. It pays for APIs automatically.</strong>
  </p>
  <p align="center">
    <a href="https://github.com/AetherCore-Dev/ag402/stargazers"><img src="https://img.shields.io/github/stars/AetherCore-Dev/ag402?style=social" alt="GitHub Stars" /></a>&nbsp;
    <a href="https://pypi.org/project/ag402-core/"><img src="https://img.shields.io/pypi/dm/ag402-core?label=downloads" alt="PyPI Downloads" /></a>&nbsp;
    <a href="https://github.com/AetherCore-Dev/ag402/actions/workflows/ci.yml"><img src="https://github.com/AetherCore-Dev/ag402/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/tests-775%2B_passing-brightgreen" alt="Tests" />
    <img src="https://img.shields.io/badge/coverage-90%25+-brightgreen" alt="Coverage" />
    <img src="https://img.shields.io/badge/security_reviews-4_rounds-blue" alt="Security Audits" />
    <img src="https://img.shields.io/badge/python-3.10%2B-blue" alt="Python" />
    <img src="https://img.shields.io/badge/node-18%2B-brightgreen" alt="Node.js" />
    <a href="https://pypi.org/project/ag402-core/"><img src="https://img.shields.io/pypi/v/ag402-core" alt="PyPI" /></a>
    <a href="https://github.com/AetherCore-Dev/ag402/blob/main/LICENSE"><img src="https://img.shields.io/github/license/AetherCore-Dev/ag402" alt="License" /></a>
    <a href="https://github.com/AetherCore-Dev/ag402/commits/main"><img src="https://img.shields.io/github/last-commit/AetherCore-Dev/ag402" alt="Last Commit" /></a>
  </p>
  <p align="center">
    <a href="https://colab.research.google.com/github/AetherCore-Dev/ag402/blob/main/examples/ag402_quickstart.ipynb"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab" /></a>
  </p>
</p>

---

**Ag402** is the payment layer for the [Coinbase x402](https://github.com/coinbase/x402) protocol. It makes AI agents pay for API calls automatically — on Solana, in USDC, with zero code changes.

```
Agent calls API → 402 Payment Required → Ag402 auto-pays USDC on Solana → 200 OK
```

> **Non-custodial. Zero telemetry. Already in production.**

<!-- TODO: Add terminal GIF demo here — record with `vhs` or `asciinema` -->
<!-- ag402 init → ag402 demo — 15 seconds, shows the full colored payment flow -->

---

## Why Ag402

### Zero friction
- Zero code changes for buyers, sellers, and MCP developers
- One command to start paying: `ag402 run -- python my_agent.py`
- One command to start selling: `ag402 serve --target ... --price ... --address ...`
- One command to install MCP tools: `ag402 install claude-code`
- No config files, no API keys, no accounts, no signup
- [Colab one-click demo](https://colab.research.google.com/github/AetherCore-Dev/ag402/blob/main/examples/ag402_quickstart.ipynb) — try it in your browser, zero install

### Open standard
- Implements [Coinbase x402](https://github.com/coinbase/x402) — the emerging HTTP payment standard
- MIT licensed, fully open source, extensible protocol layer (`open402`) with zero dependencies
- **AI-native docs** — ships with [`llms.txt`](llms.txt) so LLM agents can read the full CLI reference natively

### Battle-tested
- [Token RugCheck](https://github.com/AetherCore-Dev/token-rugcheck) — **live on Solana mainnet** with real USDC payments
- 775+ tests, 90%+ coverage, 4 rounds of internal security review (24/24 issues fixed)
- Multi-endpoint RPC failover + circuit breaker + async delivery retry

### Blazing fast
- **~0.5s** standard payment (`confirmed` finality, not 13s `finalized`)
- **~1ms** prepaid payment (local HMAC, no on-chain call)
- Zero overhead on non-402 requests — no body read, no allocation
- Connection pooling, lazy imports, SQLite WAL mode

### Security-first
- 6-layer budget protection — per-tx / per-minute / daily / circuit breaker / rollback / key redaction
- Non-custodial — private keys never leave your machine
- Seller-No-Key — sellers only need a public address, zero private key risk
- Zero telemetry — no tracking, no IP logging, no analytics
- Wallet encryption: PBKDF2 (480K iter) + AES
- CI: CodeQL + Trivy + pip-audit + Semgrep + OpenSSF Scorecard

### Universal compatibility
- Claude Code, Cursor, Claude Desktop — MCP auto-config
- OpenClaw — **native Skill** (SKILL.md + TOOLS.md + skill.py), not just MCP
- LangChain, AutoGen, CrewAI, Semantic Kernel — works automatically
- Any Python agent using `httpx` or `requests` — zero changes
- **TypeScript/Node.js agents** — `@ag402/fetch` npm package, zero dependencies

---

## Zero Code Changes. For Everyone.

| You are... | What you do | Code changes |
|:-----------|:------------|:-------------|
| **Agent user** (LangChain, CrewAI, AutoGen, any Python agent) | `pip install ag402-core && ag402 run -- python my_agent.py` | **Zero** — your agent code is untouched |
| **TypeScript/Node.js agent developer** | `npm install @ag402/fetch` — wrap `fetch()` with `createX402Fetch()` | **~2 lines** — replace `fetch` with `createX402Fetch(...)` |
| **Claude Code / Cursor user** | `ag402 install claude-code` (or `cursor`) | **Zero** — MCP tools appear automatically |
| **OpenClaw user** | `ag402 install openclaw` | **Zero** — native Skill + MCP, auto-configured |
| **API seller** (monetize your API) | `ag402 serve --target http://your-api:8000 --price 0.05 --address <Addr>` | **Zero** — reverse proxy handles everything |
| **MCP server developer** | `ag402 serve --target http://your-mcp:3000 --price 0.01 --address <Addr>` | **Zero** — wrap your existing MCP server, instant paywall |

No config files. No API keys. No accounts. Minimal code changes.

---

## Try It Now

**Python (zero code changes):**
```bash
pip install ag402-core
ag402 setup      # Interactive wizard: creates wallet, selects network, configures keys
ag402 demo       # Watch the full payment flow end-to-end
```

> For non-interactive / CI use, run `ag402 init` instead — zero prompts, auto-creates wallet with $100 test USDC.

**TypeScript/Node.js:**
```bash
npm install @ag402/fetch
```
```typescript
import { createX402Fetch, InMemoryWallet } from "@ag402/fetch";
const apiFetch = createX402Fetch({ wallet: new InMemoryWallet(100) }); // $100 budget
const res = await apiFetch("https://paid-api.example.com/data");
// 402 → auto-pays USDC → retries → 200 OK
```

**Claude Code / Cursor:**
```bash
pip install ag402-core ag402-client-mcp && ag402 install claude-code
```

**Sell your API (zero code changes):**
```bash
pip install ag402-core ag402-mcp && ag402 serve --target http://your-api:8000 --price 0.05 --address <Addr>
```

Or zero install (Python): [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/AetherCore-Dev/ag402/blob/main/examples/ag402_quickstart.ipynb)

---

## Already in Production

<table>
<tr>
<td width="55%">

### [Token RugCheck](https://github.com/AetherCore-Dev/token-rugcheck)

**Live on Solana mainnet.** AI agents pay **$0.02 USDC** per audit to detect rug pulls before purchasing tokens.

- Three-layer audit: machine verdict → LLM analysis → raw on-chain evidence
- **Seller**: `ag402 serve` — zero code changes to the audit API
- **Buyer**: `ag402_core.enable()` — agents auto-pay, zero code changes
- **Try it now**: `curl -I https://rugcheck.aethercore.dev/v1/audit/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`

</td>
<td width="45%">

```
Agent → GET /v1/audit/{token}
     ← 402 Payment Required ($0.02)
     → Ag402 pays USDC on Solana
     → Retries with tx_hash proof
     ← 200 OK + full audit report
```

</td>
</tr>
</table>

> Not a demo. Real USDC, real Solana mainnet, real users, already running.

---

## How It Works

### For Agent Users — Zero Code Changes

Your agent already uses `httpx` or `requests` under the hood. Ag402 patches them transparently:

```bash
# Option A: CLI wrapper (easiest — zero code changes)
ag402 run -- python my_agent.py

# Option B: One-liner in code
import ag402_core; ag402_core.enable()
```

That's it. Every HTTP 402 response is now intercepted → paid → retried automatically. Your agent code stays **completely untouched**.

Works with **LangChain**, **AutoGen**, **CrewAI**, **Semantic Kernel**, and any framework built on `httpx` or `requests`.

#### Framework Examples

<details>
<summary><b>LangChain</b> — tool functions call x402 APIs, no payment code needed</summary>

```python
import ag402_core
ag402_core.enable()  # one line — before any tool calls

from langchain.tools import tool
import httpx

@tool
def get_weather(city: str) -> str:
    """Get weather from a paid API. ag402 handles the 402 automatically."""
    resp = httpx.get("https://weather-api.example.com/data", params={"city": city})
    resp.raise_for_status()
    return resp.json()["summary"]

# Build your agent normally — no payment logic anywhere
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_openai import ChatOpenAI
# ... standard LangChain setup
```

Full example: [`examples/langchain_integration.py`](examples/langchain_integration.py) — start [`examples/start_local_demo.py`](examples/start_local_demo.py) first for a self-contained local demo.

</details>

<details>
<summary><b>AutoGen</b> — register tools on UserProxyAgent, ag402 patches the HTTP layer</summary>

```python
import ag402_core
ag402_core.enable()

from autogen import AssistantAgent, UserProxyAgent
import httpx

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user", human_input_mode="NEVER", ...)

@user_proxy.register_for_execution()
@assistant.register_for_llm(description="Get weather data.")
def get_weather(city: str) -> str:
    resp = httpx.get("https://weather-api.example.com/data", params={"city": city})
    return resp.json()["summary"]  # 402 was auto-paid before this line
```

Full example: [`examples/autogen_integration.py`](examples/autogen_integration.py) — start [`examples/start_local_demo.py`](examples/start_local_demo.py) first.

</details>

<details>
<summary><b>CrewAI</b> — decorate tools with @tool, crew runs with no payment code</summary>

```python
import ag402_core
ag402_core.enable()

from crewai.tools import tool
import httpx

@tool("Weather Data Tool")
def get_weather(city: str) -> str:
    """Fetch weather from a paid API."""
    resp = httpx.get("https://weather-api.example.com/data", params={"city": city})
    return f"{resp.json()['city']}: {resp.json()['temp']}°C"

# Build Agents, Tasks, Crew normally — ag402 is invisible
```

Full example: [`examples/crewai_integration.py`](examples/crewai_integration.py) — start [`examples/start_local_demo.py`](examples/start_local_demo.py) first.

</details>

### For Claude Code / Cursor / OpenClaw — One Command

```bash
pip install ag402-core ag402-client-mcp
ag402 install claude-code    # or: cursor / claude-desktop / openclaw
```

Restart your tool. Three MCP tools appear:

| MCP Tool | What It Does |
|----------|-------------|
| `fetch_with_autopay` | HTTP request → auto-pays 402 APIs |
| `wallet_status` | Check USDC balance + budget usage |
| `transaction_history` | View recent payments |

**OpenClaw** gets the deepest integration — Ag402 ships as a **native OpenClaw Skill** (`SKILL.md` + `TOOLS.md` + `skill.py`), not a wrapper. The skill registers natively in OpenClaw's skill system, with full tool definitions, prepaid support, and auto-fallback.

### For TypeScript/Node.js Developers — Two Lines

```bash
npm install @ag402/fetch
```

```typescript
import { createX402Fetch, InMemoryWallet } from "@ag402/fetch";

const apiFetch = createX402Fetch({
  wallet: new InMemoryWallet(100), // $100 budget
  config: { maxAmountPerCall: 1.00, maxTotalSpend: 50.00 },
});

const res = await apiFetch("https://paid-api.example.com/data");
// 402 Payment Required → auto-pays → retries → 200 OK
```

Swap `InMemoryWallet` with your own `Wallet` implementation and `MockPaymentProvider` with [`@ag402/solana`](https://www.npmjs.com/package/@ag402/solana) for real on-chain USDC payments. Zero runtime dependencies — Node.js 18+, Bun, Deno.

### For API Sellers — Zero Code Changes

```bash
pip install ag402-core ag402-mcp
ag402 serve --target http://localhost:8000 --price 0.05 --address <YourSolanaAddress>
```

Your existing API runs untouched behind a reverse proxy. The proxy:
- Returns **402 + x402 challenge** to unpaid requests
- **Verifies payment on-chain** (no private key needed — seller only provides a public address)
- Proxies paid requests through to your API
- Handles replay protection, rate limiting, header sanitization

**MCP server developers**: same command, same result. Wrap your MCP server, get a paywall instantly.

---

## Performance

| Metric | Value | How |
|--------|-------|-----|
| **Payment latency** | **~0.5s** | `confirmed` finality — 26x faster than `finalized` (~13s) |
| **Prepaid latency** | **~1ms** | Local HMAC-SHA256 — no on-chain call at all |
| **Non-402 overhead** | **Zero** | Checks status code only — no body read, no allocation, no latency |
| **RPC resilience** | **Multi-endpoint** | Exponential backoff → auto-failover to backup RPC → circuit breaker |
| **Delivery guarantee** | **Async retry** | Payment succeeds but upstream fails? Background worker retries with backoff |

### Prepaid System — From 500ms to 1ms

**The problem:** Standard x402 payments require an on-chain Solana transaction for every API call (~0.5s + gas fee). For high-frequency agents making hundreds of calls per hour, this adds up in both latency and cost.

**The solution:** Buy a prepaid credit pack with one on-chain payment, then use HMAC credentials for subsequent calls — **zero gas, ~1ms latency**.

```
Buy:  Agent → one Solana payment → gets HMAC-SHA256 credential (N calls / M days)
Use:  Agent → X-Prepaid-Credential header → local HMAC verify → 200 OK   ← no chain, ~1ms
```

#### 5 Prepaid Tiers

| Package | Duration | Calls | Price (USDC) | Cost per Call |
|---------|----------|-------|-------------|---------------|
| Starter | 3 days | 100 | $1.50 | $0.015 |
| Basic | 7 days | 500 | $5.00 | $0.010 |
| Pro | 30 days | 1,000 | $8.00 | $0.008 |
| Business | 365 days | 5,000 | $35.00 | $0.007 |
| Enterprise | 730 days | 10,000 | $60.00 | $0.006 |

#### How it works

1. **Buyer** purchases a prepaid pack → one Solana tx → receives HMAC credential
2. **Each API call** includes `X-Prepaid-Credential` header → server verifies HMAC locally (~1ms)
3. **No on-chain tx** needed per call → zero gas fees after initial purchase
4. **Auto-fallback** to standard x402 payment when prepaid credits are exhausted

#### Quick Start (Buyer)

```bash
# Purchase a prepaid pack from any ag402 gateway
ag402 prepaid buy https://your-gateway.example.com p3d_100

# Check your credentials
ag402 prepaid status
```

Available package IDs: `p3d_100` (Starter), `p7d_500` (Basic), `p30d_1000` (Pro), `p365d_5000` (Business), `p730d_10k` (Enterprise).

In **production mode** (real USDC), `ag402 prepaid buy` will:
1. Show the package price and seller address
2. Ask `Confirm payment? [Y/n]`
3. Broadcast the USDC on-chain automatically
4. Store the credential at `~/.ag402/prepaid_credentials.json`

If the gateway times out after payment is broadcast, your credential is not lost — retry or recover:

```bash
# Retry automatically picks up the last in-flight purchase
ag402 prepaid recover https://your-gateway.example.com

# Or provide explicit tx_hash and package_id if needed
ag402 prepaid recover https://your-gateway.example.com <tx_hash> <package_id>
```

```bash
# Manage credentials
ag402 prepaid status   # View all credentials grouped by seller (calls remaining / expiry)
ag402 prepaid purge    # Remove expired or depleted credentials
```

#### Seller Setup

```bash
# Start gateway with prepaid support
ag402 serve --target http://localhost:8000 \
            --price 0.01 \
            --address <YourSolanaAddress> \
            --prepaid-signing-key <secret-key>

# Or via environment variable
AG402_PREPAID_SIGNING_KEY=<secret-key> ag402 serve --target http://localhost:8000 --price 0.01 --address <Addr>
```

Buyers can then discover packages at `GET /prepaid/packages` and purchase at `POST /prepaid/purchase`.

#### Security

- HMAC-SHA256 signatures prevent credential forgery
- Constant-time comparison prevents timing attacks
- Credentials are scoped per buyer-seller pair
- Server-side cache (5 min TTL) for repeat verification

---

## Security — Built for Real Money

Your agent holds private keys and moves real USDC. Security is not a feature — it's the foundation.

**4 rounds of internal security review** · 24 issues found, **24 fixed** · **109 dedicated security TDD tests** · 775+ total tests · 90%+ coverage

### 6-Layer Budget Protection

| Layer | What It Does | Default |
|-------|-------------|---------|
| Per-transaction cap | Hard ceiling on single payment | **$5.00** |
| Per-minute rate limit | Dollar + count cap | **$2.00 / 5 txns** |
| Daily spend cap | Maximum daily spend | **$10.00** (ceiling: $1,000) |
| Circuit breaker | Auto-stop after consecutive failures | **3 fails → 60s cooldown** |
| Auto-rollback | Instant reversal on failed payments | Always on |
| Key redaction | Private keys scrubbed from all logs | Always on |

### Architecture Principles

| Principle | How |
|-----------|-----|
| **Non-custodial** | Private keys never leave your machine. No server. No account. |
| **Seller-No-Key** | Sellers only need a public address — zero private key risk |
| **Wallet encryption** | PBKDF2-HMAC-SHA256 (480K iterations) + Fernet/AES |
| **Zero telemetry** | No tracking, no IP logging, no analytics. Period. |
| **Replay protection** | Timestamp + nonce + persistent tx_hash dedup (SQLite) |
| **SSRF protection** | Blocks private IPs, non-HTTPS, reserved ranges |
| **Header sanitization** | Strips Cookie, X-Forwarded-For, Authorization before proxy |

### CI Pipeline (Every PR)

CodeQL · Trivy · pip-audit · Semgrep · 775+ tests · 90%+ coverage · OpenSSF Scorecard

---

## Protocol

```
HTTP/1.1 402 Payment Required
WWW-Authenticate: x402 chain="solana" token="USDC" amount="0.05" address="..."

→ Client pays on-chain, retries with:

GET /data HTTP/1.1
Authorization: x402 tx_hash="abc123..." chain="solana" payer_address="..." request_id="..."

→ Server verifies on-chain → 200 OK
```

Compatible with the [Coinbase x402](https://github.com/coinbase/x402) open payment standard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Agent (LangChain / CrewAI / AutoGen / any Python)        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ag402_core.enable()  ← monkey-patches httpx / requests  │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │ HTTP request                                   │
│                 ▼                                                │
│  ┌──────────────────────────┐    ┌────────────────────────┐     │
│  │  x402 Middleware         │───▶│  BudgetGuard (6 layers)│     │
│  │  Intercepts 402 response │    │  Circuit Breaker       │     │
│  └──────────┬───────────────┘    └────────────────────────┘     │
│             │ Pay                                                │
│             ▼                                                    │
│  ┌──────────────────────────┐    ┌────────────────────────┐     │
│  │  SolanaAdapter           │───▶│  RPC Failover          │     │
│  │  USDC transfer + verify  │    │  Exponential backoff   │     │
│  └──────────┬───────────────┘    └────────────────────────┘     │
│             │ tx_hash                                            │
│             ▼                                                    │
│  Retries with: Authorization: x402 tx_hash="..." chain="solana" │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Seller Gateway  (ag402 serve)                                  │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ 402 + x402 │  │ On-chain     │  │ Replay Guard           │  │
│  │ Challenge   │  │ Verification │  │ Rate Limiter           │  │
│  └────────────┘  └──────────────┘  │ Header Sanitization    │  │
│                                     └────────────────────────┘  │
│  → Proxies to your API (unchanged)                              │
└─────────────────────────────────────────────────────────────────┘
```

[Full architecture diagrams & state machines → docs/architecture_state.md](docs/architecture_state.md)

---

## Packages

| Package | Registry | Role |
|---------|----------|------|
| [`open402`](https://pypi.org/project/open402/) | [![PyPI](https://img.shields.io/pypi/v/open402)](https://pypi.org/project/open402/) | Protocol standard — **zero dependencies** |
| [`ag402-core`](https://pypi.org/project/ag402-core/) | [![PyPI](https://img.shields.io/pypi/v/ag402-core)](https://pypi.org/project/ag402-core/) | Payment engine + CLI + wallet (buyer) |
| [`ag402-mcp`](https://pypi.org/project/ag402-mcp/) | [![PyPI](https://img.shields.io/pypi/v/ag402-mcp)](https://pypi.org/project/ag402-mcp/) | Reverse-proxy gateway (seller) — **zero code changes** |
| [`ag402-client-mcp`](https://pypi.org/project/ag402-client-mcp/) | [![PyPI](https://img.shields.io/pypi/v/ag402-client-mcp)](https://pypi.org/project/ag402-client-mcp/) | MCP client for AI tools (buyer) |
| [`@ag402/fetch`](https://www.npmjs.com/package/@ag402/fetch) | [![npm](https://img.shields.io/npm/v/@ag402/fetch)](https://www.npmjs.com/package/@ag402/fetch) | TypeScript/Node.js buyer SDK — **zero runtime deps** |

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `ag402 init` | Non-interactive setup — for AI agents (zero prompts) |
| `ag402 setup` | Interactive wizard — for humans |
| `ag402 demo` | Full E2E payment demo |
| `ag402 run -- <cmd>` | Run any script with automatic x402 payment |
| `ag402 pay <url>` | Single paid request |
| `ag402 serve` | Start payment gateway (seller) |
| `ag402 install <tool>` | One-command MCP setup (claude-code / cursor / openclaw) |
| `ag402 status` | Dashboard: balance, budget, security |
| `ag402 balance` | Quick balance check |
| `ag402 history` | Transaction history |
| `ag402 doctor` | Environment health check |
| `ag402 upgrade` | Migrate test → production |
| `ag402 export` | Export history (JSON/CSV) |
| `ag402 prepaid buy <url> <pkg>` | Purchase a prepaid credit pack |
| `ag402 prepaid status` | View all prepaid credentials (calls left / expiry) |
| `ag402 prepaid purge` | Remove expired or depleted credentials |
| `ag402 prepaid recover <url>` | Recover a credential after gateway timeout |
| `ag402 prepaid pending` | Show any in-flight (unconfirmed) purchase |

[Full CLI reference → llms.txt](llms.txt) (AI-readable, paste into your agent's context)

---

## Documentation

| Resource | Description |
|----------|-------------|
| **[llms.txt](llms.txt)** | AI-readable CLI reference — paste into your agent's context |
| **[TypeScript SDK README](sdk/typescript/README.md)** | `@ag402/fetch` — Node.js/Bun/Deno buyer SDK |
| **[Claude Code Guide](docs/guide-claude-code.md)** | Step-by-step MCP integration |
| **[Cursor Guide](docs/guide-cursor.md)** | Step-by-step MCP integration |
| **[OpenClaw Guide](docs/guide-openclaw.md)** | Native Skill + MCP integration |
| **[Architecture](docs/architecture_state.md)** | System diagrams & state machines |
| **[x402 Protocol Spec](docs/x402_protocol_spec.md)** | Full protocol specification |
| **[OpenClaw Skill](adapters/openclaw/ag402-skill/)** | Native OpenClaw skill definition |
| **[Localnet Guide](docs/guide-localnet.md)** | Local Solana validator setup |
| **[SECURITY](SECURITY.md)** | Security policy & audit history |
| **[CHANGELOG](CHANGELOG.md)** | Version history |
| **[CONTRIBUTING](CONTRIBUTING.md)** | Contribution guide |

---

## Troubleshooting

### ag402 doctor

Run `ag402 doctor` first. It validates your environment end-to-end and prints a PASS/FAIL report with actionable fix suggestions for each issue:

- Python version and required package installation
- Solana cryptography dependencies (`solana`, `solders`, `spl-token`)
- RPC connectivity (pings your configured endpoint and any backups)
- Wallet file presence and integrity (detects corruption or missing keys)
- Budget configuration sanity (flags limits set to $0 or above the $1,000 ceiling)

```bash
ag402 doctor          # full health check
```

If `ag402 doctor` passes but you still see errors, enable verbose mode: `AG402_DEBUG=1 ag402 run -- python my_agent.py`

### Configuration priority

Ag402 resolves configuration in this order (highest priority wins):

1. **Environment variables** — e.g. `X402_DAILY_LIMIT=50`, `AG402_RPC_URL=https://...`
2. **`.env` file** — loaded from the current working directory at process start
3. **Code defaults** — the values baked into `ag402-core` itself (e.g. $10 daily limit)

Environment variables always override `.env` values. `.env` values always override code defaults. To verify what values are active, run `ag402 status` (shows resolved limits and config source) or `ag402 doctor`.

### Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ag402: command not found` | PATH not updated after `pip install` | Run `python -m ag402_core.cli` or restart your shell |
| `Wallet file not found` | Setup not completed | Run `ag402 setup` (interactive) or `ag402 init` (non-interactive) |
| `Insufficient wallet balance` | Test wallet is empty | Run `ag402 init` — auto-deposits $100 test USDC |
| `Cannot connect to Solana network` | RPC unreachable | Use `ag402 demo` (mock, no network needed) or `ag402 demo --localnet` |
| `Solana RPC timed out` | Devnet congestion | Retry, or switch to `ag402 demo --localnet` for stable local testing |
| `Incorrect wallet password` | Mistyped password | Set `AG402_UNLOCK_PASSWORD=yourpass` to skip the prompt |
| `Daily spending limit reached` | Over `X402_DAILY_LIMIT` | Run `ag402 config` to view limits; set `X402_DAILY_LIMIT=100` to increase |
| `Missing dependency: solana` | Solana deps not installed | Run `pip install 'ag402-core[crypto]'` for on-chain payments |

### Still stuck?

- `ag402 doctor` — full environment health check with actionable suggestions
- [GitHub Issues](https://github.com/AetherCore-Dev/ag402/issues) — search existing issues or file a new one
- Set `AG402_DEBUG=1` for verbose output including full stack traces

---

## Community

- [GitHub Discussions](https://github.com/AetherCore-Dev/ag402/discussions) — questions, ideas, show & tell
- [Issue Tracker](https://github.com/AetherCore-Dev/ag402/issues) — bug reports, feature requests
- [Contributing Guide](CONTRIBUTING.md) — PRs welcome, see "Good First Issues"

---

## Roadmap

| Milestone | Status | Description |
|-----------|--------|-------------|
| ✅ Solana USDC payments | **Shipped** | Standard x402 on-chain payments (~0.5s) |
| ✅ Prepaid system | **Shipped** | HMAC credentials, ~1ms, zero gas per call |
| ✅ Claude Code / Cursor / OpenClaw | **Shipped** | One-command install, native MCP support |
| ✅ 4 internal security reviews | **Shipped** | 24/24 issues fixed, 775+ tests |
| ✅ **TypeScript SDK** | **Shipped** | [`@ag402/fetch`](https://www.npmjs.com/package/@ag402/fetch) — zero-dep Node.js/Bun/Deno buyer SDK. 100 tests, dual ESM+CJS, full protocol utilities |
| ✅ **`@ag402/solana`** | **Shipped** | [`@ag402/solana`](https://www.npmjs.com/package/@ag402/solana) — real Solana USDC `PaymentProvider` for TypeScript. 17 tests, dual ESM+CJS, mainnet/devnet guards |
| 🔜 Multi-chain | Planned | Base, Polygon, Arbitrum USDC support |
| 🔜 Stripe fallback | Planned | Fiat payment fallback for non-crypto users |
| 🔜 Dashboard | Planned | Web UI for sellers — revenue, analytics, API keys |

---

## License

[MIT](LICENSE) — Open source, free forever.

---
name: ag402
description: "AI Agent Payment Protocol — auto-pay x402 APIs with Solana USDC via CLI. Use when an agent needs to call paid APIs (HTTP 402), check wallet balance, view transaction history, or run a payment gateway. Invoke commands via exec."
metadata: {"openclaw": {"requires": {"bins": ["ag402"]}}}
---

# ag402 — AI Agent Payment Protocol

Use `exec` to run `ag402` CLI commands. Handles autonomous USDC payments on Solana via the x402 protocol.

## Workflow: First-Time Setup

1. **Install**: `pip install ag402-core`
2. **Initialize test wallet**: `ag402 init` — creates wallet with $100 test USDC, no prompts
3. **Verify**: `ag402 balance` — expect `$100.00`
4. **Health check**: `ag402 doctor` — confirms RPC connectivity and wallet status

## Workflow: Pay for an API Call

1. **Make request**: `ag402 pay <url>`
2. ag402 detects HTTP 402 → negotiates x402 challenge → pays USDC → retries → returns response
3. **Verify spend**: `ag402 history --limit 1` to confirm transaction

```bash
# Simple GET
ag402 pay https://api.example.com/premium/data

# POST with data and max spend
ag402 pay https://api.example.com/generate \
  --method POST \
  --data '{"prompt": "hello"}' \
  --amount 2.50
```

## Commands

| Command | Description |
|---------|-------------|
| `ag402 init` | Create test wallet ($100 USDC) |
| `ag402 pay <url>` | Pay-and-call an x402 API |
| `ag402 balance` | Check wallet balance |
| `ag402 history [--limit N] [--type payment]` | View transactions |
| `ag402 status` | Full status dashboard |
| `ag402 doctor` | Health check (RPC, wallet, network) |
| `ag402 serve --target <url> --price <amt> --port <p>` | Start payment gateway (seller mode) |
| `ag402 env set <KEY> <value>` | Configure persistent settings |

## Production Mode

Switch from test to real on-chain payments:

```bash
ag402 env set X402_MODE production
ag402 env set X402_NETWORK mainnet
ag402 env set SOLANA_RPC_URL <your_rpc_url>
```

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_MODE` | `test` or `production` | Must be set explicitly |
| `X402_NETWORK` | `mainnet`, `devnet`, `localnet` | `devnet` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Public devnet |
| `AG402_UNLOCK_PASSWORD` | Wallet unlock password | — |
| `X402_DAILY_LIMIT` | Max daily spend (USD) | `10` |
| `X402_PER_MINUTE_LIMIT` | Max per-minute spend (USD) | `2` |

Budget limits (`X402_DAILY_LIMIT`, `X402_PER_MINUTE_LIMIT`) prevent runaway spending. Always test with `ag402 init` before switching to production.

## Error Recovery

| Error | Fix |
|-------|-----|
| `ag402: command not found` | `pip install ag402-core` |
| `Insufficient balance` | `ag402 init` (test) or deposit real USDC (production) |
| `Non-standard 402 response` | Server is not x402-compatible — check server docs |
| `On-chain payment failed` | Run `ag402 doctor` to diagnose RPC/network issues |
| `Request timed out` | Retry; check RPC connectivity with `ag402 doctor` |

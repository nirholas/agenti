---
name: ag402
description: "AI Agent Payment Protocol — auto-pay x402 APIs with Solana USDC. Commands: setup, pay <url>, balance, history, doctor, serve. Use exec to run CLI commands."
metadata: {"openclaw": {"requires": {"bins": ["ag402"]}}}
---

# ag402 — AI Agent Payment Protocol

Use `exec` to run `ag402` CLI commands. This skill provides autonomous payment
capabilities for AI agents via the x402 protocol on Solana (USDC).

## When to Use

- Agent needs to call a paid API (HTTP 402 response)
- Agent needs to check wallet balance or transaction history
- Agent needs to set up payment infrastructure
- Agent needs to start/stop a payment gateway

## Quick Start

### 1. Check if ag402 is installed

```bash
ag402 --version
```

If not installed:

```bash
pip install ag402-core
```

### 2. Initialize wallet (non-interactive, agent-safe)

```bash
ag402 init
```

Creates a test wallet with $100 USDC. No prompts, no human input needed.

### 3. Verify setup

```bash
ag402 balance
```

Expected: `$100.00` test balance.

## Commands

### Pay for an API call

```bash
ag402 pay <url>
```

Sends a request to `<url>`. If the server returns `402 Payment Required` with
an x402 challenge, ag402 automatically pays and retries. Returns the API response.

Example:

```bash
ag402 pay https://api.example.com/premium/data
```

With options:

```bash
ag402 pay https://api.example.com/generate \
  --method POST \
  --data '{"prompt": "hello"}' \
  --amount 2.50
```

### Check balance

```bash
ag402 balance
```

### View transaction history

```bash
ag402 history
ag402 history --limit 20 --type payment
```

### Full status dashboard

```bash
ag402 status
```

### Health check

```bash
ag402 doctor
```

### Start payment gateway (seller mode)

```bash
ag402 serve --target http://localhost:8000 --price 0.01 --port 4020 &
```

### Stop gateway

Kill the background process or use Ctrl+C in the terminal.

## Production Mode

For real on-chain payments, set environment variables before running:

```bash
X402_MODE=production \
X402_NETWORK=mainnet \
SOLANA_RPC_URL=<your_rpc_url> \
AG402_UNLOCK_PASSWORD=<wallet_password> \
  ag402 pay <url>
```

Or configure persistently:

```bash
ag402 env set X402_MODE production
ag402 env set X402_NETWORK mainnet
ag402 env set SOLANA_RPC_URL <your_rpc_url>
```

Then run `ag402 pay <url>` normally.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_MODE` | `test` or `production` | Must be set explicitly |
| `X402_NETWORK` | `mainnet`, `devnet`, `localnet` | `devnet` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Public devnet |
| `AG402_UNLOCK_PASSWORD` | Wallet unlock password | — |
| `X402_DAILY_LIMIT` | Max spend per day (USD) | `10` |
| `X402_PER_MINUTE_LIMIT` | Max spend per minute (USD) | `2` |

## Security

1. **Budget limits** — daily and per-minute caps prevent runaway spending
2. **Test mode first** — always test with virtual funds before production
3. **Wallet isolation** — use a dedicated payment wallet, not your main wallet
4. **Transaction audit** — all payments logged via `ag402 history`

## Error Recovery

| Error | Fix |
|-------|-----|
| `ag402: command not found` | `pip install ag402-core` |
| `Insufficient balance` | `ag402 init` (test) or deposit real USDC (production) |
| `Non-standard 402 response` | Server is not x402-compatible |
| `On-chain payment failed` | Check network: `ag402 doctor` |
| `Request timed out` | Retry; check RPC connectivity |

## Architecture

```
Agent (exec) → ag402 CLI → x402 protocol → Solana USDC payment → API response
```

The agent uses `exec` to invoke `ag402 pay <url>`. The CLI handles the full
402 → negotiate → pay → retry → return flow transparently.

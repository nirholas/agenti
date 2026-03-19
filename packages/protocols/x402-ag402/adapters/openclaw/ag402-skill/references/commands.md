# ag402 Commands Reference

CLI commands for wallet management and payment operations.

## Table of Contents

- [Wallet Commands](#wallet-commands)
- [Payment Commands](#payment-commands)
- [Payment Security](#payment-security)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)

---

## Wallet Commands

### ag402 balance

Check current wallet USDC balance.

```bash
ag402 balance
```

### ag402 status

Full wallet and budget dashboard.

```bash
ag402 status
```

**Output fields:**

| Field | Description |
|-------|-------------|
| `balance` | Current USDC balance |
| `daily_budget` | Daily spending limit |
| `daily_spent` | Amount spent today |
| `remaining` | Available budget remaining |

---

### ag402 init

Non-interactive wallet setup — creates test wallet with $100 USDC.

```bash
ag402 init
```

Safe for autonomous agents. No prompts, no human input needed.

### ag402 setup

Interactive setup wizard. Requires human input (password, confirmations).

```bash
ag402 setup
```

---

### ag402 history

View transaction history.

```bash
ag402 history [options]
```

**Options:**

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--limit` | `-l` | number | 10 | Number of records |
| `--type` | `-t` | string | all | Filter: `all`, `payment`, `deposit`, `refund` |
| `--days` | `-d` | number | 7 | Days to look back |

**Examples:**

```bash
ag402 history
ag402 history --limit 20
ag402 history --type payment --days 30
```

---

## Payment Commands

### ag402 pay

Make a paid API call with automatic x402 payment.

```bash
ag402 pay <url> [options]
```

**Options:**

| Option | Short | Type | Required | Default | Description |
|--------|-------|------|----------|---------|-------------|
| `url` | - | string | Yes | - | Target API URL |
| `--amount` | `-a` | number | No | auto-detect | Payment amount (USDC) |
| `--confirm` | `-y` | flag | No | false | Force confirm large payments |
| `--header` | `-H` | string | No | - | Custom header ("Key: Value") |
| `--method` | `-m` | string | No | GET | HTTP method |
| `--data` | `-d` | string | No | - | Request body (JSON) |

**Examples:**

```bash
# Auto-detect price and pay
ag402 pay https://api.example.com/premium

# Specify payment amount
ag402 pay https://api.example.com/premium --amount 5.00

# POST request
ag402 pay https://api.example.com/generate \
  --method POST \
  --data '{"prompt":"hello"}'
```

---

## Payment Security

### Auto-pay Rules

| Amount | Behavior | Confirmation |
|--------|----------|--------------|
| < $10.00 | Auto-pay | None required |
| >= $10.00 | Requires confirmation | Use `--confirm` flag |

### Budget Checks

Every payment automatically checks:

1. **Balance check** — sufficient wallet balance
2. **Budget check** — within daily spending limit
3. **Anomaly detection** — unusually large or frequent payments

**Default limits:**

- Daily budget: $10 USDC (configurable via `X402_DAILY_LIMIT`)
- Per-minute limit: $2 USDC (configurable via `X402_PER_MINUTE_LIMIT`)
- Per-minute count: 5 transactions (configurable via `X402_PER_MINUTE_COUNT`)

---

## Usage Examples

### Complete Payment Flow

```bash
# 1. Check wallet status
ag402 status

# 2. If balance is low, initialize with test funds
ag402 init

# 3. Make a paid API call
ag402 pay https://api.example.com/data

# 4. Check transaction history
ag402 history
```

### Production Mode

```bash
# Set environment for production
ag402 env set X402_MODE production
ag402 env set X402_NETWORK mainnet
ag402 env set SOLANA_RPC_URL https://your-rpc-url.com

# Make payment
ag402 pay https://api.example.com/premium
```

---

## Error Handling

### Common Errors

| Error | Description | Fix |
|-------|-------------|-----|
| `ag402: command not found` | Not installed | `pip install ag402-core` |
| `Insufficient balance` | Wallet empty | `ag402 init` (test) or deposit USDC |
| `Exceeds budget` | Over daily limit | Wait for reset or adjust limit |
| `Payment failed` | Chain/network error | Check network, retry |
| `Non-standard 402` | Not x402-compatible | Server doesn't support x402 |
| `Request timed out` | Slow RPC/gateway | Retry; run `ag402 doctor` |

---

## Configuration

Use `ag402 env set` to configure. Values stored in `~/.ag402/.env`.

```bash
ag402 env set X402_DAILY_LIMIT 10
ag402 env set X402_MODE test
ag402 env show
```

---

## Related Commands

- `ag402 doctor` — Full environment health check
- `ag402 config` — View safety limits
- `ag402 serve` — Start payment gateway (seller mode)
- `ag402 install <tool>` — MCP setup for AI tools

## Prepaid Commands

### ag402 prepaid status

Show all prepaid credentials and remaining calls.

```bash
ag402 prepaid status
```

### ag402 prepaid buy <gateway_url> <package_id>

Purchase a prepaid package from a gateway.

```bash
ag402 prepaid buy http://gateway.example.com p30d_1000
# With explicit buyer address:
ag402 prepaid buy http://gateway.example.com p30d_1000 --buyer-address <wallet_addr>
```

### ag402 prepaid pending

Show any in-flight purchase waiting for recovery.

```bash
ag402 prepaid pending
```

### ag402 prepaid recover <gateway_url> [tx_hash] [package_id]

Recover a credential after a failed or timed-out `buy`.

```bash
# Auto-detect from last buy:
ag402 prepaid recover http://gateway.example.com
# Explicit:
ag402 prepaid recover http://gateway.example.com <tx_hash> <package_id>
```

### ag402 prepaid purge

Remove expired and depleted credentials.

```bash
ag402 prepaid purge
```

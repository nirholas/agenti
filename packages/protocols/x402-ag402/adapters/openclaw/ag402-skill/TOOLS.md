# ag402 CLI Reference

Commands available via `exec` for OpenClaw agents.

## Payment Commands

### `ag402 pay <url>`

Make a paid API call. Automatically handles x402 payment negotiation.

```bash
ag402 pay https://api.example.com/data
```

Options:
- `--method METHOD` — HTTP method (GET, POST, PUT, DELETE). Default: GET
- `--data JSON` — Request body (JSON string)
- `--amount N` — Max payment amount in USDC
- `--header "Key: Value"` — Custom request header (repeatable)
- `--confirm` — Skip confirmation for large payments

Output: API response body (JSON or text).

### `ag402 balance`

Check wallet USDC balance.

```bash
ag402 balance
```

Output: Current balance in USDC.

### `ag402 status`

Full wallet and budget dashboard.

```bash
ag402 status
```

Output: Balance, daily spend, daily limit, transaction count.

### `ag402 history`

View transaction history.

```bash
ag402 history
ag402 history --limit 20 --type payment --days 7
```

Options:
- `--limit N` — Number of records (default: 10)
- `--type TYPE` — Filter: `all`, `payment`, `deposit`, `refund`
- `--days N` — Days to look back (default: 7)

### `ag402 tx <id>`

View details of a specific transaction.

```bash
ag402 tx abc123
```

## Setup Commands

### `ag402 init`

Non-interactive setup — creates test wallet with $100 USDC. Safe for autonomous agents.

```bash
ag402 init
```

### `ag402 setup`

Interactive setup wizard. Requires human input (password, confirmations).

```bash
ag402 setup
```

### `ag402 doctor`

Run full health check — config, wallet, network, gateway.

```bash
ag402 doctor
```

## Configuration Commands

### `ag402 env show`

Show current configuration values.

```bash
ag402 env show
```

### `ag402 env set <key> <value>`

Set a configuration value.

```bash
ag402 env set X402_DAILY_LIMIT 10
ag402 env set X402_MODE test
```

### `ag402 config`

View safety limits and current settings.

```bash
ag402 config
```

## Gateway Commands (Seller Mode)

### `ag402 serve`

Start a payment gateway (reverse proxy).

```bash
ag402 serve --target http://localhost:8000 --price 0.01 --port 4020
```

Options:
- `--target URL` — Backend API to proxy
- `--price N` — Price per request in USDC
- `--address ADDR` — Receiving wallet address
- `--port N` — Gateway port (default: 4020)
- `--host ADDR` — Bind address (default: 0.0.0.0)

### `ag402 install <tool>`

One-command MCP setup for AI tools.

```bash
ag402 install claude-code
ag402 install cursor
ag402 install openclaw
```

## Error Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Insufficient balance |
| 3 | Payment failed (network/chain) |
| 4 | Invalid configuration |

# Cursor Integration Guide

Complete step-by-step tutorial for using Ag402 with Cursor.

---

## Prerequisites

```bash
pip install ag402-core ag402-client-mcp
ag402 setup        # Interactive wizard — set wallet password, get test funds
```

---

## Step 1: One-Command Install

```bash
ag402 install cursor
```

This auto-writes the MCP configuration to `.cursor/mcp.json` in your current project.

For global installation (all projects):

```bash
ag402 install cursor --global
```

**Verify installation**:

```bash
cat .cursor/mcp.json
```

You should see:

```json
{
  "mcpServers": {
    "ag402": {
      "command": "/path/to/python",
      "args": ["-m", "ag402_client_mcp.server"]
    }
  }
}
```

---

## Step 2: Restart Cursor

After installing, **restart Cursor** or go to **Settings → MCP** and click "Reload" to load the new configuration.

In the MCP panel, you should see **ag402** listed with these tools:
- `fetch_with_autopay` — Access any x402 paid API with automatic payment
- `wallet_status` — Check wallet balance
- `transaction_history` — View payment history

---

## Step 3: Verify It Works

In Cursor's AI chat (Cmd+K or Ctrl+K), ask:

> "Check my Ag402 wallet balance"

Cursor will call the `wallet_status` tool and show your balance.

---

## Step 4: Full Demo — Paid API Access

### Terminal: Start the seller gateway

```bash
ag402 serve
```

This starts a payment gateway on `http://127.0.0.1:4020/` with a built-in demo API.

### In Cursor: Access the paid API

#### Prompt 1: Basic paid API call

> "Use fetch_with_autopay to GET http://127.0.0.1:4020/weather?city=Tokyo"

Cursor will:
1. Call `fetch_with_autopay` with the URL
2. Ag402 handles the 402 → auto-pay → retry flow
3. Returns the weather data

#### Prompt 2: Check transaction history

> "Show my Ag402 transaction history"

#### Prompt 3: Multiple calls

> "Fetch weather data for 3 different cities from http://127.0.0.1:4020/weather using fetch_with_autopay"

#### Prompt 4: Balance tracking

> "Check my balance, fetch from http://127.0.0.1:4020/, then show updated balance"

---

## Step 5 (Optional): Local Solana Validator

For a fully on-chain experience without network dependencies:

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Terminal 1: Start local validator
solana-test-validator --reset

# Terminal 2: Start gateway in localnet mode
ag402 serve --localnet

# In Cursor: same prompts as above
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| ag402 not in MCP panel | Config not written | Run `ag402 install cursor`, restart Cursor |
| "ag402-client-mcp not installed" | Package missing | `pip install ag402-client-mcp` |
| "Insufficient balance" | Wallet empty | `ag402 setup` to add test funds |
| "Cannot connect" | Gateway not running | Start `ag402 serve` in another terminal |
| Connection timeout on devnet | Network instability | Use `ag402 demo --localnet` for local testing |

### Manual Configuration

If `ag402 install` doesn't work, create `.cursor/mcp.json` manually:

```json
{
  "mcpServers": {
    "ag402": {
      "command": "python",
      "args": ["-m", "ag402_client_mcp.server"]
    }
  }
}
```

---

## How It Works

```
Cursor AI Chat → fetch_with_autopay("http://127.0.0.1:4020/weather?city=Tokyo")
    ↓
ag402-client-mcp MCP Server (stdio transport)
    ↓
GET request → 402 Payment Required → auto-pay → 200 OK + data
    ↓
Returns weather data to Cursor
```

The payment flow is fully transparent — Cursor just sees the final data.

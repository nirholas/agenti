# Claude Code Integration Guide

Complete step-by-step tutorial for using Ag402 with Claude Code.

---

## Prerequisites

```bash
pip install ag402-core ag402-client-mcp
ag402 setup        # Interactive wizard — set wallet password, get test funds
```

---

## Step 1: One-Command Install

```bash
ag402 install claude-code
```

This auto-writes the MCP configuration to `.claude/settings.local.json`.

**Verify installation**: Check that the file was created:

```bash
cat .claude/settings.local.json
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

## Step 2: Restart Claude Code

After installing, **restart Claude Code** (or reload the MCP configuration) for the new tools to appear.

You should now see these MCP tools available:
- `fetch_with_autopay` — Access any x402 paid API with automatic payment
- `wallet_status` — Check your Ag402 wallet balance
- `transaction_history` — View past payment transactions

---

## Step 3: Verify It Works

Ask Claude Code:

> "Check my Ag402 wallet balance"

Claude Code will call the `wallet_status` tool and display your balance.

---

## Step 4: Full Demo — Paid API Access

### Terminal 1: Start the seller gateway

```bash
ag402 serve
```

This starts a payment gateway on `http://127.0.0.1:4020/` with a built-in demo API.

### In Claude Code: Access the paid API

Try these prompts:

#### Prompt 1: Basic paid API call

> "Use fetch_with_autopay to access http://127.0.0.1:4020/weather?city=Tokyo"

Claude Code will:
1. Call `fetch_with_autopay` with the URL
2. Receive a 402 Payment Required response
3. Automatically pay $0.02 USDC (test funds)
4. Retry the request with payment proof
5. Return the weather data to you

#### Prompt 2: Check transaction history

> "Show my Ag402 transaction history"

#### Prompt 3: Multiple API calls

> "Fetch weather data for Tokyo, New York, and London from http://127.0.0.1:4020/weather using fetch_with_autopay"

#### Prompt 4: Budget awareness

> "Check my Ag402 wallet balance, then fetch data from http://127.0.0.1:4020/ and show me the updated balance"

#### Prompt 5: Explore the protocol

> "Explain what happened during the last fetch_with_autopay call — what HTTP status codes were involved?"

---

## Step 5 (Optional): Local Solana Validator

For a fully on-chain experience without network dependencies:

```bash
# Install Solana CLI (if not already installed)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Terminal 1: Start local validator
solana-test-validator --reset

# Terminal 2: Start gateway in localnet mode
ag402 serve --localnet

# In Claude Code: same prompts as above
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| MCP tools not appearing | Config not written | Run `ag402 install claude-code` again, then restart Claude Code |
| "ag402-client-mcp not installed" | Package missing | `pip install ag402-client-mcp` |
| "Insufficient balance" | Wallet empty | `ag402 setup` to add test funds |
| "Cannot connect" | Gateway not running | Start `ag402 serve` in another terminal |
| Connection timeout on devnet | Network instability | Use `ag402 demo --localnet` for local testing |

### Manual Configuration

If `ag402 install` doesn't work, manually add to `.claude/settings.local.json`:

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

## What's Happening Under the Hood

```
Claude Code → fetch_with_autopay("http://127.0.0.1:4020/weather?city=Tokyo")
    ↓
MCP Server (ag402-client-mcp) receives the tool call
    ↓
Sends GET request → receives 402 Payment Required
    ↓
Parses x402 challenge (price: $0.02, chain: solana, token: USDC)
    ↓
Budget check passes → deducts from wallet → on-chain transfer
    ↓
Retries request with Authorization: x402 proof header
    ↓
Receives 200 OK + weather data → returns to Claude Code
```

The entire payment flow is **transparent** to Claude Code — it just sees the final data.

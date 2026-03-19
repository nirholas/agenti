# OpenClaw Integration Guide

Complete step-by-step tutorial for using Ag402 with OpenClaw.

There are **two integration modes**:

- **Mode A: Native Skill (exec)** — OpenClaw loads the ag402 skill and uses `exec` to run CLI commands. Simplest setup, no MCP needed.
- **Mode B: MCP Bridge** — OpenClaw connects to the ag402 MCP server via mcporter for tool-based integration (`fetch_with_autopay`, `wallet_status`, etc.).

Both modes provide the same payment capabilities. Choose Mode A for simplicity, Mode B if you want structured tool calls.

---

## Mode A: Native Skill (exec) — Recommended

### Prerequisites

```bash
pip install ag402-core
ag402 init          # Non-interactive — creates test wallet with $100 USDC
```

### Install the Skill

Copy the `adapters/openclaw/ag402-skill/` directory to your OpenClaw skills folder, or point OpenClaw to it.

The skill requires the `ag402` binary on PATH (declared in `metadata.openclaw.requires.bins`).

### Usage

In OpenClaw, the agent uses `exec` to run ag402 commands:

```bash
ag402 pay https://api.example.com/data
ag402 balance
ag402 history
```

See `adapters/openclaw/ag402-skill/SKILL.md` for full command reference.

---

## Mode B: MCP Bridge (mcporter)

### Prerequisites

```bash
# 1. Install Ag402
pip install ag402-core ag402-client-mcp
ag402 setup        # Interactive wizard — set wallet password, get test funds

# 2. Install mcporter (required for OpenClaw MCP bridge)
npm install -g mcporter
```

Verify mcporter is installed:

```bash
mcporter --version
```

### Step 1: One-Command Install

```bash
ag402 install openclaw
```

This runs `mcporter config add ag402 ...` to register the Ag402 MCP server with OpenClaw.

**Verify installation**:

```bash
mcporter list ag402 --schema
```

You should see the Ag402 tools listed:
- `fetch_with_autopay`
- `wallet_status`
- `transaction_history`

---

### Step 2: Restart OpenClaw

After installing, **restart OpenClaw** for the new tools to take effect.

---

### Step 3: Verify It Works

In OpenClaw, ask:

> "Check my Ag402 wallet balance"

OpenClaw will invoke the `wallet_status` tool and display your balance and budget info.

---

### Step 4: Full Demo — Paid API Access

#### Terminal: Start the seller gateway

```bash
ag402 serve
```

This starts a payment gateway on `http://127.0.0.1:4020/` with a built-in demo API.

### In OpenClaw: Access the paid API

**Prompt 1: Basic paid API call**

> "Use fetch_with_autopay to access http://127.0.0.1:4020/weather?city=Tokyo"

OpenClaw will:
1. Call `fetch_with_autopay` with the URL
2. Ag402 auto-detects the 402 response
3. Automatically pays $0.02 USDC (test funds)
4. Retries with payment proof
5. Returns the weather data

**Prompt 2: Check what happened**

> "Show my Ag402 transaction history"

**Prompt 3: Multiple cities**

> "Fetch weather for Tokyo, Paris, and Sydney from http://127.0.0.1:4020/weather"

**Prompt 4: Full workflow**

> "Check my balance, call the paid API at http://127.0.0.1:4020/, then show me how much was spent"

---

### Step 5 (Optional): Local Solana Validator

For a fully on-chain experience without network dependencies:

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Terminal 1: Start local validator
solana-test-validator --reset

# Terminal 2: Start gateway in localnet mode
ag402 serve --localnet

# In OpenClaw: same prompts as above
```

---

## Troubleshooting

### Mode A (exec) Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ag402: command not found` | Not installed | `pip install ag402-core` |
| "Insufficient balance" | Wallet empty | `ag402 init` to add test funds |
| "Cannot connect" | Gateway not running | Start `ag402 serve` in another terminal |

### Mode B (MCP) Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "mcporter not found" | mcporter not installed | `npm install -g mcporter` |
| Tools not appearing | Registration failed | Run `ag402 install openclaw` again, restart OpenClaw |
| "ag402-client-mcp not installed" | Package missing | `pip install ag402-client-mcp` |

### Manual Configuration

If `ag402 install` doesn't work, run the mcporter command directly:

```bash
mcporter config add ag402 \
  --command python \
  --arg -m --arg ag402_client_mcp.server \
  --scope home
```

Verify:

```bash
mcporter list ag402 --schema
```

---

## How It Works

### Mode A (exec)

```
OpenClaw Agent → exec("ag402 pay https://api.example.com/data")
    ↓
ag402 CLI → GET request → 402 Payment Required
    ↓
Parse x402 challenge → budget check → on-chain USDC transfer
    ↓
Retry with proof → 200 OK + data → return to agent
```

### Mode B (MCP)

```
OpenClaw → (mcporter bridge) → ag402-client-mcp MCP Server
    ↓
fetch_with_autopay("http://127.0.0.1:4020/weather?city=Tokyo")
    ↓
GET request → 402 Payment Required
    ↓
Parse x402 challenge → budget check → on-chain USDC transfer
    ↓
Retry with proof → 200 OK + data → return to OpenClaw
```

OpenClaw uses **mcporter** as a bridge to communicate with the Ag402 MCP server via stdio transport. The payment flow is identical to Claude Code and Cursor.

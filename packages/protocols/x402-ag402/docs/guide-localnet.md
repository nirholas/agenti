# Local Solana Validator Guide

Run the full Ag402 payment flow on a **local Solana validator** — no network dependency, no devnet instability, real on-chain transactions.

---

## Why Local Validator?

| Feature | Mock Mode | Devnet | **Localnet** |
|---------|-----------|--------|------------|
| Speed | Instant | 2-10s | ~1s |
| Stability | 100% | Variable | 100% |
| Real on-chain TX | ✗ | ✓ | **✓** |
| Explorer link | ✗ | ✓ | **✓** (local) |
| Network required | ✗ | ✓ | **✗** |
| Cost | Free | Free | **Free** |

---

## Prerequisites

### 1. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

Verify:

```bash
solana --version
solana-test-validator --version
```

### 2. Install Ag402

```bash
pip install 'ag402-core[crypto]'    # Includes solana-py + solders
ag402 setup
```

---

## Quick Start

### Step 1: Start Local Validator

```bash
solana-test-validator --reset
```

This starts a Solana validator at `http://127.0.0.1:8899`. Keep this terminal open.

### Step 2: Run Localnet Demo

```bash
ag402 demo --localnet
```

This will:
1. Connect to the local validator
2. Create test keypairs (buyer + seller)
3. Airdrop SOL for transaction fees
4. Create a test USDC token mint
5. Mint 1000 test USDC to buyer
6. Execute a **real on-chain** SPL Token transfer
7. Show the transaction hash (viewable in Solana Explorer)

### Step 3: Verify Transaction

The demo will output a transaction hash like:

```
TX Hash: 5K4j...abc123
```

You can view it in a local explorer or via Solana CLI:

```bash
solana confirm <tx_hash> --url http://127.0.0.1:8899
```

---

## Full Gateway Experience (Localnet)

### Terminal 1: Start validator

```bash
solana-test-validator --reset
```

### Terminal 2: Start gateway

```bash
ag402 serve --localnet
```

### Terminal 3: Buyer view

```bash
ag402 pay http://127.0.0.1:4020/
```

This runs the full 6-step x402 protocol with **real on-chain transactions** on your local validator.

---

## With Claude Code / Cursor / OpenClaw

```bash
# Terminal 1: Start validator
solana-test-validator --reset

# Terminal 2: Start localnet gateway
ag402 serve --localnet

# In your AI tool, use the same prompts:
# "Use fetch_with_autopay to access http://127.0.0.1:4020/weather?city=Tokyo"
```

---

## Demo Modes Reference

| Mode | Command | Description |
|------|---------|-------------|
| **mock** (default) | `ag402 demo` | Simulated payments, no chain interaction |
| **localnet** | `ag402 demo --localnet` | Real on-chain via `solana-test-validator` |
| **devnet** | `ag402 demo --devnet` | Real on-chain via Solana devnet |

---

## Health Check

Run the Ag402 doctor to verify your localnet setup:

```bash
ag402 doctor
```

It will check:
- ✓ Solana CLI installed
- ✓ `solana-test-validator` available
- ✓ Validator running on port 8899
- ✓ Solana dependencies (solana-py, solders) installed

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "solana-test-validator not found" | Solana CLI not installed | See Prerequisites above |
| "Cannot connect to 127.0.0.1:8899" | Validator not running | Run `solana-test-validator --reset` |
| "Solana dependencies not installed" | Missing packages | `pip install 'ag402-core[crypto]'` |
| "Airdrop failed" | Validator issue | Restart with `solana-test-validator --reset` |
| Demo hangs | Port conflict | Check port 8899 is free: `lsof -i :8899` |

---

## How Localnet Setup Works

```
ag402 demo --localnet
    ↓
1. Connect to solana-test-validator (http://127.0.0.1:8899)
2. Generate buyer + seller keypairs
3. Airdrop 100 SOL to buyer (for tx fees)
4. Airdrop 10 SOL to seller
5. Create SPL Token mint (6 decimals, USDC-like)
6. Create buyer ATA + mint 1000 test USDC
7. Execute SPL Token transfer (buyer → seller)
8. Show real tx_hash + balance changes
```

All of this runs locally with zero network dependency.

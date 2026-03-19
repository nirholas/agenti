# ag402 OpenClaw Integration Guide

This directory contains additional documentation for integrating ag402 with OpenClaw.

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Integration Steps](#integration-steps)
- [Security](#security)

## Overview

The ag402 skill enables OpenClaw agents to make autonomous payments for API calls using the x402 payment protocol on Solana (USDC).

OpenClaw skills are markdown instruction files injected into the agent's system prompt. The agent uses its native `exec` tool to run `ag402` CLI commands.

## Architecture

```
OpenClaw Agent
      │
      ▼ (exec)
ag402 CLI
      │
      ▼
ag402 Core (protocol logic)
      │
      ▼
x402 Protocol (HTTP 402 → pay → retry)
      │
      ▼
Solana/USDC (on-chain settlement)
```

## Integration Steps

### 1. Install ag402

```bash
pip install ag402-core
```

### 2. Setup Wallet

For autonomous agents (non-interactive):

```bash
ag402 init
```

For interactive setup (human present):

```bash
ag402 setup
```

### 3. Install the Skill

Copy the `ag402-skill/` directory to your OpenClaw skills folder. The skill requires the `ag402` binary on PATH (declared via `metadata.openclaw.requires.bins`).

### 4. Verify Integration

In OpenClaw, ask the agent to check the wallet:

```bash
ag402 balance
```

Then test a payment:

```bash
ag402 pay https://api.example.com/data
```

## Security

### Best Practices

1. **Dedicated Payment Wallet** — Don't use your main wallet
2. **Spending Limits** — Configure daily and per-minute caps
3. **Test Mode First** — Always test with virtual funds before production
4. **Audit Trail** — Review transactions with `ag402 history`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_MODE` | `test` or `production` | Must be set explicitly |
| `X402_NETWORK` | `mainnet`, `devnet`, `localnet` | `devnet` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Public devnet |
| `X402_DAILY_LIMIT` | Max spend per day (USD) | `10` |

## Troubleshooting

### Common Issues

1. **`ag402: command not found`**
   - Install: `pip install ag402-core`

2. **Insufficient Balance**
   - Check balance: `ag402 balance`
   - Fund wallet: `ag402 init` (test mode)

3. **Transaction Failed**
   - Verify network: `ag402 doctor`
   - Check Solana RPC status

4. **Wallet Not Found**
   - Run `ag402 init` to initialize

## Examples

### Basic Payment Flow

```bash
# Check balance
ag402 balance

# Make a paid API call
ag402 pay https://api.example.com/data

# Check transaction history
ag402 history
```

### Production Mode

```bash
# Configure for production
ag402 env set X402_MODE production
ag402 env set X402_NETWORK mainnet
ag402 env set SOLANA_RPC_URL https://your-rpc-url.com

# Make payment
ag402 pay https://api.example.com/premium
```

## Resources

- [ag402 Main README](../../README.md)
- [Protocol Documentation](../../docs/)
- [SKILL.md](../SKILL.md) — Full command reference
- [Solana Docs](https://docs.solana.com/)

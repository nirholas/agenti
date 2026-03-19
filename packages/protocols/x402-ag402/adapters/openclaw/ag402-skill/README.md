# ag402 OpenClaw Skill

Integrates ag402 AI Agent Payment Protocol with OpenClaw.

## How It Works

This skill is a markdown instruction file (`SKILL.md`) that gets injected into the OpenClaw agent's system prompt. The agent uses its native `exec` tool to run `ag402` CLI commands. There is no Python API — the agent runs CLI commands directly.

## Quick Start

### Prerequisites

```bash
pip install ag402-core
ag402 init          # Non-interactive — creates test wallet with $100 USDC
```

### Install the Skill

Copy this `ag402-skill/` directory to your OpenClaw skills folder. The skill declares `ag402` as a required binary via `metadata.openclaw.requires.bins`.

### Usage

In OpenClaw, the agent runs ag402 commands via `exec`:

```bash
# Check balance
ag402 balance

# Make a paid API call
ag402 pay https://api.example.com/data

# View transaction history
ag402 history

# Full status dashboard
ag402 status

# Health check
ag402 doctor
```

See [SKILL.md](SKILL.md) for full command reference and [TOOLS.md](TOOLS.md) for CLI option details.

## Security Features

| Feature | Description |
|---------|-------------|
| Budget limits | Daily and per-minute caps prevent runaway spending |
| Test mode | Virtual funds for safe testing before production |
| SSRF protection | Blocks localhost, private IPs, DNS rebinding |
| Transaction audit | All payments logged via `ag402 history` |
| Wallet isolation | Dedicated payment wallet, separate from main wallet |

## File Structure

```
ag402-skill/
├── SKILL.md           # Main skill definition (injected into system prompt)
├── TOOLS.md           # CLI command reference
├── README.md          # This file
├── SECURITY.md        # Security documentation
├── references/        # Additional docs
│   ├── README.md      # Integration guide
│   ├── commands.md    # Detailed CLI reference
│   ├── gateway.md     # Gateway documentation
│   └── security-design.md
├── scripts/           # Helper scripts
│   ├── install-auto.sh
│   ├── install-wizard.sh
│   └── verify-install.sh
├── skill.py           # Legacy Python skill class (not used by OpenClaw exec pattern)
├── prepaid_client.py  # Prepaid credit client
├── prepaid_server.py  # Prepaid credit server
└── prepaid_models.py  # Prepaid data models
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_MODE` | `test` or `production` | Must be set explicitly |
| `X402_NETWORK` | `mainnet`, `devnet`, `localnet` | `devnet` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Public devnet |
| `X402_DAILY_LIMIT` | Max spend per day (USD) | `10` |
| `AG402_UNLOCK_PASSWORD` | Wallet unlock password | — |

## Version

**v0.1.18** — 2026-03-17
- Rewrote SKILL.md/TOOLS.md to use correct exec/CLI pattern (not skill.execute)
- Added `metadata.openclaw.requires.bins` for binary gating

**v0.1.12** — 2026-03-06
- Security fixes: SSRF, auth, race condition, input validation, header whitelist

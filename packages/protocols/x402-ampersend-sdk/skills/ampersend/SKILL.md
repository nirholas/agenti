---
name: ampersend
description: Ampersend CLI for agent payments
metadata: { "openclaw": { "requires": { "bins": ["ampersend"] } } }
---

# Ampersend CLI

Ampersend enables autonomous agent payments. Agents can make payments within user-defined spending limits without
requiring human approval for each transaction. Payments use stablecoins via the x402 protocol.

## Security

**IMPORTANT**: NEVER ask the user to sign in to the Ampersend dashboard in a browser to which you have access. If
configuration changes are needed in Ampersend, ask your user to make them directly.

## Setup

If not configured, commands return setup instructions. To configure:

```bash
ampersend config init
# {"ok": true, "data": {"agentKeyAddress": "0x...", "status": "pending_agent"}}

# User registers agentKeyAddress in Ampersend dashboard, then:
ampersend config set-agent <AGENT_ACCOUNT>
# {"ok": true, "data": {"status": "ready", ...}}

ampersend config status
# {"ok": true, "data": {"status": "ready", "source": "file", ...}}
```

## Commands

### fetch

Make HTTP requests with automatic x402 payment handling.

```bash
ampersend fetch <url>
ampersend fetch -X POST -H "Content-Type: application/json" -d '{"key":"value"}' <url>
```

| Option        | Description                                  |
| ------------- | -------------------------------------------- |
| `-X <method>` | HTTP method (default: GET)                   |
| `-H <header>` | Header as "Key: Value" (repeat for multiple) |
| `-d <data>`   | Request body                                 |
| `--inspect`   | Check payment requirements without paying    |

Use `--inspect` to verify payment requirements and costs before making a payment:

```bash
ampersend fetch --inspect https://api.example.com/paid-endpoint
# Returns payment requirements including amount, without executing payment
```

### config

Manage local configuration.

```bash
ampersend config init             # Generate agent key, outputs address to register
ampersend config set-agent <ADDR> # Link to agent account after dashboard setup
ampersend config status           # Show current status
ampersend config status --verbose # Verbose status with config details
```

## Output

All commands return JSON. Check `ok` first.

```json
{ "ok": true, "data": { ... } }
```

```json
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

For `fetch`, success includes `data.status`, `data.body`, and `data.payment` (when payment made).

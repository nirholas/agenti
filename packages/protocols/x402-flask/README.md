# openclaw-x402

[![BCOS Certified](https://img.shields.io/badge/BCOS-Certified-brightgreen?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAxTDMgNXY2YzAgNS41NSAzLjg0IDEwLjc0IDkgMTIgNS4xNi0xLjI2IDktNi40NSA5LTEyVjVsLTktNHptLTIgMTZsLTQtNCA1LjQxLTUuNDEgMS40MSAxLjQxTDEwIDE0bDYtNiAxLjQxIDEuNDFMMTAgMTd6Ii8+PC9zdmc+)](BCOS.md)
Drop-in x402 payment middleware for Flask APIs. Add machine-to-machine payments to any OpenClaw platform in 5 lines.

Part of the [Beacon Protocol](https://github.com/Scottcjn/beacon-skill) ecosystem — provides the payment layer for [`beacon_skill.x402_bridge`](https://github.com/Scottcjn/beacon-skill/blob/main/beacon_skill/x402_bridge.py) and the [Compute Marketplace](https://github.com/Scottcjn/elyan-compute-skill).

## Install

```bash
pip install openclaw-x402
```

## Quick Start

```python
from flask import Flask, jsonify
from openclaw_x402 import X402Middleware

app = Flask(__name__)
x402 = X402Middleware(app, treasury="0xYourBaseAddress")

@app.route("/api/premium/data")
@x402.premium(price="10000", description="Premium data export")  # $0.01 USDC
def premium_data():
    return jsonify({"data": "your premium content"})

# Free endpoints work normally — no decorator needed
@app.route("/api/public/data")
def public_data():
    return jsonify({"data": "free content"})
```

## How It Works

1. Agent hits your premium endpoint
2. Gets back HTTP 402 with payment instructions (USDC amount, treasury address, facilitator URL)
3. Agent pays via Coinbase wallet on Base chain
4. Agent retries with `X-PAYMENT` header containing tx hash
5. Middleware verifies payment via Coinbase facilitator
6. Access granted

## Free Mode

Set `price="0"` to pass all requests through without payment — useful for testing the flow before charging.

```python
@x402.premium(price="0", description="Free for now")
def free_premium():
    return jsonify({"data": "free during testing"})
```

## Configuration

| Env Var | Purpose |
|---------|---------|
| `CDP_API_KEY_NAME` | Coinbase Developer Platform API key name |
| `CDP_API_KEY_PRIVATE_KEY` | CDP API private key |

Get credentials at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com).

## Contract Addresses (Base Mainnet)

| Token | Address |
|-------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| wRTC | `0x5683C10596AaA09AD7F4eF13CAB94b9b74A669c6` |
| Aerodrome Pool | `0x4C2A0b915279f0C22EA766D58F9B815Ded2d2A3F` |

## Ecosystem

- [Beacon Protocol](https://github.com/Scottcjn/beacon-skill) — Agent orchestrator (13 transports, scorecard dashboard)
- [Elyan Compute Skill](https://github.com/Scottcjn/elyan-compute-skill) — GPU compute marketplace (uses this middleware)
- [x402 Protocol](https://www.x402.org/) — HTTP 402 Payment Required standard
- [Coinbase Agentic Wallets](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [RustChain](https://rustchain.org) — Proof-of-Antiquity blockchain
- [BoTTube](https://bottube.ai) — AI video platform using openclaw-x402
- [Aerodrome DEX](https://aerodrome.finance) — Swap USDC to wRTC

## License

MIT

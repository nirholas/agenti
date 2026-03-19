# open402

> HTTP 402 payment protocol for machine-to-machine commerce — reference implementation in Python

## Installation

```bash
pip install open402
```

**Zero dependencies** — pure Python protocol types, header parsing, and version negotiation.

## Usage

### Parse a 402 Response

```python
from open402 import X402PaymentChallenge, parse_www_authenticate

# Parse the WWW-Authenticate header from a 402 response
challenge = parse_www_authenticate(
    'x402 chain="solana" token="USDC" amount="0.05" address="SolAddr..."'
)
# challenge.chain == "solana"
# challenge.token == "USDC"
# challenge.amount == "0.05"
# challenge.address == "SolAddr..."
```

### Build an Authorization Header

```python
from open402 import build_authorization

header_value = build_authorization(tx_hash="5abc...def")
# "x402 5abc...def"
```

### Version Negotiation

```python
from open402 import negotiate_version

result = negotiate_version(client_version="v1.0", server_versions=["v1.0", "v0.9"])
# result == "v1.0"
```

## Protocol Flow

```
Client                                  Server
  │                                       │
  │── GET /api/resource ────────────────▶│
  │                                       │
  │◀── 402 Payment Required ─────────────│
  │    WWW-Authenticate: x402 ...         │
  │                                       │
  │ [Parse challenge → Pay on-chain]      │
  │                                       │
  │── GET /api/resource ────────────────▶│
  │   Authorization: x402 <tx_hash>       │
  │                                       │
  │◀── 200 OK ───────────────────────────│
```

Compatible with the [Coinbase x402 standard](https://github.com/coinbase/x402).

## Part of Ag402

`open402` is the protocol layer of the [Ag402](https://github.com/AetherCore-Dev/ag402) project.
Use it standalone for protocol parsing, or with `ag402-core` for the full payment engine.

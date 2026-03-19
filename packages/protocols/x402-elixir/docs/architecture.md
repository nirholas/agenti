# Architecture — x402 Elixir SDK

> Last updated: 2026-02-25

## Overview

A pure Elixir library implementing the x402 HTTP payment protocol. Ships as a Hex package; no web server, no database, no external services required by default.

## Design Philosophy

- **Zero lock-in**: works with any facilitator, chain, or framework
- **Minimal deps**: only `jason` and `nimble_options` are required
- **Behaviours over config**: extensibility via `@callback`, not application environment
- **Flat modules**: short, discoverable names (`X402.Wallet`, not `X402.Utils.Validators.Wallet`)

## Module Structure

```
X402                         # Top-level convenience API (delegates to submodules)
├── PaymentRequired          # Encode/decode PAYMENT-REQUIRED header (Base64 JSON)
├── PaymentSignature         # Decode and validate PAYMENT-SIGNATURE header
├── PaymentResponse          # Encode PAYMENT-RESPONSE header
├── Facilitator              # GenServer — HTTP client for /verify + /settle
│   └── HTTP                 # Transport implementation (uses Finch, optional)
├── Plug
│   └── PaymentGate          # Drop-in Plug middleware for Phoenix/Plug pipelines
├── Wallet                   # EVM (secp256k1) + Solana (ed25519) address validation
├── Hooks                    # Behaviour: before_verify / after_verify / on_failure
├── Telemetry                # Telemetry event definitions and metadata
└── Extensions
    ├── PaymentIdentifier    # Idempotency — pluggable cache (ETS default)
    └── SIWX                 # Sign-In-With-X (wallet-authenticated repeat access)
```

## Payment Flow (SDK perspective)

```
Incoming HTTP request
        │
        ▼
X402.Plug.PaymentGate
        │
        ├─ No PAYMENT-SIGNATURE header? → 402 response (PAYMENT-REQUIRED header)
        │
        └─ Signature present?
                │
                ├─ Call X402.Facilitator.verify/2
                │       └─ POST /verify to facilitator URL
                │
                ├─ Verify OK? → Call X402.Facilitator.settle/2
                │                       └─ POST /settle to facilitator URL
                │
                ├─ Hooks: before_verify → after_verify → on_failure
                │
                └─ Pass through to app handler (conn)
```

## Optional Dependencies

| Dep | When Required |
|-----|--------------|
| `finch` | HTTP calls to facilitator (`X402.Facilitator`) |
| `ex_secp256k1` | SIWX signature verification (EVM) |
| `ex_keccak` | SIWX keccak hashing |

All optional deps are guarded by compile-time checks. Must `mix compile --no-optional-deps` successfully.

## Data Formats

All x402 headers carry **Base64-encoded JSON payloads**:

- `PAYMENT-REQUIRED`: `{scheme, network, maxAmountRequired, payTo, asset, extra}`
- `PAYMENT-SIGNATURE`: `{x402Version, scheme, network, payload, authorization}`
- `PAYMENT-RESPONSE`: `{success, transaction, networkId, errorReason?}`

Network IDs use CAIP-2 format: `"eip155:8453"` (Base mainnet), `"eip155:84532"` (Base Sepolia).

## Error Handling Convention

All fallible public functions return `{:ok, result} | {:error, atom_reason}`.  
Structured atoms, never string reasons: `{:error, :invalid_base64}` not `{:error, "bad base64"}`.  
Only raise on programmer errors (wrong type passed to function, etc.).

## Telemetry Events

```
[:x402, :verify, :start]
[:x402, :verify, :stop]
[:x402, :verify, :exception]
[:x402, :settle, :start]
[:x402, :settle, :stop]
[:x402, :settle, :exception]
```

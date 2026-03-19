# Research Findings

## TONAPI Gasless API

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/gasless/config` | GET | Relay address + supported jettons |
| `/v2/gasless/estimate/{master_id}` | POST | Commission estimate + signing payload |
| `/v2/gasless/send` | POST | Submit signed gasless transaction |

### /v2/gasless/send — Primary Integration Point

**Request:**
```json
{
  "wallet_public_key": "hex-encoded-ed25519-pubkey",
  "boc": "hex-encoded-external-message-boc"
}
```

**Response (success):**
```json
{ "protocol_name": "gasless" }
```

**Critical:** BOC must be **hex-encoded** (`Cell.toBoc().toString('hex')`), NOT base64. The OpenAPI spec defines it as `format: cell`. The official `@ton-api/client` SDK confirms: `prepareRequestData()` converts Cell → hex via `.toBoc().toString('hex')`.

**Note:** Tonkeeper Web sends base64 and TONAPI appears to accept both, but hex is spec-canonical.

### /v2/gasless/config

**Response:**
```json
{
  "relay_address": "0:dfbd5be8497fdc0c...",
  "gas_jettons": [
    { "master_id": "0:b113a994b5024a16..." }
  ]
}
```

- `relay_address`: Where to send excess (reduces commission). This becomes `extra.relayAddress` in /supported.
- `gas_jettons`: USDT mainnet (`0:b113a994...`) is always in the list.
- No documented change frequency. Tonkeeper Web caches with no TTL, no retry.

### /v2/gasless/estimate/{master_id}

**Request:**
```json
{
  "wallet_address": "0:...",
  "wallet_public_key": "hex...",
  "messages": [{ "boc": "hex-boc-of-internal-message" }]
}
```

**Response (`SignRawParams`):**
```json
{
  "protocol_name": "gasless",
  "relay_address": "0:...",
  "commission": "1000000",
  "from": "0:...",
  "valid_until": 1717397217,
  "messages": [{ "address": "0:...", "amount": "1000000", "payload": "hex..." }]
}
```

- `commission`: String bigint in atomic jetton units (nanocoins for USDT = 6 decimals)
- `messages`: Rewritten message list (commission transfer prepended). We DON'T use these — x402 client builds its own commission action.

### Authentication

- Header: `Authorization: Bearer <API_KEY>`
- Additional: `x-tonapi-client: x402-ton/1.0.0` (custom user agent)
- API key from https://tonconsole.com
- Unauthenticated: 0.25 rps (1 request / 4 seconds)
- Authenticated: higher limits (plan-dependent)

### Error Format

```json
{
  "error": "error description string",
  "error_code": 400
}
```

Known gasless error types (from Tonwhales wallet): `TryLater`, `NotEnough`, `Cooldown`.

### BOC Format for /v2/gasless/send

The `boc` field accepts the **full external message** wrapping the W5 internal-auth body. TONAPI extracts the signed body, wraps it in an internal message from their gas proxy contract, and submits to validators. The client's wallet receives this internal message, sees opcode `0x73696e74`, verifies the Ed25519 signature, and executes the payment actions.

Source: tonkeeper/tonapi-js `examples/gasless.ts` — wraps `wallet.createTransfer({authType: 'internal'})` in `external({to: contract.address, body: transfer})` before sending.

## W5 authType Internals

### Opcode Mapping

| authType | Opcode | Hex | ASCII | Used for |
|----------|--------|-----|-------|----------|
| external | `0x7369676e` | 7369676E | `sign` | Direct broadcast via `sendFile` |
| internal | `0x73696e74` | 73696E74 | `sint` | Gasless relay via TONAPI |

### Signature Coverage

The opcode IS part of the signed data. The Ed25519 signature covers the Cell hash of:
```
[opcode: 32 bits] + [walletId: 32 bits] + [validUntil: 32 bits] + [seqno: 32 bits] + [actions...]
```

Cross-authType replay is impossible — changing the opcode changes the hash, invalidating the signature.

### SendMode Patching

The `@ton/ton` library automatically adds `SendMode.IGNORE_ERRORS` (+2) for external auth. For internal auth, the sendMode is passed through unchanged. Our client code already sets `SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS` (value 3) explicitly.

## Best Practices

### Security

1. **Gas griefing is bounded** — facilitator sends fixed `DEFAULT_RELAY_GAS_AMOUNT` (0.1 TON) for self-relay. With TONAPI, the facilitator spends 0 TON — TONAPI sponsors gas and recovers via USDT commission.
2. **Commission manipulation** — client signs `maxRelayCommission` blindly from server. SDK should document that consumers validate this value. The facilitator validates `commission <= maxRelayCommission` on verify.
3. **Replay protection** — W5 seqno + validUntil. Same as current model.
4. **No new attack surface from TONAPI** — TONAPI only receives the external message BOC (already public when broadcast). The facilitator never sends private keys to TONAPI.

### Settlement Timeout

For gasless, the message traverses two hops: facilitator external → gas proxy internal → payer wallet → outgoing actions. This takes longer than direct broadcast. Recommendation: increase settlement timeout for gasless from 30s to 60s.

### Commission Caching

TON gas prices are config parameters changed by validator governance (months-long timescales). The TONAPI commission is relatively stable. Fetching at boot + every hour is sufficient. No per-transaction `/estimate` needed.

### Security Hardening

1. **Circuit breaker for self-relay**: When TONAPI is unavailable, each self-relay costs 0.1 TON. Without a circuit breaker, an attacker could drain the facilitator wallet by submitting valid gasless payments during TONAPI downtime. Solution: open circuit after 3 consecutive failures in 60s, cooldown 300s. Daily budget cap of 1 TON.

2. **Relay address allowlist**: TONAPI's `/v2/gasless/config` returns a `relay_address`. If TONAPI is compromised, this could be a malicious address that receives all commissions. Solution: maintain an allowlist of known TONAPI relay addresses, validate at boot.

3. **Commission absolute cap**: TONAPI's `/v2/gasless/estimate` returns a `commission` value. If manipulated, this could set an arbitrarily high commission. Solution: hardcode an absolute maximum (10 USDT = 10_000_000 atomic units). If estimated commission exceeds cap, warn and use cap.

4. **TONAPI request timeout**: All TONAPI HTTP calls must use AbortController with a configurable timeout (default: 10s). Prevents hanging settle() calls if TONAPI is unresponsive.

5. **x402Version validation**: The core x402 v2 spec and PR #1455 require `x402Version: 2`. Validate at server route level before forwarding to facilitator.

### Monitoring (expanded)

**Alerts:**
- Facilitator wallet balance < 1 TON (10 self-relay txs remaining)
- TONAPI circuit breaker OPEN (indicates TONAPI degradation)
- Settlement timeout rate > 10% in 5-minute window
- Commission from /estimate exceeds 50% of MAX_COMMISSION_CAP (early warning)
- Self-relay daily budget > 80% consumed

**Metrics to log:**
- `broadcast_method: "tonapi" | "self_relay" | "direct"` on each settle
- `tonapi_latency_ms` on each TONAPI call
- `circuit_breaker_state: "closed" | "open" | "half_open"`

### Sources

| Resource | URL |
|----------|-----|
| TONAPI OpenAPI Spec | https://github.com/tonkeeper/opentonapi/blob/master/api/openapi.yml |
| Official SDK | https://github.com/tonkeeper/tonapi-js |
| Gasless example | https://github.com/tonkeeper/tonapi-js/blob/main/examples/gasless.ts |
| Tonkeeper Web sender | tonkeeper/tonkeeper-web gasless-message-sender.ts |
| Gasless cookbook | https://docs.tonconsole.com/tonapi/cookbook/gasless-transfer |
| REST API docs | https://docs.tonconsole.com/tonapi/rest-api/gasless |
| PR #1455 | https://github.com/coinbase/x402/pull/1455 |

# Requirements

## Problem

The x402-ton facilitator currently uses a **self-relay** model for gasless broadcasts: it sends an internal message carrying 0.1 TON from its own wallet to the payer's W5 wallet. This works but:

1. **Diverges from the PR #1455 spec** which prescribes `POST /v2/gasless/send` to a relay service
2. **Costs the facilitator TON** for every gasless transaction (0.1 TON each)
3. **Requires facilitator balance monitoring** to prevent relay exhaustion
4. **Has a `gasless?: boolean` in ExactTonPayload** which doesn't exist in the PR spec

## Goals

1. Replace self-relay with TONAPI as primary gasless broadcast method
2. Remove `gasless?: boolean` from `ExactTonPayload` — detect from opcode
3. Unify signedBoc format: always external message, regardless of authType
4. Discover TONAPI relay address + commission at server boot
5. Preserve self-relay as fallback when TONAPI is unavailable
6. Fix USDT mainnet address in constants.ts (critical bug: `...436021ff` → `...c3621dfe`)
7. Add security hardening: circuit breaker, relay address allowlist validation, commission cap

## Non-Goals

- Supporting gasless for native TON payments
- Using the `@ton-api/client` SDK (raw HTTP to avoid dependency)
- Implementing gasless-swap or gasless-generic-transfer protocols
- Dynamic per-transaction `/estimate` calls (boot-time discovery only)

## Acceptance Criteria

### AC1: USDT gasless broadcast via TONAPI
```
Given a USDT payment with authType 'internal' (opcode 0x73696e74)
When the facilitator settles the payment
Then it broadcasts via POST /v2/gasless/send with hex-encoded BOC
And the facilitator does NOT spend its own TON for gas
```

### AC2: Native TON direct broadcast
```
Given a native TON payment with authType 'external' (opcode 0x7369676e)
When the facilitator settles the payment
Then it broadcasts via sendFile (direct to validators)
And the flow is unchanged from current behavior
```

### AC3: Auto-detection from BOC opcode
```
Given a signedBoc (always an external-in message)
When the facilitator parses the body
Then it reads the 32-bit opcode prefix
And routes to TONAPI (0x73696e74) or sendFile (0x7369676e) accordingly
And no `gasless` field is read from the payload
```

### AC4: Client auto-selects authType
```
Given a USDT payment with extra.relayAddress present
When the client creates the payment payload
Then it signs with authType 'internal' automatically
And wraps in an external message (same format as non-gasless)
```

### AC5: TONAPI relay address discovery
```
Given a facilitator server with TONAPI_KEY configured
When the server starts
Then it fetches /v2/gasless/config to get relay_address
And exposes it as relayAddress in GET /supported response
```

### AC6: Commission discovery at boot
```
Given a facilitator server with TONAPI_KEY configured
When the server starts
Then it calls /v2/gasless/estimate with a sample USDT transfer
And stores the commission amount
And exposes it as maxRelayCommission in GET /supported response
```

### AC7: Self-relay fallback
```
Given TONAPI /v2/gasless/send returns an error (5xx, timeout, etc.)
When the facilitator is settling a gasless payment
Then it falls back to the existing self-relay method
And logs a warning about TONAPI unavailability
```

### AC8: signedBoc format unification
```
Given a gasless payment
When the client creates the payload
Then signedBoc is a base64 external-in message (with stateInit if seqno=0)
And the body inside uses opcode 0x73696e74 (internal auth)
And NOT a raw body Cell
```

### AC9: USDT address correction
```
Given the USDT mainnet master contract
When referenced in constants.ts
Then the address MUST be 0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe
And NOT the current incorrect address ...436021ff
```

### AC10: Circuit breaker for self-relay
```
Given TONAPI has failed N consecutive times (default: 3) within M seconds (default: 60)
When a new gasless payment arrives
Then the facilitator skips both TONAPI and self-relay
And returns a broadcast_failed error
And the circuit remains open for a cooldown period (default: 300s)
```

### AC11: Relay address validation
```
Given the server fetches /v2/gasless/config at boot
When it receives a relay_address
Then it validates against an allowlist of known TONAPI relay addresses
And rejects startup if the address is not in the allowlist (configurable: warn vs reject)
```

### AC12: Commission upper bound
```
Given a commission discovered via /v2/gasless/estimate
When the commission exceeds MAX_COMMISSION_CAP (default: 10_000_000 = 10 USDT)
Then the server logs a warning and caps at MAX_COMMISSION_CAP
And uses the capped value in /supported
```

### AC13: TONAPI request timeout
```
Given any HTTP call to TONAPI (/v2/gasless/send, /config, /estimate)
When the call exceeds TONAPI_TIMEOUT_MS (default: 10000)
Then it is aborted via AbortController
And the appropriate fallback/error path is taken
```

### AC14: x402Version validation
```
Given a payment payload arriving at /verify or /settle
When processed by the facilitator
Then x402Version must be validated as 2
And payloads with missing or wrong version are rejected
```

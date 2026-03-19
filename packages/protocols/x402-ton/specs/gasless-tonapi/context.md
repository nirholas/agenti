# Context — Gasless TONAPI Relay Implementation

## Objective

Replace x402-ton's self-relay gasless model with TONAPI `/v2/gasless/send` as primary broadcast, aligning with Coinbase PR #1455 TON exact scheme spec. Remove the `gasless?: boolean` payload field — detect authType from BOC opcode instead.

## Codebase Orientation

**Tech stack:** TypeScript strict, @ton/ton + @ton/core + @ton/crypto, Hono (server), Vitest, tsup (CJS+ESM)

**Build/test/lint:**
```bash
cd packages/ton && npm run build                                            # build SDK
npx vitest run --config packages/ton/vitest.config.ts --dir packages/ton   # 110 SDK tests
npx vitest run --config server/vitest.config.ts                            # 17 server tests
npx tsc --project packages/ton/tsconfig.json --noEmit                      # typecheck SDK
npx tsc --project server/tsconfig.json --noEmit                            # typecheck server
npm run lint                                                                # ESLint 9
```

**Key files with line references:**

| File | What | Key lines |
|------|------|-----------|
| `packages/ton/src/types.ts` | ExactTonPayload.gasless (line 68) — REMOVE | 56-69 |
| `packages/ton/src/exact/client/scheme.ts` | createPaymentPayload — modify gasless detection | 34-194 |
| `packages/ton/src/exact/facilitator/scheme.ts` | verify() body extraction (161-183), settle() broadcast (494-525), broadcastGasless() self-relay (1042-1101) | Full file |
| `packages/ton/src/constants.ts` | Timing constants, TONAPI URLs (43-45) | 36-45 |
| `server/src/config.ts` | Server config — already has tonapiKey | 1-15 |
| `server/src/index.ts` | Facilitator creation (line 56) — pass tonApiConfig | 50-60 |
| `server/src/routes/supported.ts` | GET /supported — expose relay info | Full file |
| `packages/ton/test/unit/facilitator.test.ts` | Gasless tests (lines 508-544) — update | 508-544 |
| `packages/ton/test/unit/client.test.ts` | Client tests — add USDT auto-gasless | Full file |

## Existing Patterns to Follow

1. **Never throw from verify/settle** — always return structured response objects
2. **BigInt for all amounts** — `BigInt(extra.maxRelayCommission)`, never parseFloat
3. **Log BOC hash only** — `hashBoc()` from utils.ts, never raw BOC
4. **Raw hex addresses in protocol** — `0:<64hex>` format
5. **Structured error codes** — use `X402ErrorCode` enum values
6. **Mock TonClient in tests** — `createMockTonClient()` pattern in test helpers

## Key Decisions

1. **No `gasless` boolean** — detect from opcode `0x73696e74` vs `0x7369676e` in BOC body
2. **USDT auto-gasless** — client detects: if asset !== 'native' && extra?.relayAddress → authType internal
3. **Always external message** — signedBoc wraps body in external-in message, even for internal auth
4. **TONAPI primary, self-relay fallback** — try TONAPI first, on error fall back to existing self-relay (subject to circuit breaker). tonApiConfig is part of existing FacilitatorOptions (4th constructor param), not a new parameter.
5. **Hex BOC for TONAPI** — convert base64 signedBoc → Cell → hex when calling TONAPI
6. **Boot-time commission discovery** — fetch /v2/gasless/estimate once at boot, refresh hourly

## Lore — Non-obvious Knowledge

1. **TONAPI BOC format ambiguity**: The spec says hex (`format: cell`), the official SDK converts Cell→hex, but Tonkeeper Web sends base64 and it works. Use hex to be spec-compliant.

2. **TONAPI accepts full external message**: `/v2/gasless/send` receives the complete external-in message BOC. TONAPI extracts the signed body (with `0x73696e74` prefix), wraps it in an internal message from their gas proxy contract, and submits to validators. We do NOT need to extract the body ourselves.

3. **The opcode IS signed**: The 32-bit prefix (`0x7369676e` or `0x73696e74`) is the first thing in the signed Cell. The Ed25519 signature covers this prefix. Cross-authType replay is cryptographically impossible — changing the opcode invalidates the signature.

4. **SendMode safety**: `@ton/ton` auto-adds `IGNORE_ERRORS` (+2) for external auth but passes through for internal auth. Our client already sets `PAY_GAS_SEPARATELY + IGNORE_ERRORS` (3) explicitly, so this is a no-op — but be aware when reading the @ton/ton source.

5. **seqno=0 + internal auth = invalid**: A seqno=0 wallet needs stateInit (external message only). Gasless (internal auth) can't deploy a wallet. The existing check at facilitator/scheme.ts:367 already blocks this — keep it.

6. **Commission goes to TONAPI relay, not facilitator**: When using TONAPI as relay, the `relayAddress` in `/supported` is TONAPI's `relay_address` from `/v2/gasless/config`. The commission (2nd W5 action) goes to TONAPI. The facilitator operates as a free relay.

7. **Existing emulation skips gasless**: At facilitator/scheme.ts:456, emulation is skipped when `payload.gasless === true` because the BOC was a raw body Cell. After this change, we still skip emulation for internal-auth BOCs because the external message wrapping an internal-auth body cannot be emulated via TonAPI traces endpoint (it would fail — the traces endpoint expects the BOC to be executable as-is, but an internal-auth BOC must be relayed first).

8. **`response_destination` in jetton transfer**: Setting it to TONAPI's relay_address reduces commission. The current client code sets `response_address = payerAddress` (client/scheme.ts:110). Consider changing to relay_address for the commission transfer action to reduce costs.

9. **TONAPI error types**: Known error strings include `TryLater` (transient), `NotEnough` (insufficient jetton balance), `Cooldown` (rate limit). Handle these distinctly in the fallback logic.

10. **Gasless settlement is slower**: Two hops (gas proxy → wallet → outgoing). Use 60s timeout instead of 30s for gasless paths.

11. **x402Version validation**: PR #1455 requires `x402Version MUST be 2`. The core x402 spec v2 mandates this. Add version checking at the server route level (before forwarding to facilitator). The SDK facilitator does not need to check version — that's the server's responsibility.

12. **Native TON support is an intentional superset**: PR #1455 describes the TON exact scheme as Jetton-only with mandatory internal_signed. We support both Jetton (gasless via internal auth) and native TON (direct via external auth). This is additive — the PR doesn't prohibit external auth, it just doesn't describe it. Our implementation is a superset that covers more use cases.

## Research Findings That Affect Implementation

### TONAPI /v2/gasless/send request format
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), TONAPI_REQUEST_TIMEOUT_MS);
try {
  const response = await fetch(`${tonApiEndpoint}/v2/gasless/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tonApiKey}`,
      'x-tonapi-client': 'x402-ton/1.0.0',
    },
    body: JSON.stringify({
      wallet_public_key: payload.walletPublicKey,
      boc: Cell.fromBoc(Buffer.from(payload.signedBoc, 'base64'))[0].toBoc().toString('hex'),
    }),
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeoutId);
}
```

### TONAPI /v2/gasless/config response
```typescript
interface GaslessConfigResponse {
  relay_address: string;  // raw address
  gas_jettons: Array<{ master_id: string }>;
}
```

### TONAPI /v2/gasless/estimate request
```typescript
const response = await fetch(`${tonApiEndpoint}/v2/gasless/estimate/${usdtMasterAddress}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tonApiKey}`,
  },
  body: JSON.stringify({
    wallet_address: sampleWalletAddress,
    wallet_public_key: samplePublicKey,
    messages: [{ boc: sampleMessageHex }],
  }),
});
// response.commission is string bigint in jetton atomic units
```

## Implementation Order

### Phase 0: Critical bug fix

0. **constants.ts**: Fix USDT mainnet address from `0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecd436021ff` to `0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe`. This is the canonical address verified via TonAPI, tonviewer, and tonkeeper. Current address returns 400 from TonAPI.

### Phase 1: SDK Types & Client (no breaking changes to facilitator yet)

1. **types.ts**: Remove `gasless?: boolean` from `ExactTonPayload`. Add `TonApiConfig` interface.
2. **client/scheme.ts**: Change `createPaymentPayload`:
   - Remove `gasless` parameter
   - Auto-detect: if `asset !== 'native' && extra?.relayAddress` → `authType: 'internal'`
   - ALWAYS wrap in external message (remove the gasless raw-body-Cell branch)
   - Remove `gasless: true` from return value
3. **client.test.ts**: Update tests — remove gasless param, add USDT auto-detection tests

### Phase 2: Facilitator verify + settle

4. **facilitator/scheme.ts verify()** — ALL `payload.gasless` references:
   - Line 161: Remove gasless branching in body extraction — always parse as external-in message
   - Line 252: Remove `payload.gasless` from opcode selection — accept both opcodes, store detected opcode in a local variable for later use
   - Line 345: Change `!payload.gasless` to opcode-based check for stateInit validation
   - Line 367-374: Change `payload.gasless` to opcode `0x73696e74` check for seqno=0 rejection
   - Line 455-461: Change `!payload.gasless` to opcode check for emulation skip
   - Store detected opcode as return value or side-channel for settle() to use

5. **facilitator/scheme.ts settle()**:
   - Detect opcode from verified BOC body (store it during verify, or re-parse)
   - If `0x73696e74` (internal auth) AND `tonApiConfig` is set:
     - Call `broadcastViaTonApi()` (new method)
     - On TONAPI error: fall back to `broadcastSelfRelay()` (renamed from `broadcastGasless()`)
   - If `0x7369676e` (external auth): `sendFile()` as today
   - Use `GASLESS_SETTLEMENT_TIMEOUT_SECONDS` (60s) for gasless path

6. **facilitator/scheme.ts new methods**:
   - `broadcastViaTonApi(payload)`: POST to `/v2/gasless/send` with hex BOC
   - Rename `broadcastGasless()` → `broadcastSelfRelay()` for clarity

6b. **facilitator/scheme.ts circuit breaker**:
   - Add private state: `tonApiFailures: number`, `tonApiCircuitOpen: boolean`, `tonApiCircuitOpenAt: number`
   - In `broadcastViaTonApi()`: on success → reset failures. On error → increment. If failures >= 3 in 60s → open circuit.
   - In `settle()`: if circuit OPEN and cooldown not expired → reject with `broadcast_failed` (skip both TONAPI and self-relay). If cooldown expired → try TONAPI once (half-open). Self-relay only happens when circuit is CLOSED (TONAPI just failed but threshold not reached).
   - Add daily budget tracking: `selfRelayTonSpent: bigint`, `selfRelayBudgetResetAt: number`
   - In `broadcastSelfRelay()`: check `selfRelayTonSpent < MAX_DAILY_SELF_RELAY_TON` before spending. Reject with `broadcast_failed` if budget exhausted.
   - **Summary**: Circuit CLOSED → try TONAPI, on fail → self-relay (within budget). Circuit OPEN → reject (no TONAPI, no self-relay). Circuit HALF_OPEN → try TONAPI once.

6c. **facilitator/scheme.ts relay address allowlist**:
   - Add `allowedRelayAddresses?: string[]` to `FacilitatorOptions`
   - When TONAPI relay_address is received (at boot or refresh), validate against allowlist
   - If address not in allowlist → log warning and fall back to facilitator address (self-relay mode)
   - Default allowlist: known TONAPI relay address (hardcoded)

7. **constants.ts**: Add:
   - `GASLESS_SETTLEMENT_TIMEOUT_SECONDS = 60`
   - `TONAPI_REQUEST_TIMEOUT_MS = 10_000`
   - `CIRCUIT_BREAKER_THRESHOLD = 3` (consecutive failures)
   - `CIRCUIT_BREAKER_WINDOW_MS = 60_000` (window for counting)
   - `CIRCUIT_BREAKER_COOLDOWN_MS = 300_000` (open state duration)
   - `MAX_DAILY_SELF_RELAY_TON = BigInt(1_000_000_000)` (1 TON daily budget)
   - `MAX_COMMISSION_CAP = BigInt(10_000_000)` (10 USDT absolute maximum)

8. **facilitator.test.ts**: Rewrite gasless tests — no `gasless` field, test opcode detection, mock TONAPI HTTP, test fallback

### Phase 3: Server integration

9. **config.ts**: Add `tonapiEndpoint` (optional)
10. **index.ts**: Pass tonApiConfig to facilitator. Fetch /v2/gasless/config at boot. Start hourly refresh.
11. **routes/supported.ts**: Use TONAPI relay_address + estimated commission
12. **routes/verify.ts + settle.ts**: Remove `gasless` field references. Add `x402Version` validation: reject payloads where `x402Version !== 2` at the route level (before forwarding to facilitator). Return 400 with descriptive error.
13. **Server tests**:
    - `server/test/supported.test.ts`: Update assertions — relayAddress will be TONAPI relay (not facilitator address), maxRelayCommission from estimate
    - `server/test/verify.test.ts` + `server/test/verify-security.test.ts`: No gasless field changes needed (passthrough)
    - `server/test/settle-security.test.ts`: No gasless field changes needed (passthrough)

### Phase 4: Validation

14. Run all tests: `npx vitest run` (should be 127+ tests)
15. Typecheck: `npx tsc --noEmit` both projects
16. Lint: `npm run lint`
17. Build: `cd packages/ton && npm run build`

## Verification Commands

```bash
# After each phase:
cd packages/ton && npm run build
npx vitest run --config packages/ton/vitest.config.ts --dir packages/ton
npx vitest run --config server/vitest.config.ts
npx tsc --project packages/ton/tsconfig.json --noEmit
npx tsc --project server/tsconfig.json --noEmit
npm run lint

# E2E (after deploy):
npx tsx scripts/test-verify.ts https://x402.resistance.dog
```

## Warnings

- **NEVER** add a `gasless` field to ExactTonPayload — it's not in the PR #1455 spec
- **NEVER** send base64 BOC to TONAPI — always hex
- **NEVER** skip verify before settle — settle must re-verify independently
- **NEVER** log the raw BOC — only the SHA-256 hash
- **NEVER** use float math for commission amounts — always BigInt
- **NEVER** trust TONAPI response as proof of settlement — poll seqno as confirmation
- **NEVER** allow unlimited self-relay without circuit breaker — cap at 3 consecutive failures + daily budget
- **NEVER** accept TONAPI relay_address without validating against allowlist
- **NEVER** use commission from /estimate without capping at MAX_COMMISSION_CAP
- The facilitator's emulation step (TonAPI traces) must be SKIPPED for internal-auth BOCs — they cannot be emulated as external messages
- `response_destination` in jetton transfers affects TONAPI commission — setting it to relay_address reduces cost
- The USDT mainnet address MUST be `0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe` — the current address in constants.ts is WRONG

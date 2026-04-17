# Build: Test Suite

status: pending

## Goal
Add a Vitest test suite covering `@agenti/core`, `@agenti/sdk`, and `@agenti/mcp`. Tests should be self-contained — no live network calls, no real keys.

## Setup

Add to root `package.json` devDependencies:
```json
"vitest": "^1.6.0"
```

Add test script to each package's `package.json`:
```json
"test": "vitest run"
```

Add `vitest.config.ts` at workspace root:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { globals: true, environment: 'node' }
})
```

## Tests to write

### packages/core/src/__tests__/wallet.test.ts
```ts
describe('generateWallet', () => {
  it('returns a valid EVM address (0x + 40 hex chars)')
  it('returns a valid Solana address (base58, 32-44 chars)')
  it('generates unique wallets on each call')
})

describe('walletFromKeys', () => {
  it('recovers the correct EVM address from a private key')
  it('recovers the correct Solana address from a key')
})
```

### packages/sdk/src/__tests__/pay.test.ts
Mock `fetch` to return 402 then 200:
```ts
describe('x402 flow', () => {
  it('retries with payment header after 402')
  it('parses v1 payment requirements from body')
  it('parses v2 payment requirements from headers')
  it('signs EIP-3009 transferWithAuthorization correctly')
  it('gives up after max retries')
})
```

### packages/sdk/src/__tests__/balance.test.ts
Mock viem publicClient and web3 Connection:
```ts
describe('getBalances', () => {
  it('returns USDC balance from EVM chain')
  it('returns SOL balance from Solana')
  it('returns zero for empty wallets')
})
```

### packages/sdk/src/__tests__/receive.test.ts
```ts
describe('createInvoice', () => {
  it('generates a unique invoice ID each call')
  it('sets expiry 30 minutes from now')
  it('routes EVM chains to EVM address')
  it('routes solana chain to Solana address')
})
```

### packages/mcp/src/__tests__/server.test.ts
Use MCP test client or mock the transport:
```ts
describe('MCP tools', () => {
  it('create_wallet returns evm_address and solana_address')
  it('create_invoice returns invoice object')
  // pay and get_balance require env vars — test with mock keys
})
```

## Do NOT test
- Live RPC calls (mock them)
- Real private keys (generate fresh test keys in beforeEach)
- Pump.fun API (mock fetch)

Mark this file's status as `complete` when done.

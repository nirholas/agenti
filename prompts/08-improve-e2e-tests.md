# Prompt: Improve E2E Test Coverage

## Objective

Expand end-to-end tests to cover real MCP client interactions, cross-chain workflows, and critical user journeys. Current E2E tests exist but are thin and heavily mocked.

## Current E2E Tests

Located in `tests/e2e/`:
- `evm-tools.e2e.test.ts`
- `defi-tools.e2e.test.ts`
- `market-data.e2e.test.ts`
- `multichain.e2e.test.ts`
- `error-recovery.e2e.test.ts`
- `mcp-client.test.ts`

Config: `vitest.e2e.config.ts` (60s timeout, sequential, retry once)

## New E2E Tests to Add

### 1. `tests/e2e/mcp-server-lifecycle.e2e.test.ts`

Test the full MCP server startup, tool discovery, and shutdown:

```typescript
describe("MCP Server Lifecycle", () => {
  it("should start the server and list all tools", async () => {
    // Start the actual MCP server process
    // Connect via stdio or SSE
    // Call tools/list
    // Verify 380+ tools are registered
    // Shut down cleanly
  })

  it("should handle concurrent tool calls", async () => {
    // Start server
    // Fire 10 tool calls in parallel
    // All should resolve without errors
  })

  it("should recover from a crashed tool", async () => {
    // Call a tool that will fail (bad params)
    // Verify server is still responsive
    // Call a valid tool — should succeed
  })
})
```

### 2. `tests/e2e/cross-chain-workflow.e2e.test.ts`

Test workflows that span multiple chains:

```typescript
describe("Cross-Chain Workflows", () => {
  it("should fetch balances across multiple chains", async () => {
    // Query ETH balance on mainnet
    // Query BNB balance on BSC
    // Query MATIC balance on Polygon
    // All should return valid responses
  })

  it("should resolve ENS names and then query balances", async () => {
    // Resolve vitalik.eth
    // Use resolved address to get balance
    // Chain the calls like an AI agent would
  })
})
```

### 3. `tests/e2e/defi-workflow.e2e.test.ts`

Test realistic DeFi agent workflows:

```typescript
describe("DeFi Agent Workflow", () => {
  it("should check price → check liquidity → simulate swap", async () => {
    // 1. Get token price
    // 2. Check DEX liquidity
    // 3. Get swap quote
    // Each step uses output from the previous
  })

  it("should monitor gas and suggest optimal timing", async () => {
    // 1. Get current gas price
    // 2. Get gas history
    // 3. Verify response includes actionable data
  })
})
```

### 4. `tests/e2e/error-boundaries.e2e.test.ts`

Test that the server handles every class of error:

```typescript
describe("Error Boundaries", () => {
  it("should return structured error for unknown tool", async () => {
    // Call a tool that doesn't exist
    // Should get MCP error response, not a crash
  })

  it("should handle rate-limited APIs gracefully", async () => {
    // Call a tool many times rapidly
    // Should get rate limit error, not crash
  })

  it("should timeout long-running tools", async () => {
    // Call a tool with params that cause slow response
    // Should timeout within configured limit
  })

  it("should handle malformed input without crashing", async () => {
    // Send garbage params to a tool
    // Should get validation error
  })
})
```

## E2E Test Configuration

Update `vitest.e2e.config.ts` to support environment-based test selection:

```typescript
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.e2e.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    sequence: { concurrent: false },
    retry: 1,
    // Allow skipping network-dependent tests in CI
    env: {
      E2E_NETWORK: process.env.E2E_NETWORK || "mock",
    },
  },
})
```

## Environment Modes

Support two modes so E2E tests work in CI (no network) and locally (with network):

```typescript
const isLive = process.env.E2E_NETWORK === "live"

describe("Market Data E2E", () => {
  it.runIf(isLive)("should fetch real BTC price from CoinGecko", async () => {
    // Only runs with E2E_NETWORK=live
  })

  it("should handle mocked price data", async () => {
    // Always runs
  })
})
```

## npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "test:e2e:live": "E2E_NETWORK=live vitest run --config vitest.e2e.config.ts"
  }
}
```

## Verification

```bash
# Mocked E2E (should work in CI)
npm run test:e2e

# Live E2E (requires network, optional)
npm run test:e2e:live
```

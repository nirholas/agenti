<!-- universal-crypto-mcp | nichxbt | 0.14.9.3 -->

# Universal Crypto MCP - Testing Guide

<!-- Maintained by @nichxbt | ID: 78738 -->

This document explains how to run tests, write new tests, and use the testing utilities in this project.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Mock Patterns](#mock-patterns)
- [Custom Assertions](#custom-assertions)
- [Test Fixtures](#test-fixtures)
- [E2E Testing](#e2e-testing)
- [Coverage](#coverage)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Test Structure

```
tests/
├── setup.ts              # Global test setup
├── e2e/                  # End-to-end tests
│   ├── setup.ts          # E2E test setup and utilities
│   ├── defi-tools.e2e.test.ts
│   ├── evm-tools.e2e.test.ts
│   ├── market-data.e2e.test.ts
│   ├── multichain.e2e.test.ts
│   └── error-recovery.e2e.test.ts
├── integration/          # Integration tests
│   ├── evm-tools.test.ts
│   ├── multichain.test.ts
│   └── server.test.ts
├── mocks/                # Shared mock utilities
│   ├── mcp.ts           # MCP server mocks
│   └── viem.ts          # Viem client mocks
└── utils/                # Test utilities
    ├── assertions.ts     # Custom vitest matchers
    └── fixtures.ts       # Reusable test data
```

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Files

```bash
# Run a specific test file
npx vitest run tests/e2e/defi-tools.e2e.test.ts

# Run tests matching a pattern
npx vitest run --grep "DeFi"
```

### Watch Mode

```bash
# Re-run tests on file changes
npm run test:watch

# Watch specific files
npx vitest watch tests/e2e/
```

### With Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory.

## Writing Tests

### Unit Tests

Unit tests are co-located with source files (e.g., `src/utils/helper.test.ts`).

```typescript
import { describe, it, expect } from "vitest"
import { myFunction } from "./helper"

describe("myFunction", () => {
  it("should return expected result", () => {
    expect(myFunction("input")).toBe("expected")
  })
})
```

### Integration Tests

Integration tests test multiple components together.

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { MockMcpServer, createMockMcpServer } from "../mocks/mcp"

describe("Tool Integration", () => {
  let mockServer: MockMcpServer

  beforeEach(() => {
    mockServer = createMockMcpServer()
  })

  it("should register and execute tool", async () => {
    const result = await mockServer.executeTool("tool_name", { param: "value" })
    expect(result).toBeDefined()
  })
})
```

### E2E Tests

E2E tests run against the actual MCP server.

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { assertToolSuccess, parseToolResult } from "./setup"

describe("E2E Tests", () => {
  let client: Client
  let transport: StdioClientTransport

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/index.ts"],
      env: { ...process.env, NODE_ENV: "test" }
    })
    client = new Client({ name: "test", version: "1.0.0" })
    await client.connect(transport)
  }, 30000)

  afterAll(async () => {
    await client.close()
    await transport.close()
  })

  it("should call tool successfully", async () => {
    const result = await client.callTool({
      name: "tool_name",
      arguments: { param: "value" }
    })

    assertToolSuccess(result)
    const data = parseToolResult<{ key: string }>(result)
    expect(data.key).toBeDefined()
  })
})
```

## Mock Patterns

### Mocking External APIs

```typescript
import { vi } from "vitest"

// Mock fetch globally
vi.spyOn(global, "fetch").mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: "mocked" })
} as Response)

// Mock specific API
vi.mock("@/utils/api", () => ({
  fetchData: vi.fn().mockResolvedValue({ result: "mocked" })
}))
```

### Mocking Viem Clients

```typescript
import { vi } from "vitest"
import { createMockViemClient } from "./mocks/viem"

vi.mock("@/evm/services/clients", () => ({
  getPublicClient: vi.fn(() => createMockViemClient())
}))
```

### Mocking MCP Server

```typescript
import { createMockMcpServer } from "../mocks/mcp"

const mockServer = createMockMcpServer()
registerTools(mockServer as any)

// Execute tool
const result = await mockServer.executeTool("tool_name", args)
```

### Mocking Chain Data

```typescript
vi.mock("viem/chains", () => ({
  mainnet: { id: 1, name: "Ethereum" },
  sepolia: { id: 11155111, name: "Sepolia" }
}))
```

## Custom Assertions

Import custom matchers in your test file:

```typescript
import "../utils/assertions"
```

### Available Matchers

```typescript
// Check for successful response
expect(result).toBeSuccessfulToolResponse()

// Check for error response
expect(result).toBeErrorToolResponse()

// Check for valid JSON content
expect(result).toHaveValidJsonContent()

// Check for specific JSON properties
expect(result).toHaveJsonContent({ key: "value" })
expect(result).toHaveJsonProperty("nested.path", expectedValue)

// Check for error messages
expect(result).toContainToolError(/pattern/i)

// Check for specific text
expect(result).toContainText("expected text")

// Check for content type
expect(result).toHaveContentType("text")

// Check for array content
expect(result).toHaveArrayContent(5) // minimum length

// Check for valid addresses/hashes
expect(result).toContainValidAddress()
expect(result).toContainValidTxHash()

// Check for valid numeric fields
expect(result).toContainValidNumericField("balance")
```

### Standalone Assertion Functions

```typescript
import { assertSuccessAndParse, assertError, getTextOrThrow } from "../utils/assertions"

// Parse successful response
const data = assertSuccessAndParse<{ name: string }>(result)

// Assert error with pattern
assertError(result, /invalid address/i)

// Get text content
const text = getTextOrThrow(result)
```

## Test Fixtures

Import fixtures for consistent test data:

```typescript
import {
  ETH_MAINNET_ADDRESSES,
  ETH_SEPOLIA_ADDRESSES,
  BSC_MAINNET_ADDRESSES,
  MOCK_TOKEN_DATA,
  MOCK_DEFI_PROTOCOLS,
  MOCK_MARKET_DATA,
  NETWORK_CONFIGS,
  ERROR_SCENARIOS,
  generateRandomAddress,
  generateRandomTxHash,
  createMockBalanceResponse,
  createMockTokenInfo,
  createMockBlockResponse
} from "../utils/fixtures"
```

### Using Fixtures

```typescript
// Well-known addresses
const address = ETH_MAINNET_ADDRESSES.VITALIK

// Mock token data
const tokenInfo = MOCK_TOKEN_DATA.USDC

// Generate random test data
const randomAddr = generateRandomAddress()
const randomTxHash = generateRandomTxHash()

// Create mock responses
const balanceResponse = createMockBalanceResponse("1.5", 18)
const blockResponse = createMockBlockResponse(18000000)
```

## E2E Testing

### Setup

E2E tests use `tests/e2e/setup.ts` which provides:

- `startMCPServer()` / `stopMCPServer()` - Server lifecycle
- `assertToolSuccess()` - Validate successful response
- `parseToolResult<T>()` - Parse JSON response
- `retryWithBackoff()` - Retry failed requests
- `TEST_NETWORKS` / `TEST_ADDRESSES` - Test data

### Best Practices

1. **Use retry with backoff** for network requests:
```typescript
const result = await retryWithBackoff(async () => {
  return await client.callTool({ name: "tool", arguments: {} })
}, 3, 2000)
```

2. **Set appropriate timeouts**:
```typescript
it("test name", async () => {
  // test code
}, 30000) // 30 second timeout
```

3. **Clean up resources**:
```typescript
afterAll(async () => {
  await client.close()
  await transport.close()
})
```

4. **Use test networks**:
- Prefer testnets (Sepolia, BSC Testnet) over mainnets
- Avoid rate limiting by using appropriate delays

## Coverage

### Generating Coverage

```bash
npm run test:coverage
```

### Coverage Reports

- HTML report: `coverage/index.html`
- LCOV: `coverage/lcov.info`
- JSON: `coverage/coverage-final.json`

### Coverage Thresholds

Configure in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  }
}
```

## Troubleshooting

### Common Issues

**Tests timing out:**
- Increase timeout: `it("test", async () => {...}, 60000)`
- Check network connectivity
- Use `retryWithBackoff()` for flaky tests

**Mock not working:**
- Ensure mock is defined before imports
- Check mock path matches import path
- Use `vi.resetAllMocks()` in `beforeEach`

**E2E server not starting:**
- Check server build is up to date
- Verify environment variables
- Check port availability

**Rate limiting:**
- Add delays between requests
- Use testnets instead of mainnet
- Implement retry logic

### Debug Mode

```bash
# Run with verbose output
DEBUG=* npm test

# Run single test in isolation
npx vitest run tests/path/to/test.ts --reporter=verbose
```

### Useful Commands

```bash
# Clear test cache
npx vitest --clearCache

# Update snapshots
npx vitest -u

# Run only failed tests
npx vitest --failed

# Type-check tests
npx tsc --noEmit
```

## Contributing

When adding new tests:

1. Follow existing patterns and naming conventions
2. Add tests for both success and failure cases
3. Use appropriate timeouts for async operations
4. Mock external dependencies where possible
5. Update this README if adding new patterns/utilities


<!-- EOF: nichxbt | ucm:0.14.9.3 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->
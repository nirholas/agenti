# Prompt: Add Tests to Untested Modules

## Objective

Add unit tests to the 16 modules in `src/modules/` that currently have zero test coverage.

## Untested Modules

1. `src/modules/ai-predictions/`
2. `src/modules/ai-prompts/`
3. `src/modules/alerts/`
4. `src/modules/coingecko/`
5. `src/modules/governance/`
6. `src/modules/historical-data/`
7. `src/modules/indicators/`
8. `src/modules/portfolio/`
9. `src/modules/research/`
10. `src/modules/rubic/`
11. `src/modules/server-utils/`
12. `src/modules/tool-marketplace/`
13. `src/modules/tradingview/`
14. `src/modules/utils/`
15. `src/modules/wallet-analytics/`
16. `src/modules/websockets/`

## Modules WITH Tests (use as reference)

- `src/modules/market-data/market-data.test.ts` — best example, 491 lines
- `src/modules/defi/defi.test.ts`
- `src/modules/social/social.test.ts`
- `src/modules/lyra-ecosystem/lyra-ecosystem.test.ts`
- `src/modules/dex-analytics/`
- `src/modules/news/`

## Pattern to Follow

For each untested module:

1. Read the module's source files to understand what tools it exports
2. Create a `<module-name>.test.ts` file in the same directory
3. Follow the pattern from `market-data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// Import the module's tools/registration function
import { registerTools } from "./<module>"

// Import mock utilities
import { MockMcpServer } from "../../../tests/mocks/mcp"

describe("<Module Name> Tools", () => {
  let server: MockMcpServer

  beforeEach(() => {
    server = new MockMcpServer()
    vi.clearAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all tools", () => {
      registerTools(server as any)
      // Check expected tools are registered
      expect(server.registeredTools.size).toBeGreaterThan(0)
    })
  })

  describe("<tool_name>", () => {
    it("should return data on success", async () => {
      // Mock fetch or external calls
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ /* mock response */ }),
      })
      global.fetch = mockFetch

      registerTools(server as any)
      const result = await server.callTool("<tool_name>", {
        /* params */
      })

      expect(result.isError).toBeFalsy()
    })

    it("should handle API errors gracefully", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })
      global.fetch = mockFetch

      registerTools(server as any)
      const result = await server.callTool("<tool_name>", {
        /* params */
      })

      expect(result.isError).toBeTruthy()
    })

    it("should validate required parameters", async () => {
      registerTools(server as any)
      // Call with missing/invalid params and expect error
    })
  })
})
```

## Priority Order

Start with the highest-risk / most-used modules:
1. **portfolio** — users depend on this for asset tracking
2. **wallet-analytics** — financial data, must be correct
3. **coingecko** — heavily used market data source
4. **governance** — on-chain voting, correctness matters
5. **indicators** — technical analysis, math must be right
6. **historical-data** — data accuracy critical
7. Then the rest in any order

## Minimum Coverage Per Module

Each test file should cover at minimum:
- Tool registration (tools are properly registered on the server)
- Happy path for each tool (mocked API returns data)
- Error handling (API returns 500, network error, malformed response)
- Input validation (missing required params, invalid values)

## Test Utilities Available

Use the existing test infrastructure:
- `tests/mocks/mcp.ts` — MockMcpServer for tool testing
- `tests/mocks/viem.ts` — Mock blockchain client
- `tests/utils/assertions.ts` — Custom matchers (toBeSuccessfulToolResponse, etc.)
- `tests/utils/fixtures.ts` — Test addresses, mock data
- `tests/setup.ts` — Global setup with mock fetch and test addresses

## Verification

After adding tests for each module:
```bash
npm test -- src/modules/<module-name>/
npm run test:coverage -- --reporter=text src/modules/<module-name>/
```

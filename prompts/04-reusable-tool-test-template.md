# Prompt: Create Reusable Tool Test Template

## Objective

Create a test generator/template that makes it trivial to stamp out tests for all 380+ tools. Writing tests one-by-one is too slow — we need a pattern that scales.

## Deliverables

### 1. Create `tests/templates/tool-test-template.ts`

A copyable template file with placeholders:

```typescript
/**
 * Test template for MCP tools
 * Copy this file, replace placeholders, and customize per tool.
 *
 * Usage: cp tests/templates/tool-test-template.ts src/modules/<module>/<module>.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MockMcpServer } from "../../tests/mocks/mcp"

// TODO: Update import path
import { registerTools } from "./index"

// TODO: Update module name
const MODULE_NAME = "MODULE_NAME"

// TODO: Define the tools this module registers
const EXPECTED_TOOLS = [
  "tool_name_1",
  "tool_name_2",
]

describe(`${MODULE_NAME} Tools`, () => {
  let server: MockMcpServer
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    server = new MockMcpServer()
    mockFetch = vi.fn()
    global.fetch = mockFetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Registration ──────────────────────────────────────────
  describe("Tool Registration", () => {
    it("should register all expected tools", () => {
      registerTools(server as any)
      for (const tool of EXPECTED_TOOLS) {
        expect(server.registeredTools.has(tool)).toBe(true)
      }
    })

    it("should register correct number of tools", () => {
      registerTools(server as any)
      expect(server.registeredTools.size).toBe(EXPECTED_TOOLS.length)
    })
  })

  // ── Per-Tool Tests ────────────────────────────────────────
  // Copy this block for each tool in the module:

  describe("tool_name_1", () => {
    beforeEach(() => {
      registerTools(server as any)
    })

    it("should return data on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          // TODO: Mock response matching the real API shape
        }),
      })

      const result = await server.callTool("tool_name_1", {
        // TODO: Required params
      })

      expect(result.isError).toBeFalsy()
      // TODO: Assert on response content
    })

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })

      const result = await server.callTool("tool_name_1", {
        // TODO: Required params
      })

      expect(result.isError).toBeTruthy()
    })

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await server.callTool("tool_name_1", {
        // TODO: Required params
      })

      expect(result.isError).toBeTruthy()
    })

    it("should validate required parameters", async () => {
      // TODO: Call with missing required params
      await expect(
        server.callTool("tool_name_1", {})
      ).rejects.toThrow()
    })
  })
})
```

### 2. Create `tests/helpers/createToolTests.ts`

A programmatic helper for generating common test cases:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MockMcpServer } from "../mocks/mcp"

interface ToolTestConfig {
  toolName: string
  validParams: Record<string, unknown>
  mockSuccessResponse: unknown
  requiredParams?: string[]
}

/**
 * Generates standard test cases for an MCP tool.
 * Use this for tools that follow the standard fetch-and-return pattern.
 */
export function createToolTests(
  registerTools: (server: any) => void,
  config: ToolTestConfig
) {
  const { toolName, validParams, mockSuccessResponse, requiredParams } = config

  describe(toolName, () => {
    let server: MockMcpServer
    let mockFetch: ReturnType<typeof vi.fn>

    beforeEach(() => {
      server = new MockMcpServer()
      mockFetch = vi.fn()
      global.fetch = mockFetch
      vi.clearAllMocks()
      registerTools(server as any)
    })

    it("should return data on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      })

      const result = await server.callTool(toolName, validParams)
      expect(result.isError).toBeFalsy()
    })

    it("should handle 500 errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })

      const result = await server.callTool(toolName, validParams)
      expect(result.isError).toBeTruthy()
    })

    it("should handle network failures", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fetch failed"))

      const result = await server.callTool(toolName, validParams)
      expect(result.isError).toBeTruthy()
    })

    it("should handle malformed JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      })

      const result = await server.callTool(toolName, validParams)
      expect(result.isError).toBeTruthy()
    })

    if (requiredParams?.length) {
      for (const param of requiredParams) {
        it(`should require ${param}`, async () => {
          const incomplete = { ...validParams }
          delete incomplete[param]

          await expect(
            server.callTool(toolName, incomplete)
          ).rejects.toThrow()
        })
      }
    }
  })
}
```

### 3. Example Usage

Show how a module test file becomes minimal using the helper:

```typescript
// src/modules/coingecko/coingecko.test.ts
import { describe } from "vitest"
import { createToolTests } from "../../../tests/helpers/createToolTests"
import { registerTools } from "./index"

describe("CoinGecko Tools", () => {
  createToolTests(registerTools, {
    toolName: "coingecko_price",
    validParams: { coinId: "bitcoin", currency: "usd" },
    mockSuccessResponse: { bitcoin: { usd: 65000 } },
    requiredParams: ["coinId"],
  })

  createToolTests(registerTools, {
    toolName: "coingecko_market_chart",
    validParams: { coinId: "ethereum", days: 7 },
    mockSuccessResponse: { prices: [[1234567890, 3500]] },
    requiredParams: ["coinId", "days"],
  })
})
```

## Verification

1. Copy the template to one untested module
2. Fill in the placeholders
3. Run `npm test -- src/modules/<module>/` — all tests should pass
4. Confirm the `createToolTests` helper generates 4-5 tests per tool automatically

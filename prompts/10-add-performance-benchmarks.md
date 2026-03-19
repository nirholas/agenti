# Prompt: Add Performance Benchmarks

## Objective

Add performance benchmarks to track tool execution time, server startup speed, and memory usage. Prevent performance regressions as the tool count grows from 380+ to 500+.

## Setup

### 1. Install vitest/bench

Vitest has built-in benchmark support — no extra dependencies needed.

### 2. Create Benchmark Config

Create `vitest.bench.config.ts`:

```typescript
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    benchmark: {
      include: ["tests/benchmarks/**/*.bench.ts"],
      reporters: ["default", "json"],
      outputFile: "reports/benchmarks/results.json",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
```

### 3. Create Benchmark Files

#### `tests/benchmarks/server-startup.bench.ts`

```typescript
import { describe, bench } from "vitest"

describe("Server Startup", () => {
  bench("register all tools", async () => {
    // Import and initialize the tool registry
    // This measures how long it takes to register 380+ tools
    const { createServer } = await import("@/server/index")
    const server = createServer()
  })

  bench("tool discovery (list all tools)", async () => {
    // Measure tools/list response time
    // AI agents call this on every connection
  })
})
```

#### `tests/benchmarks/tool-execution.bench.ts`

```typescript
import { describe, bench, beforeEach } from "vitest"
import { MockMcpServer } from "../mocks/mcp"
import { vi } from "vitest"

describe("Tool Execution Speed", () => {
  let server: MockMcpServer

  beforeEach(() => {
    server = new MockMcpServer()
    // Setup mocks so benchmarks don't hit real APIs
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ price: 65000 }),
    })
  })

  bench("market data tool", async () => {
    await server.callTool("get_crypto_price", { symbol: "BTC" })
  })

  bench("EVM balance check", async () => {
    await server.callTool("get_balance", {
      address: "0x0000000000000000000000000000000000000001",
      chain: "ethereum",
    })
  })

  bench("tool with Zod validation", async () => {
    // Measure the overhead of Zod schema validation
    await server.callTool("some_tool_with_complex_schema", {
      // complex params
    })
  })
})
```

#### `tests/benchmarks/memory-usage.bench.ts`

```typescript
import { describe, it, expect } from "vitest"

describe("Memory Usage", () => {
  it("should not exceed 200MB for full tool registry", () => {
    const before = process.memoryUsage().heapUsed

    // Import and register all tools
    // const { createServer } = require("@/server/index")
    // createServer()

    const after = process.memoryUsage().heapUsed
    const usedMB = (after - before) / 1024 / 1024

    console.log(`Memory used for tool registry: ${usedMB.toFixed(2)} MB`)
    expect(usedMB).toBeLessThan(200)
  })

  it("should not leak memory over repeated tool calls", async () => {
    const iterations = 1000
    const before = process.memoryUsage().heapUsed

    for (let i = 0; i < iterations; i++) {
      // Call a tool
    }

    // Force GC if available
    if (global.gc) global.gc()

    const after = process.memoryUsage().heapUsed
    const leakMB = (after - before) / 1024 / 1024

    console.log(`Memory delta after ${iterations} calls: ${leakMB.toFixed(2)} MB`)
    expect(leakMB).toBeLessThan(50) // Allow some growth, but not unbounded
  })
})
```

### 4. Add npm Scripts

```json
{
  "scripts": {
    "bench": "vitest bench --config vitest.bench.config.ts",
    "bench:report": "vitest bench --config vitest.bench.config.ts --reporter=json"
  }
}
```

### 5. Add to `.gitignore`

```
reports/benchmarks/
```

### 6. CI Job (Weekly, Not on Every PR)

```yaml
# .github/workflows/benchmarks.yml
name: Performance Benchmarks
on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday 6am UTC
  workflow_dispatch:

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run benchmarks
        run: npm run bench
      - name: Upload results
        uses: actions/upload-artifact@v7
        with:
          name: benchmark-results
          path: reports/benchmarks/
          retention-days: 90
```

## Key Metrics to Track

| Metric | Target | Why |
|--------|--------|-----|
| Server startup | < 2s | AI agents connect frequently |
| Tool list response | < 100ms | Called on every new session |
| Single tool execution | < 500ms (mocked) | Overhead beyond API latency |
| Memory for full registry | < 200MB | Server runs on constrained VMs |
| Memory leak per 1000 calls | < 50MB | Long-running server stability |

## Verification

```bash
npm run bench
```

Review the output for any tool taking unexpectedly long or using excessive memory.

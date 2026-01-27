/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nich.xbt
 *  ID: n1ch-0las-4e49-4348-786274000000
 * ═══════════════════════════════════════════════════════════════
 */

import { defineConfig } from "vitest/config"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "build"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/index.ts",
        "node_modules"
      ],
      thresholds: {
        lines: 10,
        functions: 10,
        branches: 5,
        statements: 10
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["default"],
    pool: "forks",
    forks: {
      singleFork: true
    }
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src")
    }
  }
})


/* EOF - nichxbt | 0.14.9.3 */
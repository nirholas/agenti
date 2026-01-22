import { defineConfig } from "vitest/config"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    exclude: ["node_modules", "dist", "build"],
    setupFiles: ["./tests/e2e/setup.ts"],
    // E2E tests need longer timeouts for real API calls and network operations
    testTimeout: 60000,
    hookTimeout: 60000,
    // Run tests sequentially to avoid rate limiting and resource conflicts
    pool: "forks",
    forks: {
      singleFork: true
    },
    // Disable parallelism for E2E tests
    sequence: {
      concurrent: false
    },
    reporters: ["default"],
    // Retry failed tests once (network flakiness)
    retry: 1
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src")
    }
  }
})

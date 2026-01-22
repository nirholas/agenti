/**
 * E2E Test Setup for Universal Crypto MCP
 * 
 * Provides server lifecycle management and utilities for end-to-end testing.
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { spawn, ChildProcess } from "child_process"
import { beforeAll, afterAll, afterEach, vi } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

// ============================================================================
// Types
// ============================================================================

export interface MCPServerHandle {
  client: Client
  transport: StdioClientTransport
  process: ChildProcess
}

export interface E2ETestConfig {
  timeout: number
  retries: number
  skipOnMissingEnv: string[]
}

// ============================================================================
// Configuration
// ============================================================================

export const E2E_CONFIG: E2ETestConfig = {
  timeout: 60000,
  retries: 1,
  skipOnMissingEnv: []
}

// Test network configurations
export const TEST_NETWORKS = {
  // Ethereum Sepolia Testnet
  SEPOLIA: {
    name: "sepolia",
    chainId: 11155111,
    rpcUrl: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    faucetUrl: "https://sepoliafaucet.com"
  },
  // BSC Testnet
  BSC_TESTNET: {
    name: "bsc-testnet",
    chainId: 97,
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorerUrl: "https://testnet.bscscan.com",
    faucetUrl: "https://testnet.binance.org/faucet-smart"
  },
  // Polygon Mumbai (deprecated but may still be useful for some tests)
  POLYGON_AMOY: {
    name: "polygon-amoy",
    chainId: 80002,
    rpcUrl: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    explorerUrl: "https://amoy.polygonscan.com",
    faucetUrl: "https://faucet.polygon.technology"
  }
}

// Well-known test addresses (no private keys needed for read operations)
export const TEST_ADDRESSES = {
  // Sepolia test addresses
  SEPOLIA: {
    // Vitalik's address (same across networks)
    VITALIK: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    // USDC on Sepolia (Circle's testnet USDC)
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    // WETH on Sepolia
    WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"
  },
  // BSC Testnet addresses
  BSC_TESTNET: {
    // Known active address on BSC testnet
    TEST_WALLET: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    // Wrapped BNB on BSC testnet
    WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"
  }
}

// ============================================================================
// Server Lifecycle Management
// ============================================================================

let serverHandle: MCPServerHandle | null = null

/**
 * Start the MCP server and connect as a client
 */
export async function startMCPServer(): Promise<MCPServerHandle> {
  // Spawn the server process
  const serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "ERROR"
    },
    stdio: ["pipe", "pipe", "pipe"]
  })

  // Create transport and client
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/index.ts"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "ERROR"
    }
  })

  const client = new Client({
    name: "e2e-test-client",
    version: "1.0.0"
  })

  // Connect to the server
  await client.connect(transport)

  const handle: MCPServerHandle = {
    client,
    transport,
    process: serverProcess
  }

  serverHandle = handle
  return handle
}

/**
 * Stop the MCP server and cleanup resources
 */
export async function stopMCPServer(handle?: MCPServerHandle): Promise<void> {
  const h = handle || serverHandle
  if (!h) return

  try {
    await h.client.close()
  } catch (error) {
    // Ignore close errors
  }

  try {
    await h.transport.close()
  } catch (error) {
    // Ignore close errors
  }

  if (h.process && !h.process.killed) {
    h.process.kill("SIGTERM")
    // Wait for process to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        h.process.kill("SIGKILL")
        resolve()
      }, 5000)

      h.process.on("exit", () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  if (h === serverHandle) {
    serverHandle = null
  }
}

/**
 * Get the current server handle
 */
export function getServerHandle(): MCPServerHandle | null {
  return serverHandle
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Check if a required environment variable is set
 */
export function hasEnvVar(name: string): boolean {
  return !!process.env[name] && process.env[name] !== ""
}

/**
 * Skip test if required API key is missing
 */
export function skipIfMissingApiKey(keyName: string): boolean {
  if (!hasEnvVar(keyName)) {
    console.log(`Skipping test: ${keyName} not set`)
    return true
  }
  return false
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 10000,
  interval = 100
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | null = null
  let delay = initialDelay

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
      }
    }
  }

  throw lastError
}

/**
 * Create a connected MCP client for testing
 */
export async function createTestClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/index.ts"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "ERROR"
    }
  })

  const client = new Client({
    name: "e2e-test-client",
    version: "1.0.0"
  })

  await client.connect(transport)
  return client
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a tool response is successful
 */
export function assertToolSuccess(result: unknown): asserts result is {
  content: Array<{ type: string; text: string }>
  isError?: boolean
} {
  if (!result || typeof result !== "object") {
    throw new Error("Expected tool result to be an object")
  }

  const r = result as { content?: unknown[]; isError?: boolean }
  
  if (r.isError === true) {
    const errorText = r.content?.[0] && typeof r.content[0] === "object" 
      ? (r.content[0] as { text?: string }).text 
      : "Unknown error"
    throw new Error(`Tool returned error: ${errorText}`)
  }

  if (!Array.isArray(r.content)) {
    throw new Error("Expected tool result to have content array")
  }
}

/**
 * Parse tool result text as JSON
 */
export function parseToolResult<T = unknown>(result: {
  content: Array<{ type: string; text: string }>
}): T {
  const textContent = result.content.find((c) => c.type === "text")
  if (!textContent || !textContent.text) {
    throw new Error("No text content in tool result")
  }
  return JSON.parse(textContent.text) as T
}

// ============================================================================
// Global Setup/Teardown
// ============================================================================

// Set test environment
beforeAll(() => {
  process.env.NODE_ENV = "test"
  // Don't suppress logs completely for E2E tests - we want to see what's happening
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || "WARN"
})

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})

// Global cleanup
afterAll(async () => {
  vi.restoreAllMocks()
  await stopMCPServer()
})

// ============================================================================
// Exports
// ============================================================================

export default {
  startMCPServer,
  stopMCPServer,
  getServerHandle,
  hasEnvVar,
  skipIfMissingApiKey,
  waitFor,
  retryWithBackoff,
  createTestClient,
  assertToolSuccess,
  parseToolResult,
  TEST_NETWORKS,
  TEST_ADDRESSES,
  E2E_CONFIG
}

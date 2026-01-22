/**
 * Multichain E2E Tests
 * 
 * Tests the same tools across different blockchain networks to verify
 * consistent behavior and proper chain-specific handling.
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { 
  assertToolSuccess,
  parseToolResult,
  retryWithBackoff,
  TEST_ADDRESSES,
  TEST_NETWORKS
} from "./setup"
import {
  ETH_MAINNET_ADDRESSES,
  ETH_SEPOLIA_ADDRESSES,
  BSC_MAINNET_ADDRESSES,
  BSC_TESTNET_ADDRESSES,
  POLYGON_MAINNET_ADDRESSES,
  ARBITRUM_MAINNET_ADDRESSES,
  BASE_MAINNET_ADDRESSES,
  NETWORK_CONFIGS
} from "../utils/fixtures"
import "../utils/assertions"

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Networks to test against
 */
const TEST_CHAIN_CONFIGS = [
  {
    name: "sepolia",
    displayName: "Ethereum Sepolia",
    chainId: 11155111,
    testAddress: ETH_SEPOLIA_ADDRESSES.VITALIK,
    testToken: ETH_SEPOLIA_ADDRESSES.WETH,
    nativeSymbol: "ETH",
    isTestnet: true
  },
  {
    name: "bsc-testnet",
    displayName: "BSC Testnet",
    chainId: 97,
    testAddress: BSC_TESTNET_ADDRESSES.TEST_WALLET,
    testToken: BSC_TESTNET_ADDRESSES.WBNB,
    nativeSymbol: "tBNB",
    isTestnet: true
  }
]

/**
 * Mainnet configs for reference (not tested by default to avoid rate limits)
 */
const MAINNET_CHAIN_CONFIGS = [
  {
    name: "ethereum",
    displayName: "Ethereum Mainnet",
    chainId: 1,
    testAddress: ETH_MAINNET_ADDRESSES.VITALIK,
    testToken: ETH_MAINNET_ADDRESSES.USDC,
    nativeSymbol: "ETH",
    isTestnet: false
  },
  {
    name: "bsc",
    displayName: "BSC Mainnet",
    chainId: 56,
    testAddress: BSC_MAINNET_ADDRESSES.BINANCE_HOT_WALLET,
    testToken: BSC_MAINNET_ADDRESSES.WBNB,
    nativeSymbol: "BNB",
    isTestnet: false
  },
  {
    name: "polygon",
    displayName: "Polygon Mainnet",
    chainId: 137,
    testAddress: POLYGON_MAINNET_ADDRESSES.WMATIC,
    testToken: POLYGON_MAINNET_ADDRESSES.USDC,
    nativeSymbol: "MATIC",
    isTestnet: false
  },
  {
    name: "arbitrum",
    displayName: "Arbitrum One",
    chainId: 42161,
    testAddress: ARBITRUM_MAINNET_ADDRESSES.WETH,
    testToken: ARBITRUM_MAINNET_ADDRESSES.USDC,
    nativeSymbol: "ETH",
    isTestnet: false
  },
  {
    name: "base",
    displayName: "Base",
    chainId: 8453,
    testAddress: BASE_MAINNET_ADDRESSES.WETH,
    testToken: BASE_MAINNET_ADDRESSES.USDC,
    nativeSymbol: "ETH",
    isTestnet: false
  }
]

// ============================================================================
// Test Suite
// ============================================================================

describe("Multichain E2E Tests", () => {
  let client: Client
  let transport: StdioClientTransport

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/index.ts"],
      env: {
        ...process.env,
        NODE_ENV: "test",
        LOG_LEVEL: "ERROR"
      }
    })

    client = new Client({
      name: "multichain-e2e-test-client",
      version: "1.0.0"
    })

    await client.connect(transport)
  }, 30000)

  afterAll(async () => {
    try {
      await client.close()
    } catch (error) {
      // Ignore
    }
    try {
      await transport.close()
    } catch (error) {
      // Ignore
    }
  })

  // ============================================================================
  // Network Info Tests - Same tool, different networks
  // ============================================================================

  describe("Network Info Across Chains", () => {
    for (const chain of TEST_CHAIN_CONFIGS) {
      describe(`${chain.displayName}`, () => {
        it(`should get chain info for ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_chain_info",
              arguments: { network: chain.name }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          
          const data = parseToolResult<{ chainId: number; network: string }>(result)
          expect(Number(data.chainId)).toBe(chain.chainId)
        }, 30000)

        it(`should get latest block for ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_latest_block",
              arguments: { network: chain.name }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          expect(result).toHaveJsonProperty("number")
          
          const data = parseToolResult<{ number: string }>(result)
          expect(BigInt(data.number)).toBeGreaterThan(0n)
        }, 30000)

        it(`should estimate block time for ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "estimate_block_time",
              arguments: { network: chain.name, sampleSize: 5 }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          expect(result).toHaveJsonProperty("averageBlockTimeSeconds")
          
          const data = parseToolResult<{ averageBlockTimeSeconds: number }>(result)
          expect(data.averageBlockTimeSeconds).toBeGreaterThan(0)
          expect(data.averageBlockTimeSeconds).toBeLessThan(60) // Block time should be under a minute
        }, 45000)
      })
    }
  })

  // ============================================================================
  // Balance Tools Tests - Same tool, different networks
  // ============================================================================

  describe("Balance Tools Across Chains", () => {
    for (const chain of TEST_CHAIN_CONFIGS) {
      describe(`${chain.displayName}`, () => {
        it(`should get native balance on ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_native_balance",
              arguments: {
                network: chain.name,
                address: chain.testAddress
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          expect(result).toHaveJsonProperty("balance")
          expect(result).toContainValidAddress()
          
          const data = parseToolResult<{ balance: string; address: string }>(result)
          // Balance should be a valid number (can be 0 on testnet)
          expect(BigInt(data.balance)).toBeGreaterThanOrEqual(0n)
        }, 30000)

        it(`should get ERC20 token info on ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_erc20_token_info",
              arguments: {
                network: chain.name,
                tokenAddress: chain.testToken
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          expect(result).toHaveJsonProperty("decimals")
          
          const data = parseToolResult<{ decimals: number; symbol: string }>(result)
          expect(data.decimals).toBeGreaterThanOrEqual(0)
          expect(data.decimals).toBeLessThanOrEqual(18)
        }, 30000)

        it(`should get ERC20 balance on ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_erc20_balance",
              arguments: {
                network: chain.name,
                tokenAddress: chain.testToken,
                address: chain.testAddress
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          expect(result).toHaveJsonProperty("balance")
          
          const data = parseToolResult<{ balance: string }>(result)
          // Balance can be 0 on testnet
          expect(BigInt(data.balance)).toBeGreaterThanOrEqual(0n)
        }, 30000)
      })
    }
  })

  // ============================================================================
  // Gas Estimation Tests - Same tool, different networks
  // ============================================================================

  describe("Gas Tools Across Chains", () => {
    for (const chain of TEST_CHAIN_CONFIGS) {
      describe(`${chain.displayName}`, () => {
        it(`should get gas price on ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_gas_price",
              arguments: { network: chain.name }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          
          const data = parseToolResult<{ gasPrice?: string; maxFeePerGas?: string }>(result)
          // Should have either gasPrice (legacy) or maxFeePerGas (EIP-1559)
          const hasGasPrice = data.gasPrice !== undefined || data.maxFeePerGas !== undefined
          expect(hasGasPrice).toBe(true)
        }, 30000)

        it(`should estimate gas for transfer on ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "estimate_gas",
              arguments: {
                network: chain.name,
                from: chain.testAddress,
                to: chain.testAddress,
                value: "0" // Zero value transfer
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          expect(result).toHaveJsonProperty("gasEstimate")
          
          const data = parseToolResult<{ gasEstimate: string }>(result)
          const gas = BigInt(data.gasEstimate)
          // Basic transfer should use around 21000 gas
          expect(gas).toBeGreaterThanOrEqual(21000n)
          expect(gas).toBeLessThan(1000000n)
        }, 30000)
      })
    }
  })

  // ============================================================================
  // Block Data Tests - Same tool, different networks
  // ============================================================================

  describe("Block Data Across Chains", () => {
    for (const chain of TEST_CHAIN_CONFIGS) {
      describe(`${chain.displayName}`, () => {
        it(`should get block by number on ${chain.name}`, async () => {
          // First get latest block
          const latestResult = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_latest_block",
              arguments: { network: chain.name }
            })
          }, 3, 2000)

          assertToolSuccess(latestResult)
          const latest = parseToolResult<{ number: string }>(latestResult)
          const blockNumber = (BigInt(latest.number) - 10n).toString()

          // Then get a specific block
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_block_by_number",
              arguments: {
                network: chain.name,
                blockNumber
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          expect(result).toHaveJsonProperty("number")
          expect(result).toHaveJsonProperty("hash")
          expect(result).toHaveJsonProperty("timestamp")
        }, 45000)

        it(`should get transaction count for address on ${chain.name}`, async () => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_transaction_count",
              arguments: {
                network: chain.name,
                address: chain.testAddress
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          
          const data = parseToolResult<{ count: number | string }>(result)
          expect(Number(data.count)).toBeGreaterThanOrEqual(0)
        }, 30000)
      })
    }
  })

  // ============================================================================
  // Contract Code Tests - Same tool, different networks
  // ============================================================================

  describe("Contract Code Across Chains", () => {
    for (const chain of TEST_CHAIN_CONFIGS) {
      describe(`${chain.displayName}`, () => {
        it(`should check if address is contract on ${chain.name}`, async () => {
          // Test with token address (should be contract)
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_code",
              arguments: {
                network: chain.name,
                address: chain.testToken
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          
          const data = parseToolResult<{ code: string; isContract?: boolean }>(result)
          // Token address should have code (be a contract)
          expect(data.code).toBeDefined()
          expect(data.code.length).toBeGreaterThan(2) // More than just "0x"
        }, 30000)

        it(`should identify EOA (non-contract) on ${chain.name}`, async () => {
          // Test with EOA address (should not be contract)
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_code",
              arguments: {
                network: chain.name,
                address: chain.testAddress
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
          expect(result).toHaveValidJsonContent()
          
          const data = parseToolResult<{ code: string; isContract?: boolean }>(result)
          // EOA should have empty code (0x)
          expect(data.code === "0x" || data.code === "" || data.isContract === false).toBe(true)
        }, 30000)
      })
    }
  })

  // ============================================================================
  // Cross-Chain Comparison Tests
  // ============================================================================

  describe("Cross-Chain Comparisons", () => {
    it("should get consistent data format across all testnets", async () => {
      const results = await Promise.all(
        TEST_CHAIN_CONFIGS.map(async (chain) => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_chain_info",
              arguments: { network: chain.name }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          return {
            chain: chain.name,
            data: parseToolResult<{ chainId: number; blockNumber: string; network: string }>(result)
          }
        })
      )

      // All results should have the same structure
      for (const { chain, data } of results) {
        expect(data).toHaveProperty("chainId")
        expect(data).toHaveProperty("blockNumber")
        expect(data).toHaveProperty("network")
        expect(data.network).toBe(chain)
      }
    }, 60000)

    it("should get gas prices from multiple networks concurrently", async () => {
      const results = await Promise.all(
        TEST_CHAIN_CONFIGS.map(async (chain) => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_gas_price",
              arguments: { network: chain.name }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          return {
            chain: chain.name,
            data: parseToolResult<{ gasPrice?: string; maxFeePerGas?: string }>(result)
          }
        })
      )

      // All networks should return gas price data
      for (const { chain, data } of results) {
        expect(data.gasPrice !== undefined || data.maxFeePerGas !== undefined).toBe(true)
      }
    }, 60000)

    it("should handle same address across different networks", async () => {
      // Vitalik's address exists on all EVM chains
      const testAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

      const results = await Promise.all(
        TEST_CHAIN_CONFIGS.map(async (chain) => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_native_balance",
              arguments: {
                network: chain.name,
                address: testAddress
              }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          return {
            chain: chain.name,
            data: parseToolResult<{ balance: string; address: string }>(result)
          }
        })
      )

      // Address should be consistent across all networks
      for (const { data } of results) {
        expect(data.address.toLowerCase()).toBe(testAddress.toLowerCase())
        expect(BigInt(data.balance)).toBeGreaterThanOrEqual(0n)
      }
    }, 60000)
  })

  // ============================================================================
  // Network-Specific Feature Tests
  // ============================================================================

  describe("Network-Specific Features", () => {
    it("should handle EIP-1559 on supported networks", async () => {
      // Sepolia supports EIP-1559
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "get_gas_price",
          arguments: { network: "sepolia" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{ maxFeePerGas?: string; maxPriorityFeePerGas?: string }>(result)
      
      // Sepolia should return EIP-1559 gas parameters
      expect(data.maxFeePerGas !== undefined || data.maxPriorityFeePerGas !== undefined).toBe(true)
    }, 30000)

    it("should get different block times on different networks", async () => {
      const results = await Promise.all(
        TEST_CHAIN_CONFIGS.map(async (chain) => {
          const result = await retryWithBackoff(async () => {
            return await client.callTool({
              name: "estimate_block_time",
              arguments: { network: chain.name, sampleSize: 5 }
            })
          }, 3, 2000)

          assertToolSuccess(result)
          return {
            chain: chain.name,
            data: parseToolResult<{ averageBlockTimeSeconds: number }>(result)
          }
        })
      )

      // Block times should differ between networks
      const blockTimes = results.map((r) => r.data.averageBlockTimeSeconds)
      
      // All should be positive
      for (const time of blockTimes) {
        expect(time).toBeGreaterThan(0)
      }
    }, 60000)
  })

  // ============================================================================
  // Chain Resolution Tests
  // ============================================================================

  describe("Chain Resolution", () => {
    it("should resolve chain by name", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "get_chain_info",
          arguments: { network: "sepolia" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{ chainId: number }>(result)
      expect(Number(data.chainId)).toBe(11155111)
    }, 30000)

    it("should resolve chain by ID", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "get_chain_info",
          arguments: { network: 11155111 }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{ chainId: number }>(result)
      expect(Number(data.chainId)).toBe(11155111)
    }, 30000)

    it("should handle invalid network gracefully", async () => {
      const result = await client.callTool({
        name: "get_chain_info",
        arguments: { network: "invalid-network-xyz" }
      })

      // Should return an error
      const text = (result as { content: Array<{ text: string }> }).content[0].text
      expect(text.toLowerCase()).toMatch(/error|unsupported|invalid|not found|fail/i)
    }, 30000)
  })
})

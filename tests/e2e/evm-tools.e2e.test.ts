/**
 * EVM Tools E2E Tests
 * 
 * Tests EVM tools against real testnets (Sepolia, BSC Testnet).
 * These tests make actual RPC calls to blockchain networks.
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { 
  TEST_ADDRESSES, 
  TEST_NETWORKS,
  assertToolSuccess,
  parseToolResult,
  skipIfMissingApiKey
} from "./setup"

describe("EVM Tools E2E Tests", () => {
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
      name: "evm-e2e-test-client",
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
  // Ethereum Sepolia Testnet Tests
  // ============================================================================
  
  describe("Ethereum Sepolia Testnet", () => {
    const network = "sepolia"

    describe("Network Tools", () => {
      it("should get chain info for Sepolia", async () => {
        const result = await client.callTool({
          name: "get_chain_info",
          arguments: { network }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          chainId: number
          blockNumber: string
          network: string
        }>(result)

        expect(data.network).toBe(network)
        expect(Number(data.chainId)).toBe(TEST_NETWORKS.SEPOLIA.chainId)
        expect(BigInt(data.blockNumber)).toBeGreaterThan(0n)
      })

      it("should estimate block time on Sepolia", async () => {
        const result = await client.callTool({
          name: "estimate_block_time",
          arguments: { 
            network,
            sampleSize: 10
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          averageBlockTimeSeconds: number
          blocksPerMinute: number
        }>(result)

        // Sepolia block time should be around 12 seconds
        expect(data.averageBlockTimeSeconds).toBeGreaterThan(5)
        expect(data.averageBlockTimeSeconds).toBeLessThan(30)
        expect(data.blocksPerMinute).toBeGreaterThan(0)
      })
    })

    describe("Balance Tools", () => {
      it("should get native balance for known address on Sepolia", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network,
            address: TEST_ADDRESSES.SEPOLIA.VITALIK
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          address: string
          balance: string
          formatted: string
        }>(result)

        expect(data.address.toLowerCase()).toBe(TEST_ADDRESSES.SEPOLIA.VITALIK.toLowerCase())
        expect(data.balance).toBeDefined()
        // Balance can be 0 or more on testnet
        expect(BigInt(data.balance)).toBeGreaterThanOrEqual(0n)
      })
    })

    describe("Token Tools", () => {
      it("should get WETH token info on Sepolia", async () => {
        const result = await client.callTool({
          name: "get_erc20_token_info",
          arguments: {
            network,
            tokenAddress: TEST_ADDRESSES.SEPOLIA.WETH
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          name: string
          symbol: string
          decimals: number
          totalSupply: string
        }>(result)

        expect(data.name).toBeDefined()
        expect(data.symbol).toBeDefined()
        expect(data.decimals).toBe(18)
      })

      it("should get ERC20 balance on Sepolia", async () => {
        const result = await client.callTool({
          name: "get_erc20_balance",
          arguments: {
            network,
            tokenAddress: TEST_ADDRESSES.SEPOLIA.WETH,
            address: TEST_ADDRESSES.SEPOLIA.VITALIK
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          balance: string
          formatted: string
        }>(result)

        expect(data.balance).toBeDefined()
        // Balance can be 0 on testnet
        expect(BigInt(data.balance)).toBeGreaterThanOrEqual(0n)
      })
    })
  })

  // ============================================================================
  // BSC Testnet Tests
  // ============================================================================

  describe("BSC Testnet", () => {
    const network = "bsc-testnet"

    describe("Network Tools", () => {
      it("should get chain info for BSC Testnet", async () => {
        const result = await client.callTool({
          name: "get_chain_info",
          arguments: { network }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          chainId: number
          blockNumber: string
          network: string
        }>(result)

        expect(data.network).toBe(network)
        expect(Number(data.chainId)).toBe(TEST_NETWORKS.BSC_TESTNET.chainId)
        expect(BigInt(data.blockNumber)).toBeGreaterThan(0n)
      })

      it("should estimate block time on BSC Testnet", async () => {
        const result = await client.callTool({
          name: "estimate_block_time",
          arguments: { 
            network,
            sampleSize: 10
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          averageBlockTimeSeconds: number
          blocksPerMinute: number
        }>(result)

        // BSC block time should be around 3 seconds
        expect(data.averageBlockTimeSeconds).toBeGreaterThan(1)
        expect(data.averageBlockTimeSeconds).toBeLessThan(15)
        expect(data.blocksPerMinute).toBeGreaterThan(0)
      })
    })

    describe("Balance Tools", () => {
      it("should get native balance for address on BSC Testnet", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network,
            address: TEST_ADDRESSES.BSC_TESTNET.TEST_WALLET
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          address: string
          balance: string
        }>(result)

        expect(data.address.toLowerCase()).toBe(TEST_ADDRESSES.BSC_TESTNET.TEST_WALLET.toLowerCase())
        expect(data.balance).toBeDefined()
      })
    })

    describe("Token Tools", () => {
      it("should get WBNB token info on BSC Testnet", async () => {
        const result = await client.callTool({
          name: "get_erc20_token_info",
          arguments: {
            network,
            tokenAddress: TEST_ADDRESSES.BSC_TESTNET.WBNB
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          name: string
          symbol: string
          decimals: number
        }>(result)

        expect(data.name).toBeDefined()
        expect(data.symbol).toBeDefined()
        expect(data.decimals).toBe(18)
      })
    })
  })

  // ============================================================================
  // Ethereum Mainnet Tests (Read-only)
  // ============================================================================

  describe("Ethereum Mainnet (Read-only)", () => {
    const network = "mainnet"

    describe("Network Tools", () => {
      it("should get chain info for Ethereum Mainnet", async () => {
        const result = await client.callTool({
          name: "get_chain_info",
          arguments: { network }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          chainId: number
          blockNumber: string
        }>(result)

        expect(Number(data.chainId)).toBe(1)
        expect(BigInt(data.blockNumber)).toBeGreaterThan(18000000n) // Block 18M was Sep 2023
      })

      it("should get finality status for recent block", async () => {
        const result = await client.callTool({
          name: "get_finality_status",
          arguments: { network }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          network: string
          finalityStatus: string
          confirmations: number
        }>(result)

        expect(data.network).toBe(network)
        expect(data.finalityStatus).toBeDefined()
        expect(typeof data.confirmations).toBe("number")
      })
    })

    describe("Token Tools", () => {
      it("should get USDC token info on Mainnet", async () => {
        // USDC on Ethereum mainnet
        const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        
        const result = await client.callTool({
          name: "get_erc20_token_info",
          arguments: {
            network,
            tokenAddress: USDC_ADDRESS
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          name: string
          symbol: string
          decimals: number
          totalSupply: string
        }>(result)

        expect(data.name).toContain("USD")
        expect(data.symbol).toBe("USDC")
        expect(data.decimals).toBe(6)
        expect(BigInt(data.totalSupply)).toBeGreaterThan(0n)
      })

      it("should get Vitalik ETH balance on Mainnet", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network,
            address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" // Vitalik
          }
        })

        assertToolSuccess(result)
        const data = parseToolResult<{
          balance: string
          formatted: string
        }>(result)

        // Vitalik should have some ETH
        expect(BigInt(data.balance)).toBeGreaterThan(0n)
      })
    })
  })

  // ============================================================================
  // Multi-Network Tests
  // ============================================================================

  describe("Multi-Network Operations", () => {
    it("should support multiple networks in parallel", async () => {
      const networks = ["mainnet", "bsc", "polygon"]
      
      const results = await Promise.all(
        networks.map((network) =>
          client.callTool({
            name: "get_chain_info",
            arguments: { network }
          })
        )
      )

      expect(results).toHaveLength(3)
      
      const chainIds = results.map((result) => {
        assertToolSuccess(result)
        const data = parseToolResult<{ chainId: number }>(result)
        return Number(data.chainId)
      })

      // Each network should have unique chain ID
      expect(chainIds[0]).toBe(1)   // Ethereum
      expect(chainIds[1]).toBe(56)  // BSC
      expect(chainIds[2]).toBe(137) // Polygon
    })

    it("should list all supported networks", async () => {
      const result = await client.callTool({
        name: "get_supported_networks",
        arguments: {}
      })

      assertToolSuccess(result)
      const data = parseToolResult<{ supportedNetworks: string[] }>(result)

      expect(data.supportedNetworks).toContain("mainnet")
      expect(data.supportedNetworks).toContain("bsc")
      expect(data.supportedNetworks.length).toBeGreaterThan(5)
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle invalid network gracefully", async () => {
      const result = await client.callTool({
        name: "get_chain_info",
        arguments: { network: "invalid-network-xyz" }
      })

      // Should return error, not throw
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      const textContent = result.content.find((c) => c.type === "text")
      if (textContent && "text" in textContent) {
        expect(
          result.isError === true || 
          textContent.text.toLowerCase().includes("error") ||
          textContent.text.toLowerCase().includes("unsupported")
        ).toBe(true)
      }
    })

    it("should handle invalid address format", async () => {
      const result = await client.callTool({
        name: "get_native_balance",
        arguments: {
          network: "mainnet",
          address: "not-a-valid-address"
        }
      })

      expect(result).toBeDefined()
      // Should indicate error in some way
      const textContent = result.content.find((c) => c.type === "text")
      if (textContent && "text" in textContent) {
        expect(
          result.isError === true || 
          textContent.text.toLowerCase().includes("error") ||
          textContent.text.toLowerCase().includes("invalid")
        ).toBe(true)
      }
    })

    it("should handle non-existent contract address", async () => {
      const result = await client.callTool({
        name: "get_erc20_token_info",
        arguments: {
          network: "mainnet",
          // Random address that's not a contract
          tokenAddress: "0x0000000000000000000000000000000000000001"
        }
      })

      expect(result).toBeDefined()
      // Should handle gracefully
    })
  })

  // ============================================================================
  // Write Operation Tests (Skipped by default - require test wallet)
  // ============================================================================

  describe.skip("Write Operations (requires PRIVATE_KEY)", () => {
    // These tests are skipped by default as they require a funded test wallet
    // To run these tests:
    // 1. Set PRIVATE_KEY env var with a testnet wallet private key
    // 2. Ensure the wallet has testnet tokens
    // 3. Run with: npm run test:e2e -- --grep "Write Operations"

    it.skip("should wrap native token on testnet", async () => {
      if (skipIfMissingApiKey("PRIVATE_KEY")) {
        return
      }

      const result = await client.callTool({
        name: "wrap_native_token",
        arguments: {
          network: "sepolia",
          amount: "0.001",
          privateKey: process.env.PRIVATE_KEY
        }
      })

      assertToolSuccess(result)
      const data = parseToolResult<{ transactionHash: string }>(result)
      expect(data.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it.skip("should transfer tokens on testnet", async () => {
      if (skipIfMissingApiKey("PRIVATE_KEY")) {
        return
      }

      const result = await client.callTool({
        name: "transfer_native",
        arguments: {
          network: "sepolia",
          to: TEST_ADDRESSES.SEPOLIA.VITALIK,
          amount: "0.0001",
          privateKey: process.env.PRIVATE_KEY
        }
      })

      assertToolSuccess(result)
      const data = parseToolResult<{ transactionHash: string }>(result)
      expect(data.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })
  })
})

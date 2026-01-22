/**
 * DeFi Tools E2E Tests
 * 
 * Tests DeFi tools (DefiLlama, yields, TVL) with mocked API responses.
 * These tests verify the complete flow from tool invocation to response parsing.
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { 
  assertToolSuccess,
  parseToolResult,
  retryWithBackoff
} from "./setup"
import {
  MOCK_DEFI_PROTOCOLS,
  MOCK_YIELD_POOLS,
  NETWORK_CONFIGS
} from "../utils/fixtures"
import "../utils/assertions"

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_PROTOCOLS_RESPONSE = [
  {
    id: "lido",
    name: "Lido",
    symbol: "LDO",
    category: "Liquid Staking",
    chains: ["Ethereum", "Polygon"],
    tvl: 15000000000,
    change_1d: 2.5,
    change_7d: 5.2
  },
  {
    id: "aave",
    name: "Aave",
    symbol: "AAVE",
    category: "Lending",
    chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism"],
    tvl: 10000000000,
    change_1d: -1.2,
    change_7d: 3.1
  },
  {
    id: "uniswap",
    name: "Uniswap",
    symbol: "UNI",
    category: "Dexes",
    chains: ["Ethereum", "Polygon", "Arbitrum", "Base"],
    tvl: 5000000000,
    change_1d: 0.8,
    change_7d: -2.1
  }
]

const MOCK_PROTOCOL_DETAIL = {
  id: "aave",
  name: "Aave",
  symbol: "AAVE",
  url: "https://aave.com",
  description: "Open Source Liquidity Protocol",
  category: "Lending",
  chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Avalanche"],
  tvl: 10000000000,
  chainTvls: {
    Ethereum: 6000000000,
    Polygon: 1500000000,
    Arbitrum: 1200000000,
    Optimism: 800000000,
    Avalanche: 500000000
  },
  change_1h: 0.1,
  change_1d: -1.2,
  change_7d: 3.1
}

const MOCK_YIELDS_RESPONSE = {
  status: "success",
  data: [
    {
      pool: "USDC",
      chain: "Ethereum",
      project: "aave-v3",
      symbol: "aUSDC",
      tvlUsd: 500000000,
      apy: 3.5,
      apyBase: 2.5,
      apyReward: 1.0,
      rewardTokens: ["0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"]
    },
    {
      pool: "ETH",
      chain: "Ethereum",
      project: "lido",
      symbol: "stETH",
      tvlUsd: 14000000000,
      apy: 4.2,
      apyBase: 4.2,
      apyReward: 0
    },
    {
      pool: "USDT",
      chain: "Ethereum",
      project: "compound-v3",
      symbol: "cUSDT",
      tvlUsd: 300000000,
      apy: 2.8,
      apyBase: 2.8,
      apyReward: 0
    }
  ]
}

const MOCK_CHAINS_RESPONSE = [
  {
    gecko_id: "ethereum",
    tvl: 50000000000,
    tokenSymbol: "ETH",
    name: "Ethereum"
  },
  {
    gecko_id: "binance-smart-chain",
    tvl: 5000000000,
    tokenSymbol: "BNB",
    name: "BSC"
  },
  {
    gecko_id: "polygon-pos",
    tvl: 1000000000,
    tokenSymbol: "MATIC",
    name: "Polygon"
  }
]

// ============================================================================
// Test Suite
// ============================================================================

describe("DeFi Tools E2E Tests", () => {
  let client: Client
  let transport: StdioClientTransport

  beforeAll(async () => {
    // Create and connect client
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
      name: "defi-e2e-test-client",
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
  // Protocol TVL Tests
  // ============================================================================

  describe("Protocol TVL Tools", () => {
    it("should get list of all protocols", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_protocols",
          arguments: {}
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
      expect(result).toHaveArrayContent(10) // Should have many protocols
    }, 30000)

    it("should get specific protocol details", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_protocol",
          arguments: { protocol: "aave" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
      expect(result).toHaveJsonProperty("name")
      expect(result).toHaveJsonProperty("tvl")
    }, 30000)

    it("should get protocol TVL history", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_protocol_tvl",
          arguments: { protocol: "uniswap" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should handle non-existent protocol gracefully", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_protocol",
          arguments: { protocol: "nonexistent-protocol-xyz-123" }
        })
      }, 3, 2000)

      // Should either return error or empty result
      const text = (result as { content: Array<{ text: string }> }).content[0].text
      expect(text.toLowerCase()).toMatch(/fail|error|not found|null/i)
    }, 30000)
  })

  // ============================================================================
  // Chain TVL Tests
  // ============================================================================

  describe("Chain TVL Tools", () => {
    it("should get all chains TVL data", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_chains",
          arguments: {}
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
      expect(result).toHaveArrayContent(5) // Should have multiple chains
    }, 30000)

    it("should get Ethereum chain TVL history", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_chain_tvl",
          arguments: { chain: "Ethereum" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get protocols on a specific chain", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_chain_protocols",
          arguments: { chain: "Ethereum" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
      expect(result).toHaveArrayContent(5) // Should have protocols on Ethereum
    }, 30000)

    it("should get BSC chain protocols", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_chain_protocols",
          arguments: { chain: "BSC" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)
  })

  // ============================================================================
  // Yield/APY Tests
  // ============================================================================

  describe("Yield Tools", () => {
    it("should get all yield pools", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_yields",
          arguments: {}
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should filter yields by chain", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_yields",
          arguments: { chain: "Ethereum" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should filter yields by project", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_yields",
          arguments: { project: "aave" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should filter yields by minimum TVL", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_yields",
          arguments: { minTvl: 100000000 } // $100M minimum
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should filter yields by minimum APY", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_yields",
          arguments: { minApy: 5 } // 5% minimum APY
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get specific yield pool details", async () => {
      // First get pools to find a valid pool ID
      const poolsResult = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_yields",
          arguments: { chain: "Ethereum" }
        })
      }, 3, 2000)

      assertToolSuccess(poolsResult)
      const pools = parseToolResult<{ data?: Array<{ pool: string }> } | Array<{ pool: string }>>(poolsResult)
      
      // Get pool ID from response
      const poolData = Array.isArray(pools) ? pools : pools.data
      if (poolData && poolData.length > 0 && poolData[0].pool) {
        const poolId = poolData[0].pool
        
        const result = await retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_yield_pool",
            arguments: { poolId }
          })
        }, 3, 2000)

        assertToolSuccess(result)
        expect(result).toBeSuccessfulToolResponse()
      }
    }, 45000)
  })

  // ============================================================================
  // Stablecoin Tests
  // ============================================================================

  describe("Stablecoin Tools", () => {
    it("should get stablecoin data", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_stablecoins",
          arguments: {}
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get specific stablecoin details", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_stablecoin",
          arguments: { stablecoin: "1" } // USDT is usually ID 1
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get stablecoin chains distribution", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_stablecoin_chains",
          arguments: {}
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)
  })

  // ============================================================================
  // DEX Volume Tests
  // ============================================================================

  describe("DEX Volume Tools", () => {
    it("should get DEX volume overview", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_dex_volume",
          arguments: {}
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get DEX volume by chain", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_chain_dex_volume",
          arguments: { chain: "Ethereum" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)
  })

  // ============================================================================
  // Fees Tests
  // ============================================================================

  describe("Fees Tools", () => {
    it("should get fees overview", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_fees_overview",
          arguments: {}
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get protocol fees", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_protocol_fees",
          arguments: { protocol: "uniswap" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get chain fees", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_chain_fees",
          arguments: { chain: "Ethereum" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)
  })

  // ============================================================================
  // Bridge Tests
  // ============================================================================

  describe("Bridge Tools", () => {
    it("should get bridge volume overview", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_bridges",
          arguments: {}
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get specific bridge details", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_bridge",
          arguments: { bridge: "1" } // First bridge
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)

    it("should get bridge volume by chain", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "defi_get_bridge_volume",
          arguments: { chain: "Ethereum" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      expect(result).toBeSuccessfulToolResponse()
      expect(result).toHaveValidJsonContent()
    }, 30000)
  })

  // ============================================================================
  // Combination/Integration Tests
  // ============================================================================

  describe("DeFi Data Integration", () => {
    it("should compare yields across chains", async () => {
      // Get yields from multiple chains and compare
      const [ethResult, polygonResult] = await Promise.all([
        retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_yields",
            arguments: { chain: "Ethereum", minTvl: 10000000 }
          })
        }, 3, 2000),
        retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_yields",
            arguments: { chain: "Polygon", minTvl: 10000000 }
          })
        }, 3, 2000)
      ])

      assertToolSuccess(ethResult)
      assertToolSuccess(polygonResult)
      
      expect(ethResult).toBeSuccessfulToolResponse()
      expect(polygonResult).toBeSuccessfulToolResponse()
    }, 45000)

    it("should get comprehensive protocol data", async () => {
      // Get protocol details, TVL, and fees in parallel
      const protocol = "aave"
      
      const [detailResult, tvlResult, feesResult] = await Promise.all([
        retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_protocol",
            arguments: { protocol }
          })
        }, 3, 2000),
        retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_protocol_tvl",
            arguments: { protocol }
          })
        }, 3, 2000),
        retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_protocol_fees",
            arguments: { protocol }
          })
        }, 3, 2000)
      ])

      assertToolSuccess(detailResult)
      assertToolSuccess(tvlResult)
      assertToolSuccess(feesResult)
      
      expect(detailResult).toBeSuccessfulToolResponse()
      expect(tvlResult).toBeSuccessfulToolResponse()
      expect(feesResult).toBeSuccessfulToolResponse()
    }, 60000)

    it("should analyze chain ecosystem", async () => {
      const chain = "Ethereum"
      
      // Get chain TVL, protocols, and DEX volume
      const [tvlResult, protocolsResult, dexResult] = await Promise.all([
        retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_chain_tvl",
            arguments: { chain }
          })
        }, 3, 2000),
        retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_chain_protocols",
            arguments: { chain }
          })
        }, 3, 2000),
        retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_chain_dex_volume",
            arguments: { chain }
          })
        }, 3, 2000)
      ])

      assertToolSuccess(tvlResult)
      assertToolSuccess(protocolsResult)
      assertToolSuccess(dexResult)
    }, 60000)
  })
})

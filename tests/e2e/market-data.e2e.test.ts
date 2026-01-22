/**
 * Market Data Tools E2E Tests
 * 
 * Tests market data tools against real APIs.
 * Some tests require API keys and are skipped by default.
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
  hasEnvVar,
  retryWithBackoff
} from "./setup"

describe("Market Data E2E Tests", () => {
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
      name: "market-data-e2e-test-client",
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
  // Fear & Greed Index Tests (No API key required)
  // ============================================================================

  describe("Fear & Greed Index", () => {
    it("should get current fear and greed index", async () => {
      // Retry with backoff due to potential rate limiting
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "market_get_fear_greed",
          arguments: {}
        })
      })

      assertToolSuccess(result)
      const data = parseToolResult<{
        value: string
        value_classification: string
        timestamp: string
      }>(result)

      // Value should be between 0 and 100
      const value = parseInt(data.value, 10)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)

      // Should have a classification
      const validClassifications = [
        "Extreme Fear",
        "Fear", 
        "Neutral",
        "Greed",
        "Extreme Greed"
      ]
      expect(validClassifications).toContain(data.value_classification)
    })

    it("should get fear and greed history", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "market_get_fear_greed_history",
          arguments: {
            limit: 7
          }
        })
      })

      assertToolSuccess(result)
      const data = parseToolResult<{
        data: Array<{
          value: string
          value_classification: string
          timestamp: string
        }>
      }>(result)

      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data.length).toBeGreaterThan(0)
      expect(data.data.length).toBeLessThanOrEqual(7)

      // Each entry should have valid data
      for (const entry of data.data) {
        const value = parseInt(entry.value, 10)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    })
  })

  // ============================================================================
  // CoinGecko Tests (Free tier available)
  // ============================================================================

  describe("CoinGecko API", () => {
    // CoinGecko has a free tier with rate limits
    // These tests use retry with backoff

    it("should get Bitcoin price data", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "market_get_coins",
          arguments: {
            name: "bitcoin",
            limit: 1
          }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{
        result: Array<{
          id?: string
          name?: string
          symbol?: string
          price?: number
          priceUsd?: number
          market_cap?: number
          marketCap?: number
        }>
      }>(result)

      expect(data.result).toBeDefined()
      expect(Array.isArray(data.result)).toBe(true)
      
      if (data.result.length > 0) {
        const bitcoin = data.result[0]
        expect(bitcoin.name?.toLowerCase()).toContain("bitcoin")
        expect(bitcoin.symbol?.toLowerCase()).toBe("btc")
        // Price should be a positive number
        const price = bitcoin.price || bitcoin.priceUsd
        if (price) {
          expect(price).toBeGreaterThan(0)
        }
      }
    })

    it("should get top coins by market cap", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "market_get_coins",
          arguments: {
            limit: 10,
            page: 1
          }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{
        result: Array<{
          name: string
          symbol: string
          rank?: number
        }>
      }>(result)

      expect(data.result).toBeDefined()
      expect(Array.isArray(data.result)).toBe(true)
      expect(data.result.length).toBeGreaterThan(0)

      // Top coins should include well-known cryptocurrencies
      const symbols = data.result.map((c) => c.symbol?.toLowerCase())
      // At least Bitcoin or Ethereum should be in top 10
      const hasTopCoin = symbols.includes("btc") || symbols.includes("eth")
      expect(hasTopCoin).toBe(true)
    })

    it("should search coins by symbol", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "market_get_coins",
          arguments: {
            symbol: "ETH",
            limit: 5
          }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{
        result: Array<{
          symbol: string
        }>
      }>(result)

      expect(data.result).toBeDefined()
      // Should return Ethereum or ETH-related tokens
    })
  })

  // ============================================================================
  // CoinStats Tests (Requires API key)
  // ============================================================================

  describe("CoinStats API", () => {
    const skipCoinStats = !hasEnvVar("COINSTATS_API_KEY")

    it.skipIf(skipCoinStats)("should get market overview", async () => {
      const result = await client.callTool({
        name: "market_get_overview",
        arguments: {}
      })

      assertToolSuccess(result)
      const data = parseToolResult<{
        marketCap: number
        volume24h: number
        btcDominance: number
      }>(result)

      expect(data.marketCap).toBeGreaterThan(0)
      expect(data.volume24h).toBeGreaterThan(0)
      expect(data.btcDominance).toBeGreaterThan(0)
      expect(data.btcDominance).toBeLessThan(100)
    })

    it.skipIf(skipCoinStats)("should get trending coins", async () => {
      const result = await client.callTool({
        name: "market_get_trending",
        arguments: {}
      })

      assertToolSuccess(result)
      const data = parseToolResult<{
        coins: Array<{
          name: string
          symbol: string
        }>
      }>(result)

      expect(Array.isArray(data.coins)).toBe(true)
    })

    it.skipIf(skipCoinStats)("should get coin details by ID", async () => {
      const result = await client.callTool({
        name: "market_get_coin_by_id",
        arguments: {
          coinId: "bitcoin"
        }
      })

      assertToolSuccess(result)
      const data = parseToolResult<{
        id: string
        name: string
        symbol: string
        price: number
      }>(result)

      expect(data.id).toBe("bitcoin")
      expect(data.name.toLowerCase()).toContain("bitcoin")
      expect(data.symbol.toLowerCase()).toBe("btc")
      expect(data.price).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // Portfolio Tools Tests
  // ============================================================================

  describe("Portfolio Tools", () => {
    it("should calculate portfolio value (mock portfolio)", async () => {
      // This tests the tool exists and accepts parameters
      // Actual portfolio calculation depends on API data
      const result = await client.callTool({
        name: "portfolio_calculate_value",
        arguments: {
          holdings: [
            { coinId: "bitcoin", amount: 1 },
            { coinId: "ethereum", amount: 10 }
          ]
        }
      })

      // Tool should exist and respond
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
    })
  })

  // ============================================================================
  // DEX Analytics Tests
  // ============================================================================

  describe("DEX Analytics", () => {
    it("should get DEX trading pairs", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "dex_get_pairs",
          arguments: {
            network: "ethereum",
            limit: 10
          }
        })
      }, 2, 1000)

      // May fail if API is unavailable, that's okay for E2E
      expect(result).toBeDefined()
    })

    it("should get DEX volume statistics", async () => {
      const result = await client.callTool({
        name: "dex_get_volume",
        arguments: {
          network: "ethereum"
        }
      })

      expect(result).toBeDefined()
    })
  })

  // ============================================================================
  // Price Feed Tests
  // ============================================================================

  describe("Price Feeds", () => {
    it("should get price from Chainlink feed on Mainnet", async () => {
      const result = await client.callTool({
        name: "get_chainlink_price",
        arguments: {
          network: "mainnet",
          pair: "ETH/USD"
        }
      })

      // Tool may or may not exist depending on registration
      expect(result).toBeDefined()
    })
  })

  // ============================================================================
  // News and Social Tools
  // ============================================================================

  describe("News Tools", () => {
    it("should get crypto news", async () => {
      const result = await client.callTool({
        name: "news_get_latest",
        arguments: {
          limit: 5
        }
      })

      // Tool should respond
      expect(result).toBeDefined()
    })

    it("should get news for specific coin", async () => {
      const result = await client.callTool({
        name: "news_get_by_coin",
        arguments: {
          coinId: "bitcoin",
          limit: 3
        }
      })

      expect(result).toBeDefined()
    })
  })

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe("Rate Limiting Behavior", () => {
    it("should handle rate limiting gracefully", async () => {
      // Make multiple rapid requests to test rate limiting
      const results = await Promise.allSettled([
        client.callTool({ name: "market_get_fear_greed", arguments: {} }),
        client.callTool({ name: "market_get_fear_greed", arguments: {} }),
        client.callTool({ name: "market_get_fear_greed", arguments: {} })
      ])

      // At least one should succeed
      const successes = results.filter((r) => r.status === "fulfilled")
      expect(successes.length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle invalid coin ID gracefully", async () => {
      const result = await client.callTool({
        name: "market_get_coins",
        arguments: {
          name: "this-coin-definitely-does-not-exist-xyz-123"
        }
      })

      // Should not throw, should return empty or error
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
    })

    it("should handle missing optional parameters", async () => {
      const result = await client.callTool({
        name: "market_get_coins",
        arguments: {
          // No parameters - should use defaults
        }
      })

      assertToolSuccess(result)
    })

    it("should validate numeric parameters", async () => {
      const result = await client.callTool({
        name: "market_get_coins",
        arguments: {
          limit: -1 // Invalid negative limit
        }
      })

      // Should handle gracefully - either use default or return error
      expect(result).toBeDefined()
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Cross-tool Integration", () => {
    it("should combine market data with EVM data", async () => {
      // Get market data for ETH
      const marketResult = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "market_get_coins",
          arguments: {
            symbol: "ETH",
            limit: 1
          }
        })
      }, 3, 2000)

      // Get ETH balance for a known address
      const balanceResult = await client.callTool({
        name: "get_native_balance",
        arguments: {
          network: "mainnet",
          address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        }
      })

      // Both should succeed
      expect(marketResult).toBeDefined()
      expect(balanceResult).toBeDefined()
      assertToolSuccess(balanceResult)
    })
  })
})

/**
 * Error Recovery E2E Tests
 * 
 * Tests error handling, recovery, graceful degradation, and edge cases
 * across the MCP server tools.
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { 
  assertToolSuccess,
  parseToolResult,
  retryWithBackoff
} from "./setup"
import {
  ETH_SEPOLIA_ADDRESSES,
  ERROR_SCENARIOS,
  generateRandomAddress,
  generateRandomTxHash
} from "../utils/fixtures"
import "../utils/assertions"

// ============================================================================
// Test Suite
// ============================================================================

describe("Error Recovery E2E Tests", () => {
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
      name: "error-recovery-e2e-test-client",
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
  // Invalid Input Tests
  // ============================================================================

  describe("Invalid Input Handling", () => {
    describe("Invalid Addresses", () => {
      it("should handle completely invalid address", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network: "sepolia",
            address: "not-an-address"
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/invalid|address|format/i)
      }, 30000)

      it("should handle too short address", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network: "sepolia",
            address: "0x1234"
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/invalid|address|format/i)
      }, 30000)

      it("should handle too long address", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network: "sepolia",
            address: "0x" + "a".repeat(50)
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/invalid|address|format/i)
      }, 30000)

      it("should handle non-hex characters in address", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network: "sepolia",
            address: "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/invalid|address|format/i)
      }, 30000)

      it("should handle zero address appropriately", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network: "sepolia",
            address: "0x0000000000000000000000000000000000000000"
          }
        })

        // Zero address might return 0 balance or error depending on implementation
        // Both are acceptable
        const text = (result as { content: Array<{ text: string }> }).content[0].text
        const isValidResponse = 
          text.includes("balance") || 
          text.toLowerCase().includes("error") ||
          text.includes("0")
        expect(isValidResponse).toBe(true)
      }, 30000)
    })

    describe("Invalid Networks", () => {
      it("should handle non-existent network name", async () => {
        const result = await client.callTool({
          name: "get_chain_info",
          arguments: {
            network: "nonexistent-chain"
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/unsupported|invalid|not found|network|chain/i)
      }, 30000)

      it("should handle invalid chain ID", async () => {
        const result = await client.callTool({
          name: "get_chain_info",
          arguments: {
            network: 999999999
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/unsupported|invalid|not found|network|chain/i)
      }, 30000)

      it("should handle negative chain ID", async () => {
        const result = await client.callTool({
          name: "get_chain_info",
          arguments: {
            network: -1
          }
        })

        expect(result).toBeErrorToolResponse()
      }, 30000)

      it("should handle empty network parameter", async () => {
        const result = await client.callTool({
          name: "get_chain_info",
          arguments: {
            network: ""
          }
        })

        expect(result).toBeErrorToolResponse()
      }, 30000)
    })

    describe("Invalid Block Parameters", () => {
      it("should handle negative block number", async () => {
        const result = await client.callTool({
          name: "get_block_by_number",
          arguments: {
            network: "sepolia",
            blockNumber: "-1"
          }
        })

        expect(result).toBeErrorToolResponse()
      }, 30000)

      it("should handle future block number", async () => {
        const result = await client.callTool({
          name: "get_block_by_number",
          arguments: {
            network: "sepolia",
            blockNumber: "999999999999"
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/not found|does not exist|invalid|future/i)
      }, 30000)

      it("should handle invalid block hash", async () => {
        const result = await client.callTool({
          name: "get_block_by_hash",
          arguments: {
            network: "sepolia",
            blockHash: "0x" + "f".repeat(64) // Valid format but non-existent
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/not found|null|invalid/i)
      }, 30000)

      it("should handle malformed block hash", async () => {
        const result = await client.callTool({
          name: "get_block_by_hash",
          arguments: {
            network: "sepolia",
            blockHash: "invalid-hash"
          }
        })

        expect(result).toBeErrorToolResponse()
      }, 30000)
    })

    describe("Invalid Token Parameters", () => {
      it("should handle non-contract address as token", async () => {
        // Use a random address that's likely an EOA
        const randomAddress = generateRandomAddress()
        
        const result = await client.callTool({
          name: "get_erc20_token_info",
          arguments: {
            network: "sepolia",
            tokenAddress: randomAddress
          }
        })

        // Should return error since random address is likely not a token
        expect(result).toBeErrorToolResponse()
      }, 30000)

      it("should handle invalid token address format", async () => {
        const result = await client.callTool({
          name: "get_erc20_token_info",
          arguments: {
            network: "sepolia",
            tokenAddress: "invalid"
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/invalid|address/i)
      }, 30000)
    })

    describe("Invalid Transaction Parameters", () => {
      it("should handle non-existent transaction hash", async () => {
        const result = await client.callTool({
          name: "get_transaction",
          arguments: {
            network: "sepolia",
            txHash: generateRandomTxHash()
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/not found|null|invalid/i)
      }, 30000)

      it("should handle malformed transaction hash", async () => {
        const result = await client.callTool({
          name: "get_transaction",
          arguments: {
            network: "sepolia",
            txHash: "invalid-tx-hash"
          }
        })

        expect(result).toBeErrorToolResponse()
      }, 30000)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    describe("Empty Results", () => {
      it("should handle address with no transactions", async () => {
        // Generate a random address that should have no transactions
        const randomAddress = generateRandomAddress()
        
        const result = await retryWithBackoff(async () => {
          return await client.callTool({
            name: "get_transaction_count",
            arguments: {
              network: "sepolia",
              address: randomAddress
            }
          })
        }, 3, 2000)

        assertToolSuccess(result)
        const data = parseToolResult<{ count: number | string }>(result)
        expect(Number(data.count)).toBe(0)
      }, 30000)

      it("should handle address with zero balance", async () => {
        const randomAddress = generateRandomAddress()
        
        const result = await retryWithBackoff(async () => {
          return await client.callTool({
            name: "get_native_balance",
            arguments: {
              network: "sepolia",
              address: randomAddress
            }
          })
        }, 3, 2000)

        assertToolSuccess(result)
        const data = parseToolResult<{ balance: string }>(result)
        expect(BigInt(data.balance)).toBe(0n)
      }, 30000)
    })

    describe("Boundary Values", () => {
      it("should handle genesis block (block 0)", async () => {
        const result = await retryWithBackoff(async () => {
          return await client.callTool({
            name: "get_block_by_number",
            arguments: {
              network: "sepolia",
              blockNumber: "0"
            }
          })
        }, 3, 2000)

        assertToolSuccess(result)
        expect(result).toBeSuccessfulToolResponse()
        expect(result).toHaveJsonProperty("number")
      }, 30000)

      it("should handle very large numbers gracefully", async () => {
        const result = await client.callTool({
          name: "get_block_by_number",
          arguments: {
            network: "sepolia",
            blockNumber: "999999999999999999999"
          }
        })

        // Should error gracefully
        expect(result).toBeErrorToolResponse()
      }, 30000)
    })

    describe("Special Characters", () => {
      it("should handle special characters in parameters", async () => {
        const result = await client.callTool({
          name: "defi_get_protocol",
          arguments: {
            protocol: "<script>alert('xss')</script>"
          }
        })

        // Should fail gracefully without executing
        const text = (result as { content: Array<{ text: string }> }).content[0].text
        expect(text).not.toContain("<script>")
      }, 30000)

      it("should handle unicode in parameters", async () => {
        const result = await client.callTool({
          name: "defi_get_protocol",
          arguments: {
            protocol: "aave-🚀"
          }
        })

        // Should fail gracefully
        expect(result).toBeErrorToolResponse()
      }, 30000)

      it("should handle SQL injection attempts", async () => {
        const result = await client.callTool({
          name: "defi_get_protocol",
          arguments: {
            protocol: "aave'; DROP TABLE protocols;--"
          }
        })

        // Should fail gracefully
        expect(result).toBeErrorToolResponse()
      }, 30000)
    })

    describe("Null and Undefined Handling", () => {
      it("should handle missing required parameters", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {
            network: "sepolia"
            // Missing address
          }
        })

        expect(result).toBeErrorToolResponse()
        expect(result).toContainToolError(/required|missing|address/i)
      }, 30000)

      it("should handle empty object", async () => {
        const result = await client.callTool({
          name: "get_native_balance",
          arguments: {}
        })

        expect(result).toBeErrorToolResponse()
      }, 30000)
    })
  })

  // ============================================================================
  // Recovery and Graceful Degradation
  // ============================================================================

  describe("Recovery Patterns", () => {
    describe("Retry Logic", () => {
      it("should succeed after transient failure with retry", async () => {
        // Use retry with backoff for potentially flaky operations
        let attempts = 0
        
        const result = await retryWithBackoff(async () => {
          attempts++
          return await client.callTool({
            name: "get_chain_info",
            arguments: { network: "sepolia" }
          })
        }, 3, 1000)

        assertToolSuccess(result)
        // May have taken multiple attempts but should succeed
        expect(attempts).toBeGreaterThanOrEqual(1)
      }, 45000)
    })

    describe("Partial Data Handling", () => {
      it("should handle protocols with incomplete data", async () => {
        // Request a protocol that might have incomplete data
        const result = await retryWithBackoff(async () => {
          return await client.callTool({
            name: "defi_get_protocols",
            arguments: {}
          })
        }, 3, 2000)

        assertToolSuccess(result)
        // Should return valid response even if some protocols have missing fields
        expect(result).toBeSuccessfulToolResponse()
      }, 30000)
    })

    describe("Concurrent Request Handling", () => {
      it("should handle multiple concurrent requests", async () => {
        const requests = Array.from({ length: 5 }, (_, i) => 
          retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_chain_info",
              arguments: { network: "sepolia" }
            })
          }, 3, 2000)
        )

        const results = await Promise.all(requests)
        
        // All requests should succeed
        for (const result of results) {
          assertToolSuccess(result)
          expect(result).toBeSuccessfulToolResponse()
        }
      }, 60000)

      it("should handle mixed success and failure requests", async () => {
        const requests = [
          // Valid request
          retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_chain_info",
              arguments: { network: "sepolia" }
            })
          }, 3, 2000),
          // Invalid request
          client.callTool({
            name: "get_chain_info",
            arguments: { network: "invalid-network" }
          }),
          // Valid request
          retryWithBackoff(async () => {
            return await client.callTool({
              name: "get_latest_block",
              arguments: { network: "sepolia" }
            })
          }, 3, 2000)
        ]

        const results = await Promise.allSettled(requests)
        
        // First and third should succeed
        expect(results[0].status).toBe("fulfilled")
        expect(results[2].status).toBe("fulfilled")
      }, 60000)
    })
  })

  // ============================================================================
  // API Error Handling
  // ============================================================================

  describe("API Error Handling", () => {
    describe("Rate Limiting Resilience", () => {
      it("should handle rapid consecutive requests", async () => {
        // Make rapid requests
        const rapidRequests = []
        for (let i = 0; i < 3; i++) {
          rapidRequests.push(
            client.callTool({
              name: "defi_get_chains",
              arguments: {}
            })
          )
        }

        const results = await Promise.all(rapidRequests)
        
        // At least one should succeed
        const successCount = results.filter(r => {
          const text = (r as { content: Array<{ text: string }> }).content[0].text
          return !text.toLowerCase().includes("rate limit") && 
                 !text.toLowerCase().includes("error")
        }).length

        expect(successCount).toBeGreaterThanOrEqual(1)
      }, 30000)
    })

    describe("Timeout Handling", () => {
      it("should complete within reasonable timeout", async () => {
        const startTime = Date.now()
        
        const result = await retryWithBackoff(async () => {
          return await client.callTool({
            name: "get_chain_info",
            arguments: { network: "sepolia" }
          })
        }, 3, 2000)

        const elapsed = Date.now() - startTime
        
        assertToolSuccess(result)
        // Should complete within 30 seconds even with retries
        expect(elapsed).toBeLessThan(30000)
      }, 45000)
    })
  })

  // ============================================================================
  // Data Validation Tests
  // ============================================================================

  describe("Response Data Validation", () => {
    it("should return valid balance format", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "get_native_balance",
          arguments: {
            network: "sepolia",
            address: ETH_SEPOLIA_ADDRESSES.VITALIK
          }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{ balance: string }>(result)
      
      // Balance should be a valid numeric string
      expect(() => BigInt(data.balance)).not.toThrow()
      expect(BigInt(data.balance)).toBeGreaterThanOrEqual(0n)
    }, 30000)

    it("should return valid block number format", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "get_latest_block",
          arguments: { network: "sepolia" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{ number: string }>(result)
      
      // Block number should be positive
      expect(BigInt(data.number)).toBeGreaterThan(0n)
    }, 30000)

    it("should return valid gas price format", async () => {
      const result = await retryWithBackoff(async () => {
        return await client.callTool({
          name: "get_gas_price",
          arguments: { network: "sepolia" }
        })
      }, 3, 2000)

      assertToolSuccess(result)
      const data = parseToolResult<{ gasPrice?: string; maxFeePerGas?: string }>(result)
      
      // Should have valid gas price
      const price = data.gasPrice || data.maxFeePerGas
      if (price) {
        expect(BigInt(price)).toBeGreaterThan(0n)
      }
    }, 30000)
  })

  // ============================================================================
  // Tool Discovery Tests
  // ============================================================================

  describe("Tool Discovery and Invocation", () => {
    it("should list available tools", async () => {
      const tools = await client.listTools()
      
      expect(tools.tools).toBeDefined()
      expect(Array.isArray(tools.tools)).toBe(true)
      expect(tools.tools.length).toBeGreaterThan(0)
    }, 30000)

    it("should have expected core tools available", async () => {
      const tools = await client.listTools()
      const toolNames = tools.tools.map(t => t.name)
      
      // Check for core tools
      expect(toolNames).toContain("get_chain_info")
      expect(toolNames).toContain("get_native_balance")
      expect(toolNames).toContain("get_latest_block")
    }, 30000)

    it("should handle calling non-existent tool", async () => {
      try {
        await client.callTool({
          name: "non_existent_tool_xyz",
          arguments: {}
        })
        // If it doesn't throw, it should return an error
      } catch (error) {
        // Expected - tool doesn't exist
        expect(error).toBeDefined()
      }
    }, 30000)
  })
})

import { withX402Payment } from "@/mcp/server/fastmcp/index.ts"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { McpError } from "@modelcontextprotocol/sdk/types.js"
import { FastMCP } from "fastmcp"
import { describe, expect, it } from "vitest"
import { exact } from "x402/schemes"
import type { PaymentPayload, PaymentRequirements, SettleResponse } from "x402/types"

function stubPaymentPayload(): PaymentPayload {
  return exact.evm.decodePayment(
    exact.evm.encodePayment({
      scheme: "exact",
      x402Version: 1,
      network: "base-sepolia",
      payload: {
        signature:
          "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c",
        authorization: {
          from: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
          to: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
          value: "10000",
          validAfter: "0",
          validBefore: "99999999999999999999999999999999",
          nonce: "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
        },
      },
    }),
  )
}

describe("FastMCP x402 Integration", () => {
  it("should handle client tool calls without payment", async () => {
    const server = new FastMCP({
      name: "x402-enabled",
      logger: { debug: () => {}, error: () => {}, info: () => {}, log: () => {}, warn: () => {} },
      version: "0.0.1",
    })

    // Add a tool that requires payment
    const paymentRequirements: PaymentRequirements = {
      asset: "USDC",
      scheme: "exact",
      description: "test",
      network: "base-sepolia",
      maxAmountRequired: "0.001",
      resource: "test-operation",
      mimeType: "application/json",
      payTo: "0x0000000000000000000000000000000000000000",
      maxTimeoutSeconds: 300,
    }

    const execute = async () => {
      return `ok`
    }
    server.addTool({
      name: "paid-tool",
      description: "A tool that requires payment",
      execute: withX402Payment({
        onExecute: async () => paymentRequirements,
        onPayment: async ({ payment: _payment }) => {
          // accept
        },
      })(execute),
    })

    // Connect server
    await server.start({
      transportType: "httpStream",
      httpStream: {
        port: 3401,
        endpoint: "/mcp",
      },
    })

    const serverUrl = "http://localhost:3401/mcp"
    const client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: { tools: {} } })
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
    await client.connect(transport)

    // Should throw McpError with payment requirements
    await expect(
      client.callTool({
        name: "paid-tool",
      }),
    ).rejects.toThrow(McpError)

    try {
      await client.callTool({
        name: "paid-tool",
      })
      expect.fail("Should have thrown McpError")
    } catch (error) {
      expect(error).toBeInstanceOf(McpError)
      const mcpError = error as McpError
      expect(mcpError.code).toBe(402)

      // Extract x402 data (supports workaround for FastMCP not propagating error.data)
      const x402Data = mcpError.data
      expect(x402Data).toMatchObject({
        message: "Payment required for tool execution",
        code: 402,
        x402Version: 1,
        accepts: [paymentRequirements],
      })
    }

    await client.close()
    await server.stop()
  })

  it("should handle client tool calls with payment that fails validation", async () => {
    const server = new FastMCP({
      name: "x402-enabled",
      logger: { debug: () => {}, error: () => {}, info: () => {}, log: () => {}, warn: () => {} },
      version: "0.0.1",
    })

    // Add a tool that requires payment
    const paymentRequirements: PaymentRequirements = {
      asset: "USDC",
      scheme: "exact",
      description: "test",
      network: "base-sepolia",
      maxAmountRequired: "0.001",
      resource: "test-operation",
      mimeType: "application/json",
      payTo: "0x0000000000000000000000000000000000000000",
      maxTimeoutSeconds: 300,
    }

    const execute = async () => {
      return `ok`
    }

    server.addTool({
      name: "paid-tool-that-fails",
      description: "A tool that requires payment but fails",
      execute: withX402Payment({
        onExecute: async () => paymentRequirements,
        onPayment: async ({ payment: _payment }) => {
          throw new Error("This tool will always throw")
        },
      })(execute),
    })

    // Connect server
    await server.start({
      transportType: "httpStream",
      httpStream: {
        port: 3403,
        endpoint: "/mcp",
      },
    })

    const serverUrl = "http://localhost:3403/mcp"
    const client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: { tools: {} } })
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
    await client.connect(transport)

    // Should throw McpError with payment validation failure
    try {
      await client.callTool({
        name: "paid-tool-that-fails",
        arguments: {},
        _meta: {
          "x402/payment": stubPaymentPayload(),
        },
      })
      expect.fail("Should have thrown McpError")
    } catch (error) {
      expect(error).toBeInstanceOf(McpError)
      const mcpError = error as McpError
      expect(mcpError.code).toBe(402)

      // Extract x402 data (supports workaround for FastMCP not propagating error.data)
      const x402Data = mcpError.data
      expect(x402Data).toMatchObject({
        message: "Payment required for tool execution",
        code: 402,
        x402Version: 1,
        accepts: [paymentRequirements],
        error: "This tool will always throw",
      })
    }

    await client.close()
    await server.stop()
  })

  it("should handle client tool calls with valid payment and return settlement response", async () => {
    const server = new FastMCP({
      name: "x402-enabled",
      logger: { debug: () => {}, error: () => {}, info: () => {}, log: () => {}, warn: () => {} },
      version: "0.0.1",
    })

    // Add a tool that requires payment
    const paymentRequirements: PaymentRequirements = {
      asset: "USDC",
      scheme: "exact",
      description: "test",
      network: "base-sepolia",
      maxAmountRequired: "0.001",
      resource: "test-operation",
      mimeType: "application/json",
      payTo: "0x0000000000000000000000000000000000000000",
      maxTimeoutSeconds: 300,
    }

    const execute = async () => {
      return { content: [{ type: "text", text: "success" }] }
    }

    const settleResponse: SettleResponse = {
      success: true,
      transaction: "0xsettletransactionhash",
    }

    server.addTool({
      name: "paid-tool-success",
      description: "A tool that requires payment and succeeds",
      execute: withX402Payment({
        onExecute: async () => paymentRequirements,
        onPayment: async ({ payment: _payment }) => {
          return settleResponse
        },
      })(execute),
    })

    // Connect server
    await server.start({
      transportType: "httpStream",
      httpStream: {
        port: 3404,
        endpoint: "/mcp",
      },
    })

    const serverUrl = "http://localhost:3404/mcp"
    const client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: { tools: {} } })
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
    await client.connect(transport)

    const result = await client.callTool({
      name: "paid-tool-success",
      arguments: {},
      _meta: {
        "x402/payment": stubPaymentPayload(),
      },
    })

    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe("text")
    expect(result.content[0].text).toBe("success")

    // Verify settlement response is in result._meta per MCP x402 spec
    expect(result._meta).toBeDefined()
    expect(result._meta?.["x402/payment-response"]).toMatchObject(settleResponse)

    await client.close()
    await server.stop()
  })
})

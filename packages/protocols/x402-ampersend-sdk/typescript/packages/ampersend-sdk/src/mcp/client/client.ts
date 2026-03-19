import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js"
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js"
import {
  McpError,
  type CallToolRequest,
  type CallToolResult,
  type CallToolResultSchema,
  type CompatibilityCallToolResult,
  type CompatibilityCallToolResultSchema,
  type Implementation,
  type ReadResourceRequest,
  type ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js"
import type { PaymentRequirements } from "x402/types"

import type { Authorization, X402Treasurer } from "../../x402/treasurer.ts"
import { asX402Response } from "./protocol.ts"
import type { ClientOptions, X402Response } from "./types.ts"

type OpParams = CallToolRequest["params"] | ReadResourceRequest["params"]

/**
 * MCP Client with transparent x402 payment support.
 *
 * Automatically handles HTTP 402 payment responses by calling the user-provided
 * payment callback and retrying requests with payment information.
 *
 * @example
 * ```typescript
 * import { Client, StreamableHTTPClientTransport } from "../mcp-client/index.ts"
 * import { NaiveTreasurer, AccountWallet } from "../core/index.ts"
 *
 * const wallet = AccountWallet.fromPrivateKey("0x...")
 * const treasurer = new NaiveTreasurer(wallet)
 *
 * const client = new Client(
 *   { name: "MyApp", version: "1.0.0" },
 *   {
 *     mcpOptions: { capabilities: { tools: {} } },
 *     treasurer
 *   }
 * )
 *
 * const transport = new StreamableHTTPClientTransport(new URL("https://api.example.com/mcp"))
 * await client.connect(transport)
 * ```
 */
export class Client extends McpClient {
  private readonly treasurer: X402Treasurer

  constructor(clientInfo: Implementation, options: ClientOptions) {
    super(clientInfo, options.mcpOptions)
    this.treasurer = options.treasurer
  }

  /**
   * Call a tool with automatic payment retry on 402 responses.
   *
   * @param params - Tool call parameters
   * @param resultSchema - Optional result schema for validation
   * @param options - Optional request options
   * @returns Promise resolving to tool result
   */
  async callTool(
    params: CallToolRequest["params"],
    resultSchema?: typeof CallToolResultSchema | typeof CompatibilityCallToolResultSchema,
    options?: RequestOptions,
  ): Promise<CallToolResult | CompatibilityCallToolResult> {
    return this.withPaymentRetry("tools/call", params, (p) =>
      super.callTool(p as CallToolRequest["params"], resultSchema, options),
    )
  }

  /**
   * Read a resource with automatic payment retry on 402 responses.
   *
   * @param params - Resource read parameters
   * @param options - Optional request options
   * @returns Promise resolving to resource data
   */
  async readResource(params: ReadResourceRequest["params"], options?: RequestOptions): Promise<ReadResourceResult> {
    return this.withPaymentRetry("resources/read", params, (p) =>
      super.readResource(p as ReadResourceRequest["params"], options),
    )
  }

  /**
   * Wrapper that handles payment retry logic for MCP methods
   */
  private async withPaymentRetry<T>(
    method: string,
    params: OpParams,
    operation: (params: OpParams) => Promise<T>,
  ): Promise<T> {
    try {
      return await operation(params)
    } catch (error) {
      // Extract x402 data from error (if this is a payment required error)
      const data = this.x402DataFromError(error)
      if (!data) {
        throw error
      }

      const paymentResult = await this.decidePayment(method, params, data.accepts)
      if (!paymentResult) {
        // Payment declined
        throw error
      }

      const { authorization, paramsWithPayment } = paymentResult
      try {
        await this.treasurer.onStatus("sending", authorization)
        const result = await operation(paramsWithPayment)
        this.treasurer.onStatus("accepted", authorization)
        return result
      } catch (retryError) {
        // Check if retry error is also a payment error, if so it means payment was rejected
        const retryData = this.x402DataFromError(retryError)
        if (retryData) {
          this.treasurer.onStatus("rejected", authorization)
        } else {
          this.treasurer.onStatus("error", authorization)
        }
        throw retryError
      }
    }
  }

  /**
   * Decides x402 payment request and return modified params if payment approved
   */
  private async decidePayment(
    method: string,
    params: OpParams,
    requirements: ReadonlyArray<PaymentRequirements>,
  ): Promise<{ paramsWithPayment: OpParams; authorization: Authorization } | null> {
    // Build payment context
    const paymentContext = {
      method,
      params,
    }

    // Get payment decision from treasurer
    const authorization = await this.treasurer.onPaymentRequired(requirements, paymentContext)

    if (!authorization) {
      // Payment declined
      return null
    }

    // Return modified params with payment (using spec-compliant field name)
    const baseMeta = params._meta || {}
    const paramsWithPayment = {
      ...params,
      _meta: {
        ...baseMeta,
        "x402/payment": authorization.payment,
      },
    }

    return { paramsWithPayment, authorization }
  }

  /**
   * Extract x402 response from MCP error
   *
   * Workaround: Tries to parse x402 data from error message as fallback when
   * error.data is undefined (FastMCP issue). This supports the server-side
   * workaround that embeds data as JSON in the message.
   */
  private x402DataFromError(error: unknown): X402Response | null {
    if (!(error instanceof McpError) || error.code !== 402) {
      return null
    }

    // Try using the data field first (when MCP SDK works correctly)
    if (error.data) {
      return asX402Response(error.data)
    }

    return null
  }
}

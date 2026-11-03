/**
 * Calling paid MCP tools on other servers.
 *
 * Wraps the official `@x402/mcp` client with agenti's wallets: when a remote
 * tool answers with an x402 `PaymentRequired` result, the payment is signed
 * (EVM or Solana, within the spend limits) and the call is retried with it in
 * `_meta["x402/payment"]`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { wrapMCPClientWithPayment, type PaymentRequestedContext, type x402MCPClient } from '@x402/mcp'
import type { SpendControls } from '@x402/core/client'
import { createAgentiX402Client } from '@agenti/sdk'
import type { EVMWallet, SolanaWallet } from '@agenti/core'

export interface PaidMcpClientOptions {
  evm?: EVMWallet
  solana?: SolanaWallet
  /** Ceiling per tool call in the asset's smallest unit ("1000000" = 1 USDC). Replaces the $1 default cap. */
  maxAmount?: string | bigint
  /** Reference-client spend controls. Defaults to well-known stablecoins and $1 per call. */
  spendControls?: SpendControls | false
  solanaRpcUrl?: string
  /** Approve or refuse each payment before it is signed. Defaults to approving within the limits. */
  onPaymentRequested?: (context: PaymentRequestedContext) => Promise<boolean> | boolean
  /** Client name reported to the server. */
  name?: string
}

/** Wraps a connected or unconnected MCP client so paid tool calls are paid automatically. */
export function withAgentiPayments(client: Client, options: PaidMcpClientOptions): x402MCPClient {
  if (!options.evm && !options.solana) {
    throw new Error('A paid MCP client needs an EVM or Solana wallet to pay with.')
  }
  const payments = createAgentiX402Client({
    ...(options.evm ? { evm: options.evm } : {}),
    ...(options.solana ? { solana: options.solana } : {}),
    ...(options.solanaRpcUrl ? { solanaRpcUrl: options.solanaRpcUrl } : {}),
    ...(options.spendControls !== undefined ? { spendControls: options.spendControls } : {}),
    ...(options.maxAmount !== undefined ? { maxAmount: options.maxAmount } : {}),
  })
  const cap = options.maxAmount !== undefined ? BigInt(options.maxAmount) : undefined
  return wrapMCPClientWithPayment(client, payments, {
    autoPayment: true,
    onPaymentRequested: async (context) => {
      if (cap !== undefined) {
        const amounts = context.paymentRequired.accepts.map((requirements) => requirements.amount)
        const affordable = amounts.some((amount) => /^\d+$/.test(amount) && BigInt(amount) <= cap)
        if (!affordable) {
          throw new Error(`${context.toolName} costs ${amounts.join(' or ')} (smallest units), above maxAmount ${cap}: refusing to pay`)
        }
      }
      return options.onPaymentRequested ? options.onPaymentRequested(context) : true
    },
  })
}

/**
 * Connects to a remote MCP server over Streamable HTTP (falling back to SSE
 * for older servers) and returns a client that pays for tools as needed.
 *
 * ```ts
 * const mcp = await connectPaidMcp('https://tools.example/mcp', { evm: wallet.evm, maxAmount: '50000' })
 * const result = await mcp.callTool('analyze', { ticker: 'SOL' })
 * console.log(result.paymentMade, result.paymentResponse?.transaction)
 * await mcp.close()
 * ```
 */
export async function connectPaidMcp(url: string | URL, options: PaidMcpClientOptions): Promise<x402MCPClient> {
  const name = options.name ?? 'agenti'
  return connectWithFallback(url, async (transport) => {
    const client = withAgentiPayments(new Client({ name, version: '0.1.0' }), options)
    await client.connect(transport)
    return client
  })
}

/** Connects a plain MCP client (no payments) to a remote server, e.g. to browse its tools. */
export async function connectMcp(url: string | URL, name = 'agenti'): Promise<Client> {
  return connectWithFallback(url, async (transport) => {
    const client = new Client({ name, version: '0.1.0' })
    await client.connect(transport)
    return client
  })
}

async function connectWithFallback<T>(url: string | URL, attempt: (transport: Transport) => Promise<T>): Promise<T> {
  const endpoint = typeof url === 'string' ? new URL(url) : url
  try {
    return await attempt(new StreamableHTTPClientTransport(endpoint))
  } catch (streamableError) {
    try {
      return await attempt(new SSEClientTransport(endpoint))
    } catch {
      throw streamableError
    }
  }
}

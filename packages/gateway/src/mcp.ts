/**
 * Charge for MCP tools with x402.
 *
 * Built on the official `@x402/mcp` transport: an unpaid call gets a
 * `PaymentRequired` tool result, the client retries with the payment in
 * `_meta["x402/payment"]`, the facilitator verifies it, the tool runs, and the
 * payment settles only when the tool succeeded. The receipt comes back in
 * `_meta["x402/payment-response"]`. Any x402 MCP client can pay, including
 * `@x402/mcp`'s own and the `call_mcp_tool` tool in `@agenti/mcp`.
 */
import { randomUUID } from 'node:crypto'
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  createPaymentWrapper,
  createToolResourceUrl,
  type MCPToolCallback,
  type PaymentWrappedHandler,
  type PaymentWrapperConfig,
  type ToolResult,
  type x402ResourceServer,
} from '@x402/mcp'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type Tool } from '@modelcontextprotocol/sdk/types.js'
import { resolveSeller, type SellerOptions } from './index.js'

/** A dollar price such as "$0.01", or one with a description shown to buyers. */
export type McpToolPrice = string | { price: string; description?: string }

export interface McpPaywallOptions extends SellerOptions {
  /** Hooks from `@x402/mcp`: rate-limit before execution, log after, send receipts after settlement. */
  hooks?: PaymentWrapperConfig['hooks']
  /** How long a signed payment stays valid. Defaults to the scheme's own default. */
  maxTimeoutSeconds?: number
}

export interface McpPaywall {
  /**
   * Wraps a tool handler so every call costs `price`. Pass the result straight
   * to `McpServer.tool()` or `registerTool()`.
   *
   * ```ts
   * server.tool('analyze', 'Deep analysis. $0.10 per call.', { ticker: z.string() },
   *   pw.charge('analyze', '$0.10', async ({ ticker }) => ({
   *     content: [{ type: 'text', text: await analyze(ticker) }],
   *   })))
   * ```
   */
  charge<TArgs extends Record<string, unknown>>(
    toolName: string,
    price: McpToolPrice,
    handler: PaymentWrappedHandler<TArgs>,
  ): MCPToolCallback<TArgs>
  /** Fetches what the facilitator supports. Runs on the first paid call when you do not call it yourself. */
  ready(): Promise<void>
  /** CAIP-2 networks buyers can pay on, in the order they are offered. */
  networks: string[]
  /** The underlying `@x402/core` resource server, for extensions and hooks. */
  resourceServer: x402ResourceServer
}

function priceOf(price: McpToolPrice): { price: string; description?: string } {
  const spec = typeof price === 'string' ? { price } : price
  if (!/^\$?\d+(\.\d+)?$/.test(spec.price.trim())) {
    throw new Error(`Invalid price "${spec.price}". Use a dollar amount such as "$0.01".`)
  }
  return spec
}

/**
 * Creates a paywall for MCP tools. One paywall serves any number of tools,
 * each with its own price.
 */
export function mcpPaywall(options: McpPaywallOptions): McpPaywall {
  const { networks, payToFor, server } = resolveSeller(options, 'mcpPaywall')

  let initializing: Promise<void> | undefined
  const ready = (): Promise<void> => {
    initializing ??= server.initialize().catch((err: unknown) => {
      initializing = undefined
      throw err
    })
    return initializing
  }

  const charge = <TArgs extends Record<string, unknown>>(
    toolName: string,
    price: McpToolPrice,
    handler: PaymentWrappedHandler<TArgs>,
  ): MCPToolCallback<TArgs> => {
    const spec = priceOf(price)
    let wrapped: Promise<MCPToolCallback<TArgs>> | undefined
    const build = async (): Promise<MCPToolCallback<TArgs>> => {
      await ready()
      const accepts = (
        await Promise.all(
          networks.map((network) =>
            server.buildPaymentRequirements({
              scheme: 'exact',
              network: network as `${string}:${string}`,
              payTo: payToFor(network),
              price: spec.price,
              ...(options.maxTimeoutSeconds ? { maxTimeoutSeconds: options.maxTimeoutSeconds } : {}),
            }),
          ),
        )
      ).flat()
      return createPaymentWrapper(server, {
        accepts,
        resource: {
          url: createToolResourceUrl(toolName),
          ...(spec.description ? { description: spec.description } : {}),
        },
        ...(options.hooks ? { hooks: options.hooks } : {}),
      })(handler)
    }
    return async (args, extra) => {
      wrapped ??= build().catch((err: unknown) => {
        wrapped = undefined
        throw err
      })
      return (await wrapped)(args, extra)
    }
  }

  return { charge, ready, networks, resourceServer: server }
}

export interface MonetizeMcpOptions extends McpPaywallOptions {
  /** A connected client for the MCP server being resold. */
  upstream: Client
  /**
   * Per-tool prices. Use `"*"` for every tool not listed. A tool with no
   * entry and no `"*"` stays free and is passed through unchanged.
   */
  prices: Record<string, McpToolPrice>
  /** Name and version the proxy reports to clients. Defaults to the upstream's. */
  name?: string
  version?: string
}

export interface MonetizedMcp {
  /** A fresh MCP server instance. Each connection (or HTTP session) needs its own. */
  createServer(): Server
  /** The price a tool would be charged at, or undefined when it is free. */
  priceFor(toolName: string): { price: string; description?: string } | undefined
  paywall: McpPaywall
}

/**
 * Resells an existing MCP server with per-tool x402 prices. Tool schemas,
 * results and errors pass through untouched; priced tools additionally take
 * payment, and a failing upstream call is never settled.
 *
 * ```ts
 * const upstream = new Client({ name: 'proxy', version: '1.0.0' })
 * await upstream.connect(new StdioClientTransport({ command: 'npx', args: ['-y', 'some-mcp-server'] }))
 * const paid = monetizeMcp({ upstream, prices: { '*': '$0.01' }, payTo: { evm: '0x...' } })
 * await serveMcpOverHttp(paid.createServer, { port: 4022 })
 * ```
 */
export function monetizeMcp(options: MonetizeMcpOptions): MonetizedMcp {
  const { upstream, prices } = options
  const specs = new Map<string, { price: string; description?: string }>()
  for (const [tool, price] of Object.entries(prices)) specs.set(tool, priceOf(price))
  const paywall = mcpPaywall(options)
  const priceFor = (toolName: string) => specs.get(toolName) ?? specs.get('*')

  const callbacks = new Map<string, MCPToolCallback<Record<string, unknown>>>()
  const callbackFor = (toolName: string, spec: { price: string; description?: string }) => {
    let callback = callbacks.get(toolName)
    if (!callback) {
      callback = paywall.charge(toolName, spec, async (args) => {
        const result = await upstream.callTool({ name: toolName, arguments: args })
        return result as unknown as ToolResult
      })
      callbacks.set(toolName, callback)
    }
    return callback
  }

  const upstreamInfo = upstream.getServerVersion()
  const createServer = (): Server => {
    const server = new Server(
      { name: options.name ?? upstreamInfo?.name ?? 'agenti-paid-mcp', version: options.version ?? upstreamInfo?.version ?? '1.0.0' },
      { capabilities: { tools: {} } },
    )

    server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      const listed = await upstream.listTools(request.params)
      const tools: Tool[] = listed.tools.map((tool) => {
        const spec = priceFor(tool.name)
        if (!spec) return tool
        const note = `Paid tool: ${spec.price.startsWith('$') ? spec.price : `$${spec.price}`} per call, settled with x402.`
        return {
          ...tool,
          description: tool.description ? `${tool.description}\n\n${note}` : note,
          _meta: { ...tool._meta, 'x402/price': spec.price },
        }
      })
      return { ...listed, tools }
    })

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args, _meta } = request.params
      const spec = priceFor(name)
      if (!spec) {
        return (await upstream.callTool({ name, ...(args ? { arguments: args } : {}) })) as CallToolResult
      }
      const result = await callbackFor(name, spec)(args ?? {}, { _meta })
      return result as unknown as CallToolResult
    })

    return server
  }

  return { createServer, priceFor, paywall }
}

export interface ServeMcpOverHttpOptions {
  port?: number
  host?: string
  /** Endpoint path. Defaults to "/mcp". */
  path?: string
  /** Close sessions idle for this long. Defaults to 30 minutes. */
  sessionIdleMs?: number
}

export interface ServedMcp {
  url: string
  server: HttpServer
  close(): Promise<void>
}

type AnyMcpServer = Server | McpServer

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined)
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * Serves MCP over Streamable HTTP with one server instance per session.
 * `GET /health` answers without a session. Payments travel inside MCP
 * messages, so no HTTP-level paywall is involved.
 */
export async function serveMcpOverHttp(
  createServer: () => AnyMcpServer,
  options: ServeMcpOverHttpOptions = {},
): Promise<ServedMcp> {
  const path = options.path ?? '/mcp'
  const idleMs = options.sessionIdleMs ?? 30 * 60 * 1000
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: AnyMcpServer; lastSeen: number }>()

  const http = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, sessions: sessions.size })
      return
    }
    if (url.pathname !== path) {
      sendJson(res, 404, { error: `Not found. The MCP endpoint is ${path}.` })
      return
    }
    try {
      const body = req.method === 'POST' ? await readBody(req) : undefined
      const sessionId = req.headers['mcp-session-id']
      const existing = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined
      if (existing) {
        existing.lastSeen = Date.now()
        await existing.transport.handleRequest(req, res, body)
        return
      }
      if (typeof sessionId === 'string') {
        sendJson(res, 404, { jsonrpc: '2.0', error: { code: -32001, message: 'Session not found. Reinitialize.' }, id: null })
        return
      }
      const server = createServer()
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server, lastSeen: Date.now() })
        },
        onsessionclosed: (id) => {
          sessions.delete(id)
        },
      })
      await server.connect(transport)
      await transport.handleRequest(req, res, body)
    } catch (err) {
      if (!res.headersSent) {
        sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: err instanceof Error ? err.message : String(err) }, id: null })
      }
    }
  })

  const sweep = setInterval(() => {
    const cutoff = Date.now() - idleMs
    for (const [id, session] of sessions) {
      if (session.lastSeen >= cutoff) continue
      sessions.delete(id)
      void session.transport.close()
    }
  }, Math.min(idleMs, 60_000))
  sweep.unref()

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject)
    http.listen(options.port ?? 4022, options.host ?? '127.0.0.1', () => resolve())
  })
  const { port } = http.address() as AddressInfo
  const host = options.host ?? '127.0.0.1'
  return {
    url: `http://${host.includes(':') ? `[${host}]` : host}:${port}${path}`,
    server: http,
    close: async () => {
      clearInterval(sweep)
      await Promise.all([...sessions.values()].map((s) => s.transport.close()))
      sessions.clear()
      await new Promise<void>((resolve) => http.close(() => resolve()))
    },
  }
}

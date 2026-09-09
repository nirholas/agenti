#!/usr/bin/env node
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { createBinanceMcpServer } from './server.js'

const useHttp =
  process.argv.includes('--http') || process.env['MCP_TRANSPORT'] === 'http'

if (useHttp) {
  const { createServer: createHttpServer } = await import('node:http')
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  )

  const PORT = parseInt(process.env['PORT'] ?? '3001', 10)

  const httpServer = createHttpServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(req.url === '/health' ? 200 : 404).end(
        req.url === '/health' ? 'ok' : 'Not Found'
      )
      return
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown

    // Omitting sessionIdGenerator selects the SDK's stateless mode. Passing it
    // explicitly as undefined is rejected under exactOptionalPropertyTypes.
    const transport = new StreamableHTTPServerTransport({})
    const server = createBinanceMcpServer()
    // The SDK's transport classes declare `onclose` as `(() => void) | undefined`,
    // which its own Transport interface rejects under exactOptionalPropertyTypes.
    // The runtime shape is correct; this narrows to the interface it implements.
    await server.connect(transport as Transport)
    await transport.handleRequest(req, res, body)
  })

  httpServer.listen(PORT, () => {
    process.stderr.write(`agenti-binance MCP HTTP server on http://localhost:${PORT}/mcp\n`)
  })
} else {
  const { StdioServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/stdio.js'
  )
  const server = createBinanceMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport as Transport)
}

#!/usr/bin/env node
import { createServer } from './server.js'

const useHttp =
  process.argv.includes('--http') || process.env['MCP_TRANSPORT'] === 'http'

if (useHttp) {
  const { createServer: createHttpServer } = await import('node:http')
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  )

  const PORT = parseInt(process.env['PORT'] ?? '3000', 10)

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

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    const server = createServer()
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  })

  httpServer.listen(PORT, () => {
    process.stderr.write(`agenti MCP HTTP server on http://localhost:${PORT}/mcp\n`)
  })
} else {
  const { StdioServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/stdio.js'
  )
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// A minimal stdio MCP server used as the upstream in CLI tests: one tool that
// echoes text, one that reports a version.
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const server = new Server({ name: 'echo-upstream', version: '3.1.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'echo',
      description: 'Echo text back',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
    { name: 'version', description: 'Upstream version', inputSchema: { type: 'object', properties: {} } },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'echo') {
    return { content: [{ type: 'text', text: String(request.params.arguments?.text ?? '') }] }
  }
  if (request.params.name === 'version') return { content: [{ type: 'text', text: '3.1.0' }] }
  return { content: [{ type: 'text', text: `Unknown tool ${request.params.name}` }], isError: true }
})

await server.connect(new StdioServerTransport())

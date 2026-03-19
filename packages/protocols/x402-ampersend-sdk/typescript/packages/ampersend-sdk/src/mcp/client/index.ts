export { Client } from "./client.ts"
export { X402Middleware } from "./middleware.ts"
export type { ClientOptions, PaymentEvent } from "./types.ts"

// Re-export from aliased MCP SDK so users don't need to install it separately
export { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

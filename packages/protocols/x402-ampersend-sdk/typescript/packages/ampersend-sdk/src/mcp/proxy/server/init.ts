import type { ProxyServerOptions } from "../types.ts"
import { ProxyServer } from "./server.ts"

export async function initializeProxyServer(options: ProxyServerOptions): Promise<{ server: ProxyServer }> {
  if (options.transport.type !== "http") {
    throw new Error("transport based proxy only supports HTTP transport")
  }

  const server = new ProxyServer(options.treasurer)
  await server.start(options.transport.port)
  return { server }
}

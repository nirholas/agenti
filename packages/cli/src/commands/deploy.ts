/**
 * `agenti deploy` — placeholder for x402 deploy workflow.
 * Wraps the pattern of serving an x402-gated API and optionally
 * registering it on x402scan after startup.
 */
export interface DeployOptions {
  port: number
  register?: boolean
  name?: string
}

export async function runDeploy(_options: DeployOptions): Promise<void> {
  console.log('agenti deploy is not yet implemented.')
  console.log('To deploy an x402-gated MCP server:')
  console.log('  1. Generate a server with: agenti generate <address>')
  console.log('  2. Set PRIVATE_KEY and RPC_URL in .env')
  console.log('  3. Start with: node server.ts')
  console.log('  4. Register the running URL: agenti register <url>')
}

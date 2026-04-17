#!/usr/bin/env node
import { serve } from '@hono/node-server'
import { createFacilitator } from './index.js'

const port = Number(process.env['PORT'] ?? 3402)
const settlerPrivateKey = process.env['FACILITATOR_PRIVATE_KEY'] as `0x${string}` | undefined

const rpcEnvMap: Record<string, string> = {
  'eip155:1': 'ETH_RPC_URL',
  'eip155:8453': 'BASE_RPC_URL',
  'eip155:42161': 'ARB_RPC_URL',
  'eip155:84532': 'BASE_SEPOLIA_RPC_URL',
}

const rpcUrls: Record<string, string> = {}
for (const [network, envVar] of Object.entries(rpcEnvMap)) {
  const url = process.env[envVar]
  if (url) rpcUrls[network] = url
}

const app = createFacilitator({
  ...(settlerPrivateKey ? { settlerPrivateKey } : {}),
  rpcUrls,
})

serve({ fetch: app.fetch, port }, () => {
  console.log(`agenti-facilitator listening on http://localhost:${port}`)
  if (!settlerPrivateKey) {
    console.warn('FACILITATOR_PRIVATE_KEY not set — POST /settle and GET /balances disabled')
  }
})

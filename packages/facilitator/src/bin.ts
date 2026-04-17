#!/usr/bin/env node
import { createFacilitator } from './index.js'

const port = Number(process.env['PORT'] ?? 3402)
const settlerPrivateKey = process.env['FACILITATOR_PRIVATE_KEY'] as `0x${string}` | undefined

const rpcEnvMap: Record<string, string> = {
  'eip155:1': 'ETH_RPC_URL',
  'eip155:8453': 'BASE_RPC_URL',
  'eip155:42161': 'ARBITRUM_RPC_URL',
  'eip155:137': 'POLYGON_RPC_URL',
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

app.listen(port, () => {
  console.log(`agenti-facilitator listening on port ${port}`)
  if (!settlerPrivateKey) {
    console.warn('FACILITATOR_PRIVATE_KEY not set — POST /settle will be disabled')
  }
})

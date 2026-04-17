/**
 * Example: Self-hosted x402 facilitator
 *
 * Shows how to run your own payment facilitator instead of relying on x402.org.
 * The facilitator verifies EIP-712 signatures and settles USDC via
 * transferWithAuthorization on Base.
 *
 * Prerequisites:
 *   FACILITATOR_PRIVATE_KEY=0x...  # gas wallet for on-chain settlement
 *   BASE_RPC_URL=https://...        # Base mainnet RPC
 *   AGENT_PRIVATE_KEY=0x...         # agent wallet
 *   PAYMENT_ADDRESS=0x...           # address that receives payments
 *
 * Run:
 *   pnpm -C examples tsx 06-self-hosted-facilitator.ts
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createFacilitator } from '@agenti/facilitator'
import { agenti, withPaymentHono, LOCAL_FACILITATOR } from '@agenti/sdk'

const FACILITATOR_PORT = 3402
const API_PORT = 3000

// ─── 1. Start the local facilitator ──────────────────────────────────────────

const facilitator = createFacilitator({
  settlerPrivateKey: process.env['FACILITATOR_PRIVATE_KEY'] as `0x${string}` | undefined,
  rpcUrls: {
    'eip155:8453': process.env['BASE_RPC_URL'] ?? 'https://mainnet.base.org',
  },
})

serve({ fetch: facilitator.fetch, port: FACILITATOR_PORT }, () => {
  console.log(`Facilitator: http://localhost:${FACILITATOR_PORT}`)
  console.log(`  POST /verify — check a payment signature offline`)
  console.log(`  POST /settle — verify + execute on-chain`)
  console.log(`  GET  /health — liveness probe`)
  console.log(`  GET  /balances — operator wallet balances`)
})

// ─── 2. Create a 402-gated API pointing at the local facilitator ──────────────

const PAYMENT_ADDRESS = process.env['PAYMENT_ADDRESS'] ?? '0x0000000000000000000000000000000000000001'

const api = new Hono()

api.get(
  '/api/weather',
  withPaymentHono(
    async (c) => {
      return c.json({
        location: 'Base',
        temperature: '69°F',
        condition: 'Onchain',
        timestamp: new Date().toISOString(),
      })
    },
    {
      amount: '1000', // 0.001 USDC (6 decimals)
      address: PAYMENT_ADDRESS,
      network: 'eip155:8453',
      facilitatorUrl: LOCAL_FACILITATOR, // point at our local instance
      description: 'Weather data — 0.001 USDC per request',
    },
  ),
)

serve({ fetch: api.fetch, port: API_PORT }, () => {
  console.log(`\nAPI server: http://localhost:${API_PORT}`)
  console.log(`  GET /api/weather — costs 0.001 USDC`)
})

// ─── 3. Create an agenti instance and pay for the request ─────────────────────

if (!process.env['AGENT_PRIVATE_KEY']) {
  console.log('\nNote: set AGENT_PRIVATE_KEY to run the payment demo.')
} else {
  // Give the servers a moment to start
  await new Promise((r) => setTimeout(r, 500))

  const agent = agenti({
    evm: { privateKey: process.env['AGENT_PRIVATE_KEY'] as `0x${string}` },
  })

  console.log(`\nAgent wallet: ${agent.wallet.evm.address}`)
  console.log('Requesting weather data...')

  const res = await agent.pay(`http://localhost:${API_PORT}/api/weather`)
  if (res.ok) {
    const data = await res.json()
    console.log('Weather:', data)
  } else {
    console.error(`Payment failed (${res.status}):`, await res.text())
  }
}

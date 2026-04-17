import { Hono } from 'hono'
import { createPublicClient, http, formatUnits, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { verifyPayment } from './verifier.js'
import { settlePayment } from './settler.js'
import { CHAINS } from './chains.js'
import type { FacilitatorConfig, PaymentPayload, PaymentRequired } from './types.js'

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

interface VerifyBody {
  payment: PaymentPayload
  requirements: PaymentRequired
}

export function createFacilitator(config: FacilitatorConfig = {}): Hono {
  const app = new Hono()

  app.get('/health', (c) =>
    c.json({ status: 'ok', chains: CHAINS.map((ch) => ch.caip2) }),
  )

  app.post('/verify', async (c) => {
    const body = await c.req.json<VerifyBody>()
    if (!body.payment || !body.requirements) {
      return c.json({ valid: false, error: 'Missing payment or requirements' }, 400)
    }
    const result = await verifyPayment(body.payment, body.requirements)
    return c.json(result, result.valid ? 200 : 400)
  })

  app.post('/settle', async (c) => {
    const body = await c.req.json<VerifyBody>()
    if (!body.payment || !body.requirements) {
      return c.json({ settled: false, error: 'Missing payment or requirements' }, 400)
    }
    // Verify before settling
    const verifyResult = await verifyPayment(body.payment, body.requirements)
    if (!verifyResult.valid) {
      return c.json({ settled: false, error: verifyResult.error }, 400)
    }
    const result = await settlePayment(body.payment, body.requirements, config)
    return c.json(result, result.settled ? 200 : 400)
  })

  app.get('/balances', async (c) => {
    if (!config.settlerPrivateKey) {
      return c.json({ error: 'No settler private key configured' }, 400)
    }

    const account = privateKeyToAccount(config.settlerPrivateKey)
    const facilitatorAddress = account.address

    const balances = await Promise.all(
      CHAINS.map(async (chain) => {
        const rpc = config.rpcUrls?.[chain.caip2] ?? chain.rpc
        if (!rpc) {
          return { caip2: chain.caip2, error: 'No RPC URL configured' }
        }
        try {
          const client = createPublicClient({ chain: chain.viemChain, transport: http(rpc) })
          const [eth, usdc] = await Promise.all([
            client.getBalance({ address: facilitatorAddress }),
            client.readContract({
              address: chain.usdc,
              abi: ERC20_BALANCE_ABI,
              functionName: 'balanceOf',
              args: [facilitatorAddress],
            }) as Promise<bigint>,
          ])
          return {
            caip2: chain.caip2,
            eth: formatEther(eth),
            usdc: formatUnits(usdc, 6),
            lowGas: parseFloat(formatEther(eth)) < 0.001,
          }
        } catch (err) {
          return { caip2: chain.caip2, error: String(err) }
        }
      }),
    )

    return c.json({ facilitatorAddress, balances })
  })

  return app
}

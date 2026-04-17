import { tool } from 'ai'
import { z } from 'zod'
import { agenti } from '../agenti.js'
import type { AgentiConfig } from '../agenti.js'

export function agentiTools(config: AgentiConfig): Record<string, ReturnType<typeof tool>> {
  const client = agenti(config)

  return {
    agentiPay: tool({
      description:
        'Make an HTTP request and automatically pay if the server requires x402 cryptocurrency payment (HTTP 402)',
      parameters: z.object({
        url: z.string().describe('The URL to request'),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('GET'),
        body: z.string().optional().describe('JSON body for POST/PUT requests'),
      }),
      execute: async ({ url, method, body }) => {
        const response = await client.pay(url, {
          method: method ?? 'GET',
          body: body ? JSON.parse(body) : undefined,
        })
        return { status: response.status, body: await response.text() }
      },
    }),

    agentiBalance: tool({
      description: 'Get the current USDC and SOL balances of the agent wallet',
      parameters: z.object({}),
      execute: async () => {
        const balances = await client.balance()
        return { balances }
      },
    }),

    agentiReceive: tool({
      description: 'Create a payment invoice so another party can send funds to this agent',
      parameters: z.object({
        amount: z.number().describe('Amount to request'),
        token: z.string().describe('Token symbol, e.g. USDC'),
        chain: z.string().describe('Chain name, e.g. base, solana'),
      }),
      execute: async ({ amount, token, chain }) => {
        const invoice = await client.receive({ amount, token, chain: chain as any })
        return invoice
      },
    }),
  }
}

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { agenti } from '../agenti.js'
import type { AgentiConfig } from '../agenti.js'
import { createSolanaAgentKit, getSolanaAgentKitLangchainTools } from '../solana/agent-kit.js'
import type { SolanaAgentKitConfig } from '../solana/agent-kit.js'

export interface AgentiLangChainConfig extends AgentiConfig {
  /** When provided, merges 100+ Solana Agent Kit tools (Jupiter, Raydium, NFT, staking, etc.) */
  solanaAgentKit?: SolanaAgentKitConfig
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function agentiLangChainTools(config: AgentiLangChainConfig): DynamicStructuredTool<any>[] {
  const client = agenti(config)

  const payTool = new DynamicStructuredTool({
    name: 'agenti_pay',
    description:
      'Make an HTTP request and automatically pay if the server requires x402 payment. Returns the response body as a string.',
    schema: z.object({
      url: z.string().describe('The URL to request'),
      method: z.string().optional().describe('HTTP method (default: GET)'),
      body: z.string().optional().describe('Request body as a string'),
    }),
    func: async ({ url, method, body }) => {
      const res = await client.pay(url, {
        method: method ?? 'GET',
        body: body ?? undefined,
      })
      return res.text()
    },
  })

  const balanceTool = new DynamicStructuredTool({
    name: 'agenti_balance',
    description: 'Get the current USDC and SOL balances of the agent wallet.',
    schema: z.object({}),
    func: async () => {
      const balances = await client.balance()
      return JSON.stringify(balances)
    },
  })

  const receiveTool = new DynamicStructuredTool({
    name: 'agenti_receive',
    description: 'Create a payment invoice so another party can send funds to this agent.',
    schema: z.object({
      amount: z.number().describe('Amount to request'),
      token: z.string().describe('Token symbol, e.g. USDC'),
      chain: z.string().describe('Chain name, e.g. base, solana'),
    }),
    func: async ({ amount, token, chain }) => {
      const invoice = await client.receive({ amount, token, chain: chain as any })
      return JSON.stringify(invoice)
    },
  })

  const baseTools = [payTool, balanceTool, receiveTool]

  if (config.solanaAgentKit) {
    const kit = createSolanaAgentKit(config.solanaAgentKit)
    const sakTools = getSolanaAgentKitLangchainTools(kit)
    return [...baseTools, ...sakTools] as DynamicStructuredTool<any>[]
  }

  return baseTools
}

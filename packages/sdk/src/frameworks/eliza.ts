import type { Plugin, Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core'
import { agenti } from '../agenti.js'
import type { Chain } from '@agenti/core'

const URL_RE = /https?:\/\/[^\s]+/i
const AMOUNT_RE = /(\d+(?:\.\d+)?)\s*(usdc|sol|eth)/i
const CHAIN_RE = /\b(base|solana|ethereum)\b/i

const CHAIN_MAP: Record<string, Chain> = {
  base: 'base',
  ethereum: 'base',
  solana: 'solana',
}

const payAction: Action = {
  name: 'PAY_URL',
  description: 'Pay for a resource at a URL using cryptocurrency',
  similes: ['PAY FOR', 'PURCHASE', 'BUY ACCESS', 'MAKE PAYMENT'],
  examples: [
    [
      { user: 'user', content: { text: 'Pay https://api.example.com/data' } },
      { user: 'agent', content: { text: 'Payment sent to https://api.example.com/data' } },
    ],
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    return URL_RE.test(message.content.text ?? '')
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback: HandlerCallback,
  ) => {
    const url = (message.content.text ?? '').match(URL_RE)?.[0]
    if (!url) {
      await callback({ text: 'No URL found in message.' })
      return
    }

    const privateKey = runtime.getSetting('AGENTI_EVM_PRIVATE_KEY') as `0x${string}` | undefined
    if (!privateKey) {
      await callback({ text: 'AGENTI_EVM_PRIVATE_KEY is not configured.' })
      return
    }

    try {
      const agent = agenti({ evm: { privateKey } })
      const response = await agent.pay(url)
      const body = await response.text().catch(() => '')
      await callback({
        text: `Payment complete (HTTP ${response.status})${body ? `\n\n${body.slice(0, 500)}` : ''}`,
      })
    } catch (err) {
      await callback({ text: `Payment failed: ${(err as Error).message}` })
    }
  },
}

const balanceAction: Action = {
  name: 'CHECK_BALANCE',
  description: 'Check the current wallet balances',
  similes: ['GET BALANCE', 'HOW MUCH', 'WALLET BALANCE'],
  examples: [
    [
      { user: 'user', content: { text: 'What is my wallet balance?' } },
      { user: 'agent', content: { text: 'USDC (Base): 100.00 | SOL (Solana): 0.50' } },
    ],
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content.text ?? '').toLowerCase()
    return (
      text.includes('balance') ||
      text.includes('how much') ||
      text.includes('wallet') ||
      text.includes('funds')
    )
  },
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback: HandlerCallback,
  ) => {
    const privateKey = runtime.getSetting('AGENTI_EVM_PRIVATE_KEY') as `0x${string}` | undefined
    if (!privateKey) {
      await callback({ text: 'AGENTI_EVM_PRIVATE_KEY is not configured.' })
      return
    }

    try {
      const agent = agenti({ evm: { privateKey } })
      const balances = await agent.balance()
      if (balances.length === 0) {
        await callback({ text: 'No balances found.' })
        return
      }
      const text = balances
        .map((b) => `${b.token} (${b.chain}): ${b.amount}`)
        .join(' | ')
      await callback({ text })
    } catch (err) {
      await callback({ text: `Failed to fetch balances: ${(err as Error).message}` })
    }
  },
}

const receiveAction: Action = {
  name: 'CREATE_INVOICE',
  description: 'Create a payment invoice to receive cryptocurrency',
  similes: ['REQUEST PAYMENT', 'CREATE INVOICE', 'RECEIVE PAYMENT'],
  examples: [
    [
      { user: 'user', content: { text: 'Create an invoice for 10 USDC on base' } },
      {
        user: 'agent',
        content: { text: 'Invoice created: send 10 USDC to 0xABC... on base (expires in 30 min)' },
      },
    ],
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    return AMOUNT_RE.test(message.content.text ?? '')
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback: HandlerCallback,
  ) => {
    const text = message.content.text ?? ''
    const amountMatch = text.match(AMOUNT_RE)
    if (!amountMatch) {
      await callback({ text: 'Please specify an amount and token (e.g. "10 USDC" or "0.5 SOL").' })
      return
    }

    const amount = parseFloat(amountMatch[1]!)
    const token = amountMatch[2]!.toUpperCase()
    const chainMatch = text.match(CHAIN_RE)
    const chain: Chain = chainMatch ? (CHAIN_MAP[chainMatch[1]!.toLowerCase()] ?? 'base') : 'base'

    const privateKey = runtime.getSetting('AGENTI_EVM_PRIVATE_KEY') as `0x${string}` | undefined
    if (!privateKey) {
      await callback({ text: 'AGENTI_EVM_PRIVATE_KEY is not configured.' })
      return
    }

    try {
      const agent = agenti({ evm: { privateKey } })
      const invoice = await agent.receive({ amount, token, chain })
      const expiresIn = Math.round((invoice.expiresAt.getTime() - Date.now()) / 60000)
      await callback({
        text: `Invoice created: send ${invoice.amount} ${invoice.token} to ${invoice.address} on ${invoice.chain} (expires in ${expiresIn} min, id: ${invoice.id})`,
      })
    } catch (err) {
      await callback({ text: `Failed to create invoice: ${(err as Error).message}` })
    }
  },
}

export const agentiPlugin: Plugin = {
  name: 'agenti',
  description: 'Give Eliza agents the ability to pay for things with cryptocurrency',
  actions: [payAction, balanceAction, receiveAction],
}

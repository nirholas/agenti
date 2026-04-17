/**
 * Tutorial 3: Let an agent decide what to buy
 *
 * Wire up Claude (or any LLM) as the decision-maker.
 * The agent reads market data, picks a token, and executes the buy autonomously.
 * Uses the Anthropic SDK + agenti for the payment execution.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... SOLANA_PRIVATE_KEY=<key> npx tsx examples/03-agent-buys.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import bs58 from 'bs58'
import { solana } from '@agenti/sdk'

const anthropic = new Anthropic()
const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!))
const connection = new Connection(
  process.env.SOLANA_RPC_URL ?? clusterApiUrl('mainnet-beta'),
  'confirmed'
)
const trader = solana({ keypair, connection })

// ─── Tools the agent can call ─────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: 'get_trending_tokens',
    description: 'Get the top trending tokens on pump.fun right now',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_coin_state',
    description: 'Check whether a token is on the bonding curve or graduated to the AMM',
    input_schema: {
      type: 'object',
      properties: { mint: { type: 'string', description: 'Token mint address' } },
      required: ['mint'],
    },
  },
  {
    name: 'buy_token',
    description: 'Buy a token on pump.fun with SOL',
    input_schema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        sol_amount: { type: 'number', description: 'SOL to spend' },
        reason: { type: 'string', description: 'Why you are buying this token' },
      },
      required: ['mint', 'sol_amount', 'reason'],
    },
  },
]

// ─── Tool implementations ─────────────────────────────────────────────────────

async function handleToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'get_trending_tokens': {
      // In production: fetch from pump.fun or your own data source
      // For this example, return mock trending data
      return JSON.stringify([
        { mint: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', symbol: 'PNUT', marketCapSol: 420 },
        { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', marketCapSol: 6900 },
        { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', marketCapSol: 99999 },
      ])
    }

    case 'get_coin_state': {
      const { mint } = input as { mint: string }
      try {
        const state = await trader.coinState(mint)
        return JSON.stringify(state)
      } catch (e) {
        return JSON.stringify({ error: String(e) })
      }
    }

    case 'buy_token': {
      const { mint, sol_amount, reason } = input as {
        mint: string
        sol_amount: number
        reason: string
      }
      console.log(`\nAgent is buying ${sol_amount} SOL of ${mint}`)
      console.log(`Reason: ${reason}`)

      try {
        const result = await trader.buy({ mint, solAmount: sol_amount, slippage: 5 })
        return JSON.stringify({
          success: true,
          signature: result.signature,
          explorerUrl: result.explorerUrl,
        })
      } catch (e) {
        return JSON.stringify({ success: false, error: String(e) })
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

// ─── Agentic loop ─────────────────────────────────────────────────────────────

async function runBuyingAgent() {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `You are a crypto trading agent operating on Solana.
You have a wallet with some SOL. Your job is to find one promising token to buy.

Steps:
1. Get the trending tokens
2. Pick the most interesting one (low market cap, recent launch, or strong momentum)
3. Check its current state (bonding curve vs AMM)
4. Buy a small amount (0.01 SOL max) with your reasoning

Be decisive. Make one buy.`,
    },
  ]

  console.log('Starting agent...\n')

  // Agentic loop — runs until agent stops calling tools
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools,
      messages,
    })

    // Add assistant turn to history
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      // Agent is done
      const text = response.content.find((b) => b.type === 'text')
      if (text?.type === 'text') console.log('\nAgent:', text.text)
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        console.log(`Tool: ${block.name}`, JSON.stringify(block.input))
        const result = await handleToolCall(block.name, block.input as Record<string, unknown>)
        console.log(`Result: ${result}\n`)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }

      messages.push({ role: 'user', content: toolResults })
    }
  }
}

await runBuyingAgent()

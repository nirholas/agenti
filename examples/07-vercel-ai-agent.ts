/**
 * Example 7: Vercel AI SDK agent with payment tools
 *
 * Uses the Vercel AI `generateText` loop with agenti tools so the model
 * can autonomously pay for and fetch gated resources.
 *
 * Run:
 *   EVM_KEY=0x... ANTHROPIC_API_KEY=... npx tsx examples/07-vercel-ai-agent.ts
 */

import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { agentiTools } from '@agenti/sdk'

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-6'),
  tools: agentiTools({ evm: { privateKey: process.env.EVM_KEY as `0x${string}` } }),
  maxSteps: 5,
  prompt: 'Pay for and fetch the market data from https://api.example.com/markets',
})
console.log(text)

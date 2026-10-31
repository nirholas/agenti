/**
 * Example 6: LangChain agent with payment tools
 *
 * Wraps agenti pay/balance/receive as DynamicStructuredTools and hands
 * them to a Claude-powered agent executor.
 *
 * Run:
 *   EVM_KEY=0x... ANTHROPIC_API_KEY=... npx tsx examples/06-langchain-agent.ts
 */

import { ChatAnthropic } from '@langchain/anthropic'
import { createAgent } from 'langchain'
import { agentiLangChainTools } from '@agenti/sdk/langchain'

const tools = agentiLangChainTools({ evm: { privateKey: process.env.EVM_KEY as `0x${string}` } })
const model = new ChatAnthropic({ model: 'claude-sonnet-4-6' })

const agent = createAgent({
  model,
  tools,
  systemPrompt: 'You are an agent that can pay for APIs with crypto.',
})

const result = await agent.invoke({
  messages: [{ role: 'user', content: 'Fetch the current ETH price from https://api.example.com/eth-price' }],
})
console.log(result.messages.at(-1)?.content)

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
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
import { agentiLangChainTools } from '@agenti/sdk'
import { ChatPromptTemplate } from '@langchain/core/prompts'

const tools = agentiLangChainTools({ evm: { privateKey: process.env.EVM_KEY as `0x${string}` } })
const model = new ChatAnthropic({ model: 'claude-sonnet-4-6' })

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are an agent that can pay for APIs with crypto.'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
])

const agent = createToolCallingAgent({ llm: model, tools, prompt })
const executor = new AgentExecutor({ agent, tools })

const result = await executor.invoke({
  input: 'Fetch the current ETH price from https://api.example.com/eth-price',
})
console.log(result.output)

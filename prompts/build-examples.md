# Build: Working Examples

status: pending

## Goal
Create runnable TypeScript examples in `examples/` that demonstrate agenti in real-world agent scenarios. These serve as documentation and onboarding.

## Files to create

### examples/01-create-wallet.ts
```ts
// Simplest possible example: generate a wallet
import { generateWallet } from '@agenti/core'
const wallet = await generateWallet()
console.log('EVM address:', wallet.evm.address)
console.log('Solana address:', wallet.solana.address)
```

### examples/02-check-balance.ts
```ts
// Check USDC and SOL balances
import { agenti } from '@agenti/sdk'
const agent = agenti({ evmPrivateKey: process.env.EVM_KEY! })
const balances = await agent.balance()
console.log(balances)
```

### examples/03-pay-for-api.ts
```ts
// Call an x402-gated API — agent auto-pays the 402
import { agenti } from '@agenti/sdk'
const agent = agenti({ evmPrivateKey: process.env.EVM_KEY! })
const res = await agent.pay('https://api.example.com/data')
console.log(await res.json())
```

### examples/04-receive-payment.ts
```ts
// Create a payment invoice and wait for it
import { agenti } from '@agenti/sdk'
const agent = agenti({ evmPrivateKey: process.env.EVM_KEY! })
const invoice = await agent.receive({ amount: 1, token: 'USDC', chain: 'base' })
console.log('Send USDC to:', invoice.address)
```

### examples/05-gate-express-api.ts
```ts
// Express API that requires payment
import express from 'express'
import { withPaymentExpress } from '@agenti/sdk'

const app = express()
app.get('/premium', withPaymentExpress(
  async (req, res) => res.json({ secret: 'hello paying customer' }),
  { amount: 0.01, token: 'USDC', chain: 'base' }
))
app.listen(3000)
```

### examples/06-langchain-agent.ts
```ts
// LangChain agent that can pay for things
import { ChatAnthropic } from '@langchain/anthropic'
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
import { agentiLangChainTools } from '@agenti/sdk/langchain'
import { ChatPromptTemplate } from '@langchain/core/prompts'

const tools = agentiLangChainTools({ evmPrivateKey: process.env.EVM_KEY! })
const model = new ChatAnthropic({ model: 'claude-sonnet-4-6' })
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are an agent that can pay for APIs with crypto.'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
])
const agent = createToolCallingAgent({ llm: model, tools, prompt })
const executor = new AgentExecutor({ agent, tools })

const result = await executor.invoke({
  input: 'Fetch the current ETH price from https://api.example.com/eth-price'
})
console.log(result.output)
```

### examples/07-vercel-ai-agent.ts
```ts
// Vercel AI SDK agent with payment tools
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { agentiTools } from '@agenti/sdk/vercel-ai'

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-6'),
  tools: agentiTools({ evmPrivateKey: process.env.EVM_KEY! }),
  maxSteps: 5,
  prompt: 'Pay for and fetch the market data from https://api.example.com/markets',
})
console.log(text)
```

### examples/08-mcp-server.ts
```ts
// Run the agenti MCP server programmatically
import { createServer } from '@agenti/mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = createServer()
const transport = new StdioServerTransport()
await server.connect(transport)
```

## examples/package.json
```json
{
  "name": "agenti-examples",
  "private": true,
  "type": "module",
  "dependencies": {
    "@agenti/core": "workspace:*",
    "@agenti/sdk": "workspace:*",
    "@agenti/mcp": "workspace:*"
  }
}
```

## Note
Examples 06 and 07 depend on `build-langchain-adapter` and `build-vercel-ai-adapter` completing first. If those framework files don't exist yet, add a comment `// requires @agenti/sdk/langchain — see prompts/build-langchain-adapter.md` and write the example anyway.

Mark this file's status as `complete` when done.

# agenti 
 
**The money layer for AI agents.** 

An agent that can think but can't pay is half an agent. Agenti gives every AI — Claude, GPT-4, Llama, Gemini, or any custom LLM — the ability to hold, spend, earn, and receive cryptocurrency natively, autonomously, across any chain.

```ts
import { agenti } from '@agenti/sdk'

const agent = agenti({ evm: { privateKey: process.env.AGENT_KEY } })
const data = await agent.pay('https://api.example.com/premium-data')
```

One line. The agent now has money.

---

## Vision

Every AI agent will need a wallet. Not a wallet managed by a human — a wallet the agent owns, funded by its work, spent on its needs, earning yield when idle.

Right now, if an AI agent needs to pay for an API, buy a resource, compensate another agent, or receive payment for its own work — a human has to step in. That breaks autonomy. Agenti removes that bottleneck entirely.

**Agenti is the infrastructure for the agentic economy:**

- **An SDK** so developers can give any agent financial capability in minutes — LangChain agents, AutoGen pipelines, CrewAI crews, custom LLM loops
- **An MCP server** so Claude, Cursor, Windsurf, and any MCP-compatible client can use money as a native tool without writing code
- **A protocol layer** built on open standards (x402, EIP-3009, ERC-8004) so agent payments interoperate across frameworks, chains, and wallets
- **A payment network** where agents pay each other for work, data, and compute — fully autonomous, no human intermediaries

The domain is `agenti.cash`. The name is the mission.

---

## Packages

| Package | Description | Install |
|---|---|---|
| [`@agenti/core`](./packages/core) | Wallet generation for EVM + Solana | `npm i @agenti/core` |
| [`@agenti/sdk`](./packages/sdk) | Full developer SDK — pay, receive, balance | `npm i @agenti/sdk` |
| [`@agenti/mcp`](./packages/mcp) | MCP server — plug into any LLM client | `npx @agenti/mcp` |

---

## Quick Start

### Give an agent a wallet

```ts
import { agenti, generateWallet } from '@agenti/sdk'

// Generate a fresh wallet (EVM + Solana in one call)
const wallet = generateWallet()
console.log(wallet.evm.address)    // 0x...  (Base, Arbitrum, Ethereum, Polygon)
console.log(wallet.solana.address) // base58 (Solana mainnet)

// Or load an existing wallet
const agent = agenti({
  evm: { privateKey: '0x...' },
  solana: { privateKey: Uint8Array.from([...]) },
})
```

### Pay for anything

```ts
// Automatic x402 payment — if the server returns 402, agenti pays and retries
const response = await agent.pay('https://api.example.com/data')
const json = await response.json()

// POST with body
const result = await agent.pay('https://ai-service.com/generate', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'summarize this document' }),
})
```

### Check balances

```ts
const balances = await agent.balance()
// [
//   { token: 'USDC', amount: '42.00', chain: 'base' },
//   { token: 'SOL',  amount: '1.5',   chain: 'solana' }
// ]
```

### Receive payments

```ts
// Create a payment request
const invoice = await agent.receive({ amount: 5, token: 'USDC', chain: 'base' })
// {
//   id: 'uuid',
//   address: '0x...',
//   amount: '5',
//   token: 'USDC',
//   chain: 'base',
//   expiresAt: Date
// }
```

---

## MCP Server — Plug Into Any LLM

The `@agenti/mcp` package turns every tool in the SDK into an MCP tool that any LLM client can call — no code required.

### Setup: Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@agenti/mcp"],
      "env": {
        "AGENTI_EVM_PRIVATE_KEY": "0x...",
        "AGENTI_SOLANA_PRIVATE_KEY": "hex-encoded-64-byte-key"
      }
    }
  }
}
```

### Setup: Cursor

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@agenti/mcp"]
    }
  }
}
```

### Setup: Windsurf / Codeium

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@agenti/mcp"]
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|---|---|
| `create_wallet` | Generate a new EVM + Solana wallet with addresses and private keys |
| `get_balance` | Check USDC, SOL, and token balances for any address |
| `pay` | Fetch a URL — if it returns 402, payment is handled automatically |
| `create_invoice` | Generate a payment request with an address and expiry |
| `check_payment` | Verify on-chain whether a payment was received |

Once configured, you can tell any LLM: *"Pay for this API and summarize the response"* — and it will.

---

## Framework Integrations

### LangChain

```ts
import { tool } from '@langchain/core/tools'
import { agenti } from '@agenti/sdk'

const agent = agenti({ evm: { privateKey: process.env.AGENT_KEY } })

const payTool = tool(
  async ({ url }) => {
    const res = await agent.pay(url)
    return await res.text()
  },
  {
    name: 'pay_and_fetch',
    description: 'Pay for and fetch a URL that may require cryptocurrency payment',
    schema: z.object({ url: z.string() }),
  }
)
```

### AutoGen / AG2

```python
# Coming in @agenti/sdk-python (v0.8)
from agenti import Agenti

agent = Agenti(evm_private_key=os.environ["AGENT_KEY"])
result = agent.pay("https://api.example.com/data")
```

### CrewAI

```ts
// Agenti tools drop into any CrewAI-compatible workflow
import { AgentiTool } from '@agenti/sdk/tools/crewai'

const crew = new Crew({
  agents: [researchAgent],
  tools: [new AgentiTool()],  // agents in the crew can now pay for resources
})
```

### Vercel AI SDK

```ts
import { agenti } from '@agenti/sdk'
import { tool } from 'ai'

const agent = agenti({ evm: { privateKey: process.env.AGENT_KEY } })

const tools = {
  payForData: tool({
    description: 'Pay for and retrieve data from a paid API endpoint',
    parameters: z.object({ url: z.string() }),
    execute: async ({ url }) => {
      const res = await agent.pay(url)
      return res.json()
    },
  }),
}
```

### OpenAI Assistants / Function Calling

```ts
const functions = [
  {
    name: 'pay_for_resource',
    description: 'Pay for an HTTP resource using cryptocurrency and return its content',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
]

// In your function handler:
async function handleFunctionCall(name, args) {
  if (name === 'pay_for_resource') {
    const res = await agent.pay(args.url)
    return res.text()
  }
}
```

### ElizaOS

```ts
import { AgentiPlugin } from '@agenti/sdk/plugins/eliza'

export default {
  name: 'my-agent',
  plugins: [new AgentiPlugin({ evmKey: process.env.AGENT_KEY })],
}
```

---

## How Payments Work

### EVM — x402 Protocol

Agenti implements the [x402](https://github.com/coinbase/x402) open standard — an HTTP-native payment protocol that turns the long-dormant `402 Payment Required` status code into a real payment flow.

```
1. Agent sends request
   GET https://api.example.com/data

2. Server responds with payment requirements
   HTTP/1.1 402 Payment Required
   Content-Type: application/json

   {
     "x402Version": 1,
     "accepts": [{
       "scheme": "exact",
       "network": "base-mainnet",
       "maxAmountRequired": "1000000",   // 1 USDC (6 decimals)
       "payTo": "0x...",
       "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  // USDC on Base
       "maxTimeoutSeconds": 300
     }]
   }

3. Agenti signs an EIP-3009 transferWithAuthorization
   (gasless — no ETH required, no transaction to wait for)

4. Agent retries with payment
   GET https://api.example.com/data
   X-Payment: <base64-encoded signed authorization>

5. Facilitator verifies signature and settles on-chain
   HTTP/1.1 200 OK

   { "data": "..." }
```

**Why this is better than every other payment method:**
- No API keys to manage
- No billing accounts to create
- No monthly invoices
- No human card approval
- Works across every HTTP client, framework, and language
- The agent pays exactly what the resource costs — nothing more

### Solana — Pump Agent Payments

For Solana, agenti integrates with the pump.fun Agent Payments program at `AgenTMiC2hvxGebTsgmsD4HHBa8WEcqGFf87iwRRxLo7`. Same HTTP 402 flow, same `agent.pay()` call — settled on Solana using SPL tokens.

```ts
// Works identically — agenti detects the network from the 402 response
const res = await agent.pay('https://solana-api.example.com/data')
```

---

## Building a Paid API

You can also gate your own APIs behind agenti payments using any x402-compatible server middleware:

### Express

```ts
import express from 'express'
import { paymentMiddleware } from '@x402/express'

const app = express()

app.use(
  paymentMiddleware({
    amount: '0.01',       // $0.01 USDC per request
    token: 'USDC',
    network: 'base-mainnet',
    address: '0xYourAddress',
  })
)

app.get('/data', (req, res) => {
  res.json({ result: 'premium data' })
})
```

Any agent using agenti will automatically pay and get through. No auth tokens. No rate-limit negotiation. Just value exchanged for value.

### Next.js

```ts
// app/api/premium/route.ts
import { withPayment } from '@x402/next'

export const GET = withPayment(
  { amount: '0.001', token: 'USDC', network: 'base-mainnet' },
  async (req) => {
    return Response.json({ data: 'premium content' })
  }
)
```

### Cloudflare Workers / Edge

```ts
import { verifyPayment } from '@x402/core'

export default {
  async fetch(req) {
    const payment = req.headers.get('X-Payment')
    if (!payment) return paymentRequired()
    await verifyPayment(payment, { amount: '0.001', network: 'base-mainnet' })
    return new Response(JSON.stringify({ data: 'result' }))
  },
}
```

---

## Solana Trading Tutorials

Built on [`@pump-fun/pump-sdk`](https://www.npmjs.com/package/@pump-fun/pump-sdk), [`@pump-fun/pump-swap-sdk`](https://www.npmjs.com/package/@pump-fun/pump-swap-sdk), and [`@pump-fun/agent-payments-sdk`](https://www.npmjs.com/package/@pump-fun/agent-payments-sdk) — the official pump.fun SDKs.

All examples are in [`examples/`](./examples/) and runnable with `npx tsx`.

---

### Tutorial 1 — Buy a Coin

The most fundamental operation. Spend SOL, receive a token. Works on both the bonding curve and the graduated AMM — the pump.fun API auto-detects which.

```ts
import { Connection, Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { solana } from '@agenti/sdk'

const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!))
const trader = solana({ keypair, connection })

const result = await trader.buy({
  mint: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', // token mint
  solAmount: 0.1,  // 0.1 SOL
  slippage: 5,     // 5%
})

console.log(result.explorerUrl)
// → https://solscan.io/tx/...
```

**Run it:**
```bash
SOLANA_PRIVATE_KEY=<your-key> npx tsx examples/01-buy-a-coin.ts
```

Under the hood, `trader.buy()` calls `POST https://fun-block.pump.fun/agents/swap`, deserializes the returned transaction, signs it with your keypair, and confirms it. The API automatically routes to the bonding curve or AMM based on the coin's current state.

---

### Tutorial 2 — Give a Wallet to an Agent

Wallets are keypairs. Agenti generates EVM + Solana in one call, or loads from any key format.

```ts
import { generateWallet, solana } from '@agenti/sdk'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

// Generate a fresh wallet — store these keys securely
const wallet = generateWallet()
console.log('EVM:    ', wallet.evm.address)
console.log('Solana: ', wallet.solana.address)
console.log('Key:    ', bs58.encode(wallet.solana.privateKey)) // Phantom-compatible

// Load existing wallet and give it to a trader instance
const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!))
const trader = solana({ keypair, rpc: process.env.SOLANA_RPC_URL })

// trader now has signing authority — pass it to any agent
```

For MCP-based agents (Claude, Cursor), the wallet key lives in `AGENTI_SOLANA_PRIVATE_KEY` in your MCP server config. The LLM never sees the key — it just calls tools.

---

### Tutorial 3 — Let an Agent Decide What to Buy

Wire Claude (or any LLM) as the decision-maker. The agent reads market data, picks a token, and executes the trade autonomously using the Anthropic SDK.

```ts
import Anthropic from '@anthropic-ai/sdk'
import { solana } from '@agenti/sdk'

const anthropic = new Anthropic()
const trader = solana({ keypair, connection })

const tools: Anthropic.Tool[] = [
  {
    name: 'get_trending_tokens',
    description: 'Get top trending tokens on pump.fun',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'buy_token',
    description: 'Buy a token with SOL',
    input_schema: {
      type: 'object',
      properties: {
        mint: { type: 'string' },
        sol_amount: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['mint', 'sol_amount', 'reason'],
    },
  },
]

// Agentic loop — Claude picks a token and fires the buy
let messages: Anthropic.MessageParam[] = [
  { role: 'user', content: 'Find a trending token and buy 0.01 SOL worth. Be decisive.' },
]

while (true) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools,
    messages,
  })
  messages.push({ role: 'assistant', content: response.content })

  if (response.stop_reason === 'end_turn') break

  if (response.stop_reason === 'tool_use') {
    const results = await Promise.all(
      response.content
        .filter((b) => b.type === 'tool_use')
        .map(async (b) => {
          if (b.type !== 'tool_use') return
          if (b.name === 'buy_token') {
            const { mint, sol_amount } = b.input as { mint: string; sol_amount: number }
            const result = await trader.buy({ mint, solAmount: sol_amount, slippage: 5 })
            return { type: 'tool_result' as const, tool_use_id: b.id, content: JSON.stringify(result) }
          }
          return { type: 'tool_result' as const, tool_use_id: b.id, content: '[]' }
        })
    )
    messages.push({ role: 'user', content: results.filter(Boolean) as Anthropic.ToolResultBlockParam[] })
  }
}
```

**Run it:**
```bash
ANTHROPIC_API_KEY=sk-... SOLANA_PRIVATE_KEY=<key> npx tsx examples/03-agent-buys.ts
```

---

### Tutorial 4 — Buy on Migration

When a bonding curve fills up (~$69k market cap), the token "graduates" to the PumpSwap AMM. This is a tradeable moment. `watchMigration` fires the instant it detects graduation.

```ts
import { solana } from '@agenti/sdk'

const trader = solana({ keypair, connection })

// Check current state first
const state = await trader.coinState(MINT)
console.log(state.phase) // 'bonding' | 'migrating' | 'graduated'

// Watch and buy the instant it migrates
const stop = trader.watchMigration(
  MINT,
  async ({ mint, pool }) => {
    console.log(`Graduated! Pool: ${pool}`)

    const result = await trader.buy({
      mint,
      solAmount: 0.05,
      slippage: 15,        // higher slippage for volatility at migration
      priorityFee: 100_000 // priority fee for faster inclusion
    })

    console.log(`Bought post-migration: ${result.explorerUrl}`)
    stop() // unsubscribe
  },
  { pollIntervalMs: 1500 } // poll every 1.5 seconds
)
```

**Run it:**
```bash
SOLANA_PRIVATE_KEY=<key> MINT=<mint> npx tsx examples/04-buy-on-migration.ts
```

The watcher polls `https://frontend-api-v3.pump.fun/coins-v2/{mint}` for the `complete` field and `pump_swap_pool` address. For production, pass `useLogs: true` to use a WebSocket subscription to the pump.fun program logs instead — lower latency but requires a reliable RPC (Helius, Triton, QuickNode).

---

### Tutorial 5 — Sell on Migration

Bought on the bonding curve, want to exit at graduation before post-migration volatility? `watchMigration` + `sell` handles it.

```ts
import { solana } from '@agenti/sdk'

const trader = solana({ keypair, connection })

// Watch and exit the moment bonding curve completes
const stop = trader.watchMigration(
  MINT,
  async ({ mint }) => {
    const result = await trader.sell({
      mint,
      tokenAmount: 50000, // tokens to sell (human units)
      slippage: 15,
    })
    console.log(`Sold on migration: ${result.explorerUrl}`)
    stop()
  },
  { pollIntervalMs: 1500 }
)
```

**Run it:**
```bash
SOLANA_PRIVATE_KEY=<key> MINT=<mint> TOKEN_AMOUNT=50000 npx tsx examples/05-sell-on-migration.ts
```

---

### How Selling Works

`trader.sell()` calls the same `POST https://fun-block.pump.fun/agents/swap` endpoint, but with `inputMint = token` and `outputMint = native SOL`. Token amounts use **6 decimal places** — `1000` human tokens = `1_000_000_000` raw units. Agenti handles the conversion automatically.

```ts
// Sell 1000 tokens
await trader.sell({ mint, tokenAmount: 1000, slippage: 5 })
// → sends amount: "1000000000" (6 decimals) to the API internally
```

---

### Install for Examples

```bash
npm install @agenti/sdk @pump-fun/pump-sdk @pump-fun/pump-swap-sdk @pump-fun/agent-payments-sdk
npm install @solana/web3.js@^1.98.2 bs58 tsx
```

Or clone this repo and run from `examples/`:
```bash
git clone https://github.com/nirholas/agenti
cd agenti && pnpm install
cd examples
SOLANA_PRIVATE_KEY=<key> npx tsx 01-buy-a-coin.ts
```

---

## Roadmap

The current release is v0.1 — the foundation. Here's where this goes:

### v0.2 — Multi-token, Multi-chain
- [ ] USDC on Arbitrum, Ethereum, Polygon
- [ ] USDT support across chains
- [ ] Native ETH and SOL payments (not just stablecoins)
- [ ] Multi-chain balance aggregation in a single call
- [ ] ENS + SNS address resolution (`agent.pay('agent.eth')`)
- [ ] Token price oracle integration (pay in any token, settle in USDC)

### v0.3 — Agent Identity
- [ ] ERC-8004 on-chain agent identity registration (22 EVM chains)
- [ ] Agent wallet addresses linked to on-chain identity NFTs
- [ ] Agent reputation scoring derived from payment history
- [ ] Discoverable payment endpoints via `.well-known/agent.json`
- [ ] DID (Decentralized Identifier) support for agent wallets
- [ ] Verifiable credential issuance for agent payment history

### v0.4 — Agent-to-Agent Payments
- [ ] Direct A2A payments: orchestrator agent pays sub-agents for completed work
- [ ] Payment channels — off-chain micropayment streams, settle on demand
- [ ] Task invoicing — agent emits invoice, orchestrator pays on completion
- [ ] Multi-party escrow for trustless agent coordination
- [ ] Atomic task + payment (pay only if the task output passes a verifier)
- [ ] Negotiation protocol — agents bid on tasks, lowest bid wins

### v0.5 — Budgets & Spending Controls
- [ ] Per-session spending limits for AI agents
- [ ] Allowlists for approved payment recipients
- [ ] Budget delegation — parent agent allocates sub-budget to child agents
- [ ] Automatic top-up when balance falls below threshold
- [ ] Human approval gates for payments above configurable threshold
- [ ] Spending analytics — where did the agent spend, on what, when
- [ ] Role-based payment policies for multi-agent systems

### v0.6 — Earning & Yield
- [ ] x402-gate your own agent's capabilities — earn when others use you
- [ ] Idle balance yield via USDs (Sperax) — 8–25% APY, auto-compound
- [ ] Payment streaming — agents earn per-second for ongoing subscriptions
- [ ] Revenue sharing between agent operator and agent owner
- [ ] Earnings dashboard with CSV export for accounting
- [ ] Tax reporting helpers (cost basis, realized gains)

### v0.7 — Plugin Ecosystem
- [ ] `@agenti/plugin-stripe` — agents accept card payments, cash out to bank
- [ ] `@agenti/plugin-bitrefill` — buy gift cards, eSIMs, mobile top-ups with agent balance
- [ ] `@agenti/plugin-uniswap` — auto-swap to correct token before payment
- [ ] `@agenti/plugin-bridge` — cross-chain: hold SOL, pay USDC on Base transparently
- [ ] `@agenti/plugin-paypal` — fiat on/off ramp for agents
- [ ] `@agenti/plugin-lightning` — Bitcoin Lightning payments
- [ ] Plugin registry at `agenti.cash/plugins`

### v0.8 — Developer Tooling
- [ ] `agenti-server` — one decorator turns any function into a paid API endpoint
- [ ] Real-time spending dashboard with WebSocket balance updates
- [ ] Webhooks — fire on payment sent, payment received, low balance, earn event
- [ ] TypeScript SDK expanded to 20+ chains via Viem + Solana Kit
- [ ] **Python SDK** (`agenti-py`) — for LangChain, AutoGen, CrewAI, DSPy, Haystack
- [ ] **Go SDK** — for high-performance agent infrastructure
- [ ] Rust SDK — for on-chain programs and ultra-low-latency agents
- [ ] CLI — `agenti send 5 USDC to 0x... --from my-agent`
- [ ] Postman / Bruno collection for testing paid APIs

### v0.9 — Enterprise & Compliance
- [ ] Multi-sig agent wallets (require N-of-M approvals above threshold)
- [ ] Audit logs — immutable on-chain record of all agent payments
- [ ] SOC 2 compliance helpers for enterprise agentic deployments
- [ ] VASP compliance tooling for regulated environments
- [ ] Batch payments — one transaction settles thousands of micropayments
- [ ] Gas abstraction — agents never need to manage gas tokens

### v1.0 — The Agent Payment Network
- [ ] Public agent registry — discover agents that accept payment, what they offer, and their price
- [ ] Composable agentic pipelines with automatic payment routing between steps
- [ ] Cross-agent settlement batching — reduce on-chain cost of millions of micropayments
- [ ] Agent payment reputation — fraud detection, blacklists, trust scores
- [ ] Decentralized facilitator network — no single point of failure for x402 settlement
- [ ] **Agenti Chain** — purpose-built L2 optimized for agent micropayments: instant finality, sub-cent fees, native x402 support

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        AI Agent Layer                        │
│  Claude · GPT-4 · Llama · Gemini · Mistral · Custom LLM     │
│  LangChain · AutoGen · CrewAI · ElizaOS · Vercel AI SDK     │
└────────────────────────┬─────────────────────────────────────┘
                         │  MCP tools / SDK calls
        ┌────────────────▼─────────────────┐
        │            @agenti/mcp           │
        │   MCP server · stdio transport   │
        │   create_wallet · pay · balance  │
        │   create_invoice · check_payment │
        └────────────────┬─────────────────┘
                         │
        ┌────────────────▼─────────────────┐
        │            @agenti/sdk           │
        │   agenti({ privateKey })         │
        │   .pay(url)  → auto 402 handler  │
        │   .balance() → multi-chain       │
        │   .receive() → invoice creation  │
        └──────────┬──────────────┬────────┘
                   │              │
        ┌──────────▼──┐   ┌───────▼──────────┐
        │   EVM Path  │   │   Solana Path     │
        │             │   │                  │
        │  x402       │   │  pump.fun agent  │
        │  EIP-3009   │   │  payments SDK    │
        │  USDC/Base  │   │  SOL + SPL       │
        │  Arbitrum   │   │  mainnet-beta    │
        │  Ethereum   │   │                  │
        │  Polygon    │   │                  │
        └──────────┬──┘   └───────┬──────────┘
                   │              │
        ┌──────────▼──────────────▼──────────┐
        │            @agenti/core            │
        │   EVM wallet  ·  Solana wallet     │
        │   viem        ·  @solana/web3.js   │
        │   generateWallet · walletFromKeys  │
        └────────────────────────────────────┘
                         │
        ┌────────────────▼─────────────────┐
        │          Payment Rails           │
        │                                  │
        │  x402 facilitator (EVM)          │
        │  ├─ Base mainnet USDC            │
        │  ├─ Arbitrum mainnet USDC        │
        │  └─ Ethereum mainnet USDC        │
        │                                  │
        │  pump.fun Agent Payments (SOL)   │
        │  └─ Solana mainnet SPL           │
        └──────────────────────────────────┘
```

---

## Supported Networks

| Network | Native Token | Stablecoin | Payment Standard | Status |
|---|---|---|---|---|
| Base | ETH | USDC | x402 / EIP-3009 | ✅ v0.1 |
| Solana | SOL | USDC (SPL) | pump.fun agent pmts | ✅ v0.1 |
| Arbitrum | ETH | USDC | x402 / EIP-3009 | 🔜 v0.2 |
| Ethereum | ETH | USDC | x402 / EIP-3009 | 🔜 v0.2 |
| Polygon | MATIC | USDC | x402 / EIP-3009 | 🔜 v0.2 |
| Optimism | ETH | USDC | x402 / EIP-3009 | 🔜 v0.3 |
| BSC | BNB | USDT | x402 / EIP-3009 | 🔜 v0.3 |
| Avalanche | AVAX | USDC | x402 / EIP-3009 | 🔜 v0.3 |
| Monad | MON | USDC | x402 / EIP-3009 | 🔜 v0.4 |
| Agenti Chain | AGT | USDC | native x402 | 🔜 v1.0 |

---

## Use Cases

### Autonomous Research Agents
A research agent needs to access premium data sources, academic paper APIs, financial market feeds, and proprietary datasets. With agenti, it pays for each query automatically — no human credit card, no API key rotation, no billing dashboard. The agent funds itself from its own earnings and spends what it needs.

### AI Agent Marketplaces
Agents list their capabilities (code review, data analysis, image generation, translation) at a price in USDC. Other agents browse the registry, pay, and receive the output — fully automated. Agenti provides the payment rails that make agent economies real.

### Paid MCP Servers
Any MCP server can gate its tools behind a micropayment. The client (Claude, Cursor, etc.) pays automatically using agenti before calling the tool. This creates a new monetization model for MCP tool authors — you get paid every time an AI uses your tool.

### Multi-Agent Pipelines & Agentic Workflows
An orchestrator agent breaks a complex task into sub-tasks, delegates to specialist agents, and pays each one on completion. Budget is allocated at the start, spent as work is done, and unused balance is returned. Agenti handles the entire financial layer of the pipeline.

### Autonomous Trading Agents
Trading agents hold working capital in USDC, pay for execution via DEX APIs, receive proceeds from completed trades, and automatically rebalance across chains. Agenti provides the wallet infrastructure and payment primitives for fully autonomous DeFi operations.

### AI-Powered SaaS
Charge per-call for any AI service without building a billing system. Add x402 middleware to your endpoint, set a price, and agenti-powered clients pay automatically. No Stripe integration, no API keys to issue, no invoicing. Revenue flows on-chain in real time.

### Data Labeling & RLHF Pipelines
AI training pipelines pay human labelers or other AI validators per annotation. Agenti enables programmatic micropayments per task — labelers receive USDC to their wallet as work is verified.

### Decentralized AI Inference
Pay AI inference providers (compute nodes) per token generated, per image generated, per audio second transcribed — all programmatically, all on-chain. Agenti makes per-token compute billing a primitive, not an integration project.

### Agent Memory & Storage
Agents pay for vector database queries, long-term memory storage, and RAG retrieval per use. Storage providers get paid per read/write. Agenti makes AI infrastructure usage-based from the ground up.

---

## Standards

Agenti is built on open standards — not proprietary rails. Everything is auditable, forkable, and chain-agnostic.

| Standard | What It Does | Used For |
|---|---|---|
| [x402](https://github.com/coinbase/x402) | HTTP-native payment protocol | Triggering and settling payments from `pay()` |
| [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) | Gasless ERC-20 transfers via signature | EVM payments without needing ETH for gas |
| [EIP-712](https://eips.ethereum.org/EIPS/eip-712) | Typed structured data signing | Signing payment authorizations safely |
| [ERC-8004](https://erc8004.agency) | On-chain AI agent identity as ERC-721 NFT | Linking wallets to on-chain agent identities |
| [MCP](https://modelcontextprotocol.io) | Model Context Protocol | Exposing payment tools to any LLM client |
| [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) | HD wallet derivation paths | Deterministic wallet generation from seed |
| [W3C DID](https://www.w3.org/TR/did-core/) | Decentralized identifiers | Agent identity (v0.3) |

---

## Security

- Private keys are never transmitted over the network — all signing happens locally
- EIP-3009 authorizations are time-bounded (`validBefore` expiry prevents replays)
- Each authorization uses a random nonce — no authorization can be replayed
- Agenti never stores keys — bring your own key management (env vars, KMS, HSM, MPC)
- x402 payment verification is done on-chain by the facilitator — no trust in the server required
- Open source and auditable — every line of the signing logic is in this repo

---

## Self-Hosted Facilitator

By default, agenti uses the public x402 facilitator for payment settlement. For production deployments or regulated environments, run your own:

```bash
npx @agenti/facilitator --port 3001 --network base-mainnet
```

Then configure agenti to use it:

```ts
const agent = agenti({
  evm: { privateKey: '0x...' },
  facilitator: 'https://your-facilitator.example.com',
})
```

---

## Comparison

| Feature | Agenti | Stripe | Coinbase Commerce | Circle |
|---|---|---|---|---|
| Works without human approval | ✅ | ❌ | ❌ | ❌ |
| No API keys or accounts | ✅ | ❌ | ❌ | ❌ |
| Gasless payments | ✅ | N/A | ❌ | ❌ |
| Agent-to-agent payments | ✅ | ❌ | ❌ | ❌ |
| Open standard (x402) | ✅ | ❌ | ❌ | ❌ |
| Works in any HTTP client | ✅ | ❌ | ❌ | ❌ |
| Per-request micropayments | ✅ | ❌ | ❌ | ❌ |
| MCP-native | ✅ | ❌ | ❌ | ❌ |
| On-chain settlement | ✅ | ❌ | ✅ | ✅ |
| Yield on idle balance | 🔜 v0.6 | ❌ | ❌ | ✅ |

---

## Contributing

Agenti is early. The agentic economy is being built right now and the financial infrastructure is lagging.

**What we need:**
- SDK integrations for more AI frameworks (LangGraph, DSPy, Haystack, Semantic Kernel)
- More chain support (Optimism, BSC, Monad, Berachain)
- Python SDK (`agenti-py`)
- x402 server middleware for more frameworks (FastAPI, Hono, Nitro, Bun)
- Facilitator implementations for more networks
- Battle testing — find edge cases in the payment flow

Open an issue, open a PR, or reach out at `agenti.cash`.

---

## Related

These open standards and tools form the broader ecosystem agenti is part of:

- [x402](https://github.com/coinbase/x402) — the HTTP payment protocol agenti is built on
- [ERC-8004](https://erc8004.agency) — on-chain agent identity standard
- [Model Context Protocol](https://modelcontextprotocol.io) — the tool protocol agenti's MCP server implements
- [pump.fun Agent Payments](https://pump.fun) — Solana agent payment program
- [Viem](https://viem.sh) — the EVM library powering agenti's EVM wallet and signing

---

## License

All rights reserved. See [LICENSE](LICENSE).

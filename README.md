# agenti

Give any AI agent a crypto wallet and the ability to pay for things.

## Install

```bash
pnpm add @agenti/sdk
```

## 30-second example

```ts
import { agenti } from '@agenti/sdk'

const agent = agenti({ evm: { privateKey: process.env.EVM_KEY as `0x${string}` } })

// If the server returns 402, agenti signs an EIP-3009 USDC transfer
// on Base and retries automatically.
const res = await agent.pay('https://api.example.com/data')
console.log(await res.json())
```

Run it:

```bash
EVM_KEY=0x... npx tsx examples/03-pay-for-api.ts
```

## What it does

- **`pay(url, init?)`** — make an HTTP request, auto-pay if the server returns 402
- **`balance()`** — get USDC + SOL balances for the agent's wallet
- **`receive({ amount, token, chain })`** — create a payment invoice
- **`generateWallet()`** — generate a fresh EVM + Solana keypair

```ts
import { agenti, generateWallet } from '@agenti/sdk'

const wallet = generateWallet()
// { evm: { address, privateKey }, solana: { address, privateKey } }

const agent = agenti({
  evm: { privateKey: wallet.evm.privateKey },
  solana: { privateKey: wallet.solana.privateKey },
})

const balances = await agent.balance()
// [{ token: 'USDC', amount: '0.00', chain: 'base' }, { token: 'SOL', amount: '0', chain: 'solana' }]

const invoice = await agent.receive({ amount: 5, token: 'USDC', chain: 'base' })
// { id, address, amount, token, chain, expiresAt }
```

## Agent frameworks

| Framework | Import                                |
|-----------|---------------------------------------|
| LangChain | `@agenti/sdk/langchain`               |
| Vercel AI | `@agenti/sdk/vercel-ai`               |
| ElizaOS   | `@agenti/sdk/eliza`                   |
| CrewAI    | `agenti` (Python) — _coming soon_     |

### LangChain

```ts
import { agentiLangChainTools } from '@agenti/sdk/langchain'

const tools = agentiLangChainTools({
  evm: { privateKey: process.env.EVM_KEY as `0x${string}` },
})
// → [agenti_pay, agenti_balance, agenti_receive]
```

### Vercel AI

```ts
import { agentiTools } from '@agenti/sdk/vercel-ai'
import { generateText } from 'ai'

const tools = agentiTools({
  evm: { privateKey: process.env.EVM_KEY as `0x${string}` },
})

await generateText({
  model: openai('gpt-4o'),
  tools,
  prompt: 'Pay https://api.example.com/data and summarize the response.',
})
```

### ElizaOS

```ts
import { agentiPlugin } from '@agenti/sdk/eliza'

export default {
  name: 'my-agent',
  plugins: [agentiPlugin({ evm: { privateKey: process.env.EVM_KEY as `0x${string}` } })],
}
```

## MCP server

```bash
npx @agenti/mcp
```

Add to Claude Desktop / Claude Code / Cursor config:

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

### Tools

| Tool             | Description                                                                  |
|------------------|------------------------------------------------------------------------------|
| `create_wallet`  | Generate a fresh EVM + Solana wallet and return addresses + private keys     |
| `get_balance`    | Get USDC (Base) and SOL balances for the agent's wallet                      |
| `pay`            | Fetch a URL — handles 402 Payment Required automatically (x402)              |
| `create_invoice` | Create a payment request — returns an address and amount to receive         |
| `check_payment`  | Check whether an invoice has been fulfilled by querying on-chain balances    |

## Packages

| Package          | Description                                                       |
|------------------|-------------------------------------------------------------------|
| `@agenti/core`   | Wallet generation (EVM + Solana)                                  |
| `@agenti/sdk`    | `pay`, `balance`, `receive` + LangChain / Vercel AI / Eliza tools |
| `@agenti/mcp`    | MCP server exposing wallet and payment tools                      |

## License

Apache-2.0

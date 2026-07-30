# agenti examples

Give AI agents the ability to use cryptocurrency

## Example 1

```text
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

## Example 2

```bash
SOLANA_PRIVATE_KEY=<your-key> npx tsx examples/01-buy-a-coin.ts
```

## Example 3

```bash
ANTHROPIC_API_KEY=sk-... SOLANA_PRIVATE_KEY=<key> npx tsx examples/03-agent-buys.ts
```

## Example 4

```bash
SOLANA_PRIVATE_KEY=<key> MINT=<mint> npx tsx examples/04-buy-on-migration.ts
```

## Example 5

```bash
SOLANA_PRIVATE_KEY=<key> MINT=<mint> TOKEN_AMOUNT=50000 npx tsx examples/05-sell-on-migration.ts
```

## Example 6

```bash
npm install @agenti/sdk @pump-fun/pump-sdk @pump-fun/pump-swap-sdk @pump-fun/agent-payments-sdk
npm install @solana/web3.js@^1.98.2 bs58 tsx
```

## Example 7

```bash
git clone https://github.com/nirholas/agenti
cd agenti && pnpm install
cd examples
SOLANA_PRIVATE_KEY=<key> npx tsx 01-buy-a-coin.ts
```

## Example 8

```text
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


Every snippet above is taken from the [repository documentation](https://github.com/nirholas/agenti#readme).

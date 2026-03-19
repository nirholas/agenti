# create-x402

Scaffold x402 projects from official templates.

## Quick start

```bash
npx create-x402
```

Select a template, name your project, and you're ready to go.

## Available templates

**Starter kit**
- [Starter kit](https://github.com/dabit3/x402-starter-kit) — full-featured x402 starter with Express, OpenAI, and Docker

**Full-stack apps** ([Coinbase examples](https://github.com/coinbase/x402/tree/main/examples/typescript))
- Next.js app — route protection with x402-next middleware
- Next.js mainnet — Base mainnet with Coinbase hosted facilitator
- Next.js advanced — paywall + session cookie after verify/settle
- Browser wallet — Hono server + React client with payments
- Farcaster Mini App — x402-protected APIs using MiniKit
- Auth-based pricing — SIWE + JWT with conditional pricing

**Servers**
- Express — x402-express middleware
- Hono — x402-hono middleware
- Express advanced — delayed settlement, dynamic pricing
- Server mainnet — accept real USDC on Base mainnet

**Agents**
- Anthropic agent — pays via Go proxy using x402-fetch
- Dynamic agent — discovers tools and pays per-request

**Infrastructure**
- MCP server — paid API requests via x402-axios
- MCP embedded wallet — Electron with embedded wallet signing
- Discovery — list x402-protected resources (Bazaar)
- Facilitator — payment facilitator with /verify and /settle

## License

MIT

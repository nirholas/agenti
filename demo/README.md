# Agenti Cloud demo

Live: <https://agenti.ninabrekkerese.workers.dev>

This Cloudflare Worker serves the Agenti landing page and **Agenti Cloud** at `/app/`, a console you sign in to with an Ethereum (SIWE) or Solana (SIWS) wallet. The console includes:

- **Agent wallets.** Generate EVM or Solana key pairs in the browser (the secret never leaves the page) or register an existing address. Live native and USDC balances on Base, Polygon, Avalanche and their testnets, plus Solana.
- **x402 paywalls.** Put any public HTTPS API behind `/x/<id>`. Callers pay per request in USDC on Base Sepolia. Payments are verified and settled through the public `x402.org` facilitator and go straight to your address.
- **Pay console.** Point it at any x402 resource, inspect the `402` quote (v1 and v2), sign an EIP-3009 authorization with a connected wallet or an agent key, and see the response and the settlement transaction.
- **Payments ledger.** Every payment received by your paywalls and sent from the console, with explorer links.
- **Market tools.** The 59 typed tools from `packages/market` (news, prices, DeFi, derivatives, on-chain), runnable from forms generated from their JSON Schema.
- **MCP endpoint.** `POST /mcp` speaks stateless Streamable HTTP JSON-RPC and exposes the market tools plus `wallet_balances`, `x402_inspect`, `list_paywalls` and `list_agent_wallets`.
- **API keys and usage.** `/mcp`, `/api/market/run/*`, `/api/pay/*` and wallet balances accept `Authorization: Bearer <key>`, and every call is logged to the usage tab.

## Layout

| Path | Purpose |
|---|---|
| `src/worker.ts` | Routes, D1 schema bootstrap, paywall proxy and MCP server |
| `src/x402.ts` | x402 quote parsing, facilitator verify/settle and balance lookups |
| `src/kit/` | Server half of the shared wallet-auth kit: SIWE/SIWS, sessions, API keys, usage logging |
| `kit/` | Browser half of the kit (`kit.js`, `kit.css`), served at `/kit/` |
| `client/agent.ts` | Browser key generation and x402 payment signing, bundled to `/app/agent.js` |
| `site/` | Landing page, console (`app/`) and 404 page |
| `build.sh` | Vendors `../packages/market` into `src/market`, assembles `public/` and bundles the signer |

## Deploy

Put `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment, then run:

```bash
npm install
./build.sh
npx wrangler d1 create agenti-demo   # first deploy only; put the printed id in wrangler.toml
npx wrangler deploy
openssl rand -base64 48 | npx wrangler secret put SESSION_SECRET   # first deploy only
```

The worker creates its D1 tables the first time it gets a request.

## Try it

1. Sign in at `/app/` and create a paywall in front of, for example, `https://api.coingecko.com/api/v3/ping` at `0.01` USDC.
2. Get free Base Sepolia USDC from <https://faucet.circle.com>.
3. Open the Pay console, paste the paywall URL, choose the Base Sepolia option and sign. The settled transaction appears under Payments.

## API

```bash
curl -s https://agenti.ninabrekkerese.workers.dev/api/market/tools
curl -s -X POST https://agenti.ninabrekkerese.workers.dev/api/market/run/get_coin_prices \
  -H "Authorization: Bearer $AGENTI_KEY" -H "content-type: application/json" -d '{"coins":"bitcoin,ethereum"}'
curl -s https://agenti.ninabrekkerese.workers.dev/mcp -H "Authorization: Bearer $AGENTI_KEY" \
  -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

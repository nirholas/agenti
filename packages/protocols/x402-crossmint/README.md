# Reference implementations: Crossmint Agentic Finance

Reference implementations showing AI agents making autonomous blockchain payments using Crossmint wallets.

## Prerequisites

**Required:**
- Node.js 18.17.0+
- npm 9.0.0+
- Crossmint API key - [Get one](https://www.crossmint.com/console)

**For blockchain interactions:**
- Testnet USDC - [Circle faucet](https://faucet.circle.com/)
- Basic understanding of smart contracts and wallets

**Glossary:**
- **x402**: HTTP payment protocol using `402 Payment Required` status code
- **A2A**: Agent-to-Agent - protocol for AI agents to communicate and transact
- **EOA**: Externally Owned Account - traditional wallet controlled by private key
- **MCP**: Model Context Protocol - standard for AI tool integration

## Quick Start

**Simplest demo:**

```bash
# Clone repository
git clone https://github.com/crossmint/crossmint-agentic-finance.git
cd crossmint-agentic-finance

# Run basic x402 paywall
cd ping
cp .env.example .env
# Edit .env: Set PAY_TO to your address
npm install
npm run dev

# Test in another terminal
curl -i -H "Accept: application/json" http://localhost:3000/ping
# Returns 402 Payment Required with payment details
```

**Learn the payment flow:** See [ping/README.md](./ping/README.md) for generating payment headers and testing settlements.

## Demos by Use Case

### HTTP Paywalls (Start Here)

Minimal servers requiring USDC payment to access endpoints.

| Demo | Chain | Description | Complexity |
|------|-------|-------------|------------|
| [ping](./ping/) | Base Sepolia | Express server, `/ping` endpoint requires payment | Beginner |
| [weather](./weather/) | Base Sepolia | Express server, `/weather?city=X` endpoint requires payment | Beginner |
| [ping-crossmint](./ping-crossmint/) | Base Sepolia | React + Express with Crossmint smart wallet UI integration | Intermediate |
| [pingpong-solana-x402](./pingpong-solana-x402/) | Solana Devnet | React + Cloudflare Worker, Solana USDC via facilitator | Intermediate |

**Start with:** `ping` for pure backend, `ping-crossmint` for full-stack

### Agent-to-Agent Payments

Autonomous agents paying each other for services and tool access.

| Demo | Architecture | Description | Complexity |
|------|--------------|-------------|------------|
| [hello-eoa-a2a](./hello-eoa-a2a/) | Client/Server | Minimal A2A with EOA wallets, EIP-3009 authorization | Beginner |
| [hello-crossmint-wallets-a2a](./hello-crossmint-wallets-a2a/) | React + Express | A2A demo with Crossmint SDK, direct-transfer verification | Intermediate |
| [send-tweet](./send-tweet/) | Agent Service | Twitter posting agent, requires USDC payment per tweet | Intermediate |
| [events-concierge](./events-concierge/) | Durable Objects | MCP-based event RSVP with autonomous payments | Advanced |
| [cloudflare-agents](./cloudflare-agents/) | Cloudflare Workers | Agent-to-agent payments on Cloudflare edge | Advanced |

**Start with:** `hello-eoa-a2a` for basics, `events-concierge` for production patterns

### Production/Real World Examples

Real-world implementations with advanced features.

| Demo | Type | Description | Complexity |
|------|------|-------------|------------|
| [worldstore-agent↗](https://github.com/crossmint/worldstore-agent) | XMTP Agent | Amazon purchases via AI chat with gasless USDC payments on Base | Advanced |
| [x402-ad-agent↗](https://github.com/Must-be-Ash/x402-ad-agent) | Bidding System | Claude-powered agents competing for ad space with autonomous payments | Advanced |
| [events-concierge](./events-concierge/) | agents based calendar slot booking system | event RSVP with payments | Advanced |


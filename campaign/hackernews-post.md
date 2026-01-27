# 📰 Hacker News Post

> **Best time to post**: Weekday, 9-10 AM EST
> **Target**: 100+ points, front page

---

## Post Title

```
Show HN: x402 – HTTP 402 payments for AI agents
```

**Alternative titles (A/B test mentally):**
- "Show HN: Give Claude a wallet – x402 payment protocol for AI"
- "Show HN: Universal Crypto MCP – 380+ blockchain tools for AI agents"
- "Show HN: Making HTTP 402 useful for AI-to-AI payments"

---

## Post URL

```
https://github.com/nirholas/universal-crypto-mcp
```

---

## Initial Comment (Post immediately after submission)

```
Hey HN! Creator here.

I've been building MCP servers for AI assistants, and kept running into the same problem: AI agents can't pay for anything.

Claude can analyze code worth thousands of dollars, but can't buy a $0.05 API call.

So I built x402 - an implementation of HTTP 402 "Payment Required" for AI agents.

**How it works:**

1. Claude makes an HTTP request
2. Server returns 402 + payment details (address, amount, network)
3. Claude signs a payment from its wallet
4. Payment confirms on-chain (we use Arbitrum for speed/cost)
5. Server grants access

The entire flow takes <2 seconds and costs ~$0.001 in gas.

**What's in the box:**

- x402 payment protocol implementation
- 380+ MCP tools for blockchain operations
- Support for 20+ chains (EVM + Solana)
- Built-in yield (USDs stablecoin earns ~5% APY)
- Configurable spending limits and safety features

**Why this matters:**

We're seeing the emergence of AI agents that can browse the web, write code, and take actions. But they can't transact. x402 gives them economic agency.

Use cases we've seen:
- AI paying for premium data APIs
- AI-to-AI service marketplaces  
- Automated micropayments for content
- AI agents that earn by providing services

**Technical details:**

- MCP (Model Context Protocol) for AI integration
- EIP-712 signatures for gasless approvals
- ERC-3009 for transferWithAuthorization
- Works with Claude Desktop, Cursor, any MCP client

**Safety:**

This is clearly powerful/dangerous territory. We've implemented:
- Max payment limits (default $1)
- Address whitelisting
- Testnet mode
- Full transaction logging

**Open source:**

Everything is Apache 2.0. We want this to be infrastructure, not a product.

- Main repo: https://github.com/nirholas/universal-crypto-mcp
- x402 protocol: https://github.com/nirholas/universal-crypto-mcp/tree/main/x402
- npm: @nirholas/universal-crypto-mcp

Would love feedback on the architecture, security model, or use cases you'd like to see.

And if you try it out: the easiest way to test is on Arbitrum with USDs (no gas needed for payments due to ERC-3009).

AMA!
```

---

## Predicted Questions & Prepared Answers

### Q: "Why not just use Stripe/traditional payments?"

```
Great question. Traditional payments have several issues for AI agents:

1. **Account required** - Stripe needs a human to sign up, verify identity, etc. AI agents can't do this autonomously.

2. **Minimum amounts** - Stripe charges ~$0.30 + 2.9%. A $0.05 API call would cost $0.35 in fees. x402 on Arbitrum costs $0.001.

3. **Speed** - Card payments settle in days. x402 settles in seconds.

4. **Programmability** - x402 payments are just signed messages. AI can generate them directly. No OAuth dance, no webhooks.

5. **Cross-border** - Instant global payments with no FX fees.

For large transactions ($10+), traditional payments might make sense. For micropayments and AI-to-AI transactions, crypto rails are significantly better.
```

### Q: "Isn't giving AI money dangerous?"

```
Yes, which is why we built guardrails:

1. **Spending limits**: Default max is $1 per transaction, $10 per day. Configurable.

2. **Whitelisting**: You can whitelist specific addresses/domains.

3. **Testnet mode**: Start on testnet, graduate to mainnet when comfortable.

4. **Transparency**: Every transaction is logged, AI must explain why it's paying.

5. **Human override**: For amounts over threshold, can require human confirmation.

The philosophy: give AI just enough economic agency to be useful, with clear boundaries.

That said, this is early days. I expect the safety model to evolve as we learn more about how AI agents use money.
```

### Q: "What prevents the AI from draining the wallet?"

```
Several mechanisms:

1. **Per-transaction limits**: Max $1 default
2. **Per-day limits**: Configurable daily cap
3. **Balance alerts**: Notify when balance drops below threshold
4. **Purpose logging**: AI must state why it's making each payment

Also worth noting: MCP tools are invoked by the AI, but the human sees the request. In Claude Desktop, you see "Claude wants to use x402_pay_request" before it executes.

For fully autonomous agents, the limits become more important. We recommend starting with small amounts ($10-50) until you're confident in the agent's behavior.
```

### Q: "Why USDs specifically?"

```
Sperax USDs has a few nice properties for this use case:

1. **Auto-yield**: Earns ~5% APY just by holding. No staking required.
2. **ERC-3009**: Supports `transferWithAuthorization`, meaning recipients can pull funds without the sender paying gas.
3. **Arbitrum native**: Fast and cheap.

We support USDC too, but USDs has the yield advantage. Your AI's wallet grows while idle.

Not affiliated with Sperax btw, just found it useful for this use case.
```

### Q: "How does this compare to [other crypto payment protocols]?"

```
Most crypto payment protocols are designed for human-to-merchant transactions. x402 is designed for:

1. **Programmatic clients** (AI agents) that can parse JSON payment requests
2. **Micropayments** ($0.001+) that don't make sense with card fees
3. **API monetization** where the "customer" is software, not a human

The closest comparison is probably Request Network or Superfluid, but those are more focused on invoicing and streaming respectively.

x402 is specifically "HTTP 402 as intended" - a standard way for servers to say "pay me to access this endpoint" and clients to comply.
```

### Q: "What's the business model?"

```
There isn't one (yet). This is infrastructure we wanted to exist.

The protocol is fully open source (Apache 2.0). No fees, no tokens, no rent-seeking.

If it gets adoption, there might be opportunities around:
- Hosted x402 infrastructure
- Enterprise features
- Payment analytics

But for now, just trying to make it useful and see what people build.
```

---

## Engagement Tips for HN

1. **Reply quickly** to early comments - first hour is crucial
2. **Be humble** - acknowledge limitations, welcome criticism
3. **Be technical** - HN appreciates depth
4. **Don't be defensive** - thank critics for feedback
5. **Avoid marketing speak** - just explain what it does
6. **Link to code** - show, don't tell

---

## Metrics to Watch

- Points in first hour (target: 10+)
- Comment engagement
- GitHub stars from HN traffic
- Time on front page

---

## Follow-up Post Ideas (if first does well)

1. "x402 one month later: What we learned giving AI agents money"
2. "How I built a tool marketplace for AI agents"
3. "The economics of AI: When agents have wallets"

---

*Post timing: Weekday 9-10 AM EST for best visibility*

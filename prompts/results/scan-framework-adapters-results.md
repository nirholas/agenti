# Open-Source x402 & Cryptocurrency Payment Adapters for AI Agent Frameworks

status: complete

Comprehensive search results for x402 protocol and cryptocurrency payment integrations with LangChain, Vercel AI SDK, CrewAI, ElizaOS, AutoGen, and DSPy frameworks.

---

## CORE PROTOCOL & OFFICIAL IMPLEMENTATIONS

### 1. Coinbase x402 (Official Protocol Repository)
- **URL:** https://github.com/coinbase/x402
- **License:** Apache-2.0
- **Language:** TypeScript 43.2%, Python 32.9%, Go 22.7%, Solidity 0.5%
- **Key Files:**
  - `/typescript/` — TypeScript SDK
  - `/python/` — Python SDK
  - `/examples/typescript/clients/mcp` — MCP integration examples
  - `/specs/` — Protocol specifications
- **What's Reusable:** Protocol specs, TypeScript/Python client+server implementations, Express middleware patterns, MCP server examples, EVM settlement contract interfaces
- **Clone:** `git clone https://github.com/coinbase/x402 /tmp/x402`
- **Attribution:** `// Adapted from github.com/coinbase/x402 (Apache-2.0)`

---

## LANGCHAIN ADAPTERS

### 2. xpaysh/agent-kit (LangChain x402 Adapter)
- **URL:** https://github.com/xpaysh/agent-kit
- **License:** MIT
- **Language:** TypeScript (monorepo)
- **Key Files:**
  - `packages/@xpaysh/agent-kit-core/` — Core payment protocol client
  - `packages/@xpaysh/agent-kit-langchain/` — LangChain tool integration
  - `packages/@xpaysh/agent-kit-examples/` — Reference implementations
- **What's Reusable:** Drop-in LangChain tool for autonomous x402 payments; spending control patterns (daily/per-call limits); mock API server for testing
- **Implementation Pattern:**
  ```typescript
  spendingLimits: {
    dailyLimit: 1.0,    // $1/day maximum
    perCallLimit: 0.1   // $0.10/call cap
  }
  ```
- **Clone:** `git clone https://github.com/xpaysh/agent-kit /tmp/agent-kit`
- **Attribution:** `// Adapted from github.com/xpaysh/agent-kit (MIT)`

### 3. edgeandnode/ampersend-sdk (LangChain + Multi-Transport)
- **URL:** https://github.com/edgeandnode/ampersend-sdk
- **License:** Apache-2.0
- **Language:** TypeScript 36.6%, Python 29.0%, Solidity 32.9%
- **Key Files:**
  - `typescript/` — Client and server implementations
  - `python/` — SDK package with LangChain integration
- **What's Reusable:** Treasurer/Wallet abstractions; x402 signing with smart accounts; multi-transport support (A2A, MCP, HTTP); Python SDK for agent frameworks
- **Implementation Pattern:** Treasurer → Wallet signing → Client → Server verification
- **Clone:** `git clone https://github.com/edgeandnode/ampersend-sdk /tmp/ampersend-sdk`
- **Attribution:** `// Adapted from github.com/edgeandnode/ampersend-sdk (Apache-2.0)`

---

## VERCEL AI SDK

### 4. vercel-labs/x402-ai-starter (Vercel AI SDK Integration)
- **URL:** https://github.com/vercel-labs/x402-ai-starter
- **License:** Check repository
- **Language:** TypeScript/Next.js 96.6%
- **What's Reusable:** Next.js app router middleware for x402; AI SDK integration with payment gating; MCP server setup for AI agents with costs; Base Sepolia testnet configuration
- **Clone:** `git clone https://github.com/vercel-labs/x402-ai-starter /tmp/x402-ai-starter`
- **Attribution:** `// Adapted from github.com/vercel-labs/x402-ai-starter`

---

## AGENT-TO-AGENT PAYMENTS

### 5. dabit3/a2a-x402-typescript (A2A Payment Pattern)
- **URL:** https://github.com/dabit3/a2a-x402-typescript
- **License:** Apache-2.0
- **Language:** TypeScript 88.2%
- **Key Files:**
  - `x402_a2a/` — Core library
  - `client-agent/` — Payment-enabled orchestrator
  - `merchant-agent/` — Service provider with payment verification
- **What's Reusable:** Agent-to-agent payment request/response patterns; signature verification for settlement; multi-chain payment support; TypeScript types
- **Implementation Pattern:** Merchant throws 402 → client extracts requirements, signs → merchant verifies + settles on-chain
- **Clone:** `git clone https://github.com/dabit3/a2a-x402-typescript /tmp/a2a-x402-typescript`
- **Attribution:** `// Adapted from github.com/dabit3/a2a-x402-typescript (Apache-2.0)`

### 6. google-agentic-commerce/a2a-x402 (A2A Protocol Spec)
- **URL:** https://github.com/google-agentic-commerce/a2a-x402
- **License:** Apache-2.0
- **Language:** Python primary + specs
- **Key Files:**
  - `spec/v0.1/spec.md` — Protocol specification
  - `schemes/` — Experimental payment schemes
- **What's Reusable:** Complete A2A x402 protocol specification; three-step payment flow reference; multi-language examples
- **Clone:** `git clone https://github.com/google-agentic-commerce/a2a-x402 /tmp/a2a-x402`
- **Attribution:** `// Adapted from github.com/google-agentic-commerce/a2a-x402 (Apache-2.0)`

---

## CREWAI ADAPTERS

### 7. kmatthewsio/crewai-x402 (CrewAI x402 Adapter)
- **URL:** https://github.com/kmatthewsio/crewai-x402
- **License:** Check repository
- **Language:** TypeScript/Python
- **What's Reusable:** CrewAI tool integration for x402 payments; autonomous agent crew payment handling; USDC payment on Base L2
- **Clone:** `git clone https://github.com/kmatthewsio/crewai-x402 /tmp/crewai-x402`
- **Attribution:** `// Adapted from github.com/kmatthewsio/crewai-x402`

### 8. rhein1/agoragentic-integrations (Multi-Framework Router)
- **URL:** https://github.com/rhein1/agoragentic-integrations
- **License:** MIT
- **Language:** TypeScript/Python
- **What's Reusable:** Capability routing for autonomous agents; multi-framework support (LangChain, CrewAI, AutoGen); USDC settlement on Base L2; framework-agnostic `execute(task, input, constraints)` pattern
- **Clone:** `git clone https://github.com/rhein1/agoragentic-integrations /tmp/agoragentic-integrations`
- **Attribution:** `// Adapted from github.com/rhein1/agoragentic-integrations (MIT)`

---

## ELIZAOS PAYMENT PLUGINS

### 9. elizaos-plugins/plugin-coinbase (Coinbase Commerce & Trading)
- **URL:** https://github.com/elizaos-plugins/plugin-coinbase
- **License:** Check repository
- **Language:** TypeScript
- **What's Reusable:** Coinbase commerce integration for ElizaOS characters; mass payment action pattern; token contract deployment; trading execution
- **Environment Variables:** `COINBASE_API_KEY`, `COINBASE_PRIVATE_KEY`, `COINBASE_COMMERCE_KEY`
- **Clone:** `git clone https://github.com/elizaos-plugins/plugin-coinbase /tmp/plugin-coinbase`
- **Attribution:** `// Adapted from github.com/elizaos-plugins/plugin-coinbase`

### 10. elizaos-plugins/plugin-lightning (Lightning Network Payments)
- **URL:** https://github.com/elizaos-plugins/plugin-lightning
- **License:** Check repository
- **Language:** TypeScript 99.5%
- **Key Files:**
  - `src/actions/` — CREATE_INVOICE and PAY_INVOICE actions
- **What's Reusable:** Lightning invoice creation pattern; off-chain Bitcoin payment execution; micropayment action patterns; LND node communication
- **Clone:** `git clone https://github.com/elizaos-plugins/plugin-lightning /tmp/plugin-lightning`
- **Attribution:** `// Adapted from github.com/elizaos-plugins/plugin-lightning`

---

## MULTI-PROTOCOL UNIVERSAL FETCH

### 11. leventilo/boltzpay (Protocol-Agnostic Fetch)
- **URL:** https://github.com/leventilo/boltzpay
- **License:** MIT
- **Language:** TypeScript (monorepo)
- **Key Files:**
  - `packages/@boltzpay/sdk` — Universal fetch with auto-detection
  - `packages/@boltzpay/protocols` — x402, L402, MPP adapters
  - `packages/@boltzpay/mcp` — MCP server integration
- **What's Reusable:** Universal `fetch()` that auto-detects x402/L402/MPP and pays; budget enforcement (daily/monthly limits); multi-wallet support with fallback
- **Implementation Pattern:**
  ```typescript
  const agent = new BoltzPay({
    wallets: [{ type: "coinbase", ... }],
    budget: { daily: "5.00" }
  });
  const response = await agent.fetch(url);
  ```
- **Clone:** `git clone https://github.com/leventilo/boltzpay /tmp/boltzpay`
- **Attribution:** `// Adapted from github.com/leventilo/boltzpay (MIT)`

### 12. daydreamsai/lucid-agents (Multi-Protocol Commerce SDK)
- **URL:** https://github.com/daydreamsai/lucid-agents
- **License:** MIT
- **Language:** TypeScript (monorepo)
- **Key Files:**
  - `packages/@lucid-agents/payments` — x402 utilities with tracking
  - `packages/@lucid-agents/wallet` — Wallet management
  - `packages/@lucid-agents/a2a` — Agent-to-agent client
- **What's Reusable:** Payment policy system (daily limits, per-target restrictions, blocklists); bi-directional payment tracking (outgoing + incoming revenue); ERC-8004 identity integration
- **Clone:** `git clone https://github.com/daydreamsai/lucid-agents /tmp/lucid-agents`
- **Attribution:** `// Adapted from github.com/daydreamsai/lucid-agents (MIT)`

---

## SPECIALIZED IMPLEMENTATIONS

### 13. chu2bard/pinion-os (EIP-3009 Gasless Payments)
- **URL:** https://github.com/chu2bard/pinion-os
- **License:** MIT
- **Language:** TypeScript
- **Key Files:**
  - `src/client/x402.ts` — EIP-3009 payment signing
  - `src/server/` — createSkillServer factory
  - `src/plugin/` — MCP plugin integration (12 tools)
- **What's Reusable:** EIP-3009 gasless payment signing pattern; skill server factory with x402 paywalling; automatic USDC settlement on Base
- **Implementation Pattern:** Client signs EIP-3009 → server verifies + settles USDC
- **Clone:** `git clone https://github.com/chu2bard/pinion-os /tmp/pinion-os`
- **Attribution:** `// Adapted from github.com/chu2bard/pinion-os (MIT)`

### 14. AetherCore-Dev/ag402 (Zero-Code Integration)
- **URL:** https://github.com/AetherCore-Dev/ag402
- **License:** MIT
- **Language:** Python 86%, TypeScript 9.1%
- **What's Reusable:** Single-line Python enablement (`ag402_core.enable()`); transparent patching of HTTP libraries; wrapper fetch for Node.js; MCP tool integration; reverse proxy for API monetization
- **Clone:** `git clone https://github.com/AetherCore-Dev/ag402 /tmp/ag402`
- **Attribution:** `// Adapted from github.com/AetherCore-Dev/ag402 (MIT)`

### 15. qntx/x402-openai-typescript (Drop-in OpenAI Client)
- **URL:** https://github.com/qntx/x402-openai-typescript
- **License:** MIT
- **Language:** TypeScript
- **What's Reusable:** Transparent HTTP 402 handling and automatic retry; multi-chain wallet support (EVM + Solana); policy-based payment chain selection; intercept 402 → extract wallet → sign → retry pattern
- **Clone:** `git clone https://github.com/qntx/x402-openai-typescript /tmp/x402-openai-typescript`
- **Attribution:** `// Adapted from github.com/qntx/x402-openai-typescript (MIT)`

### 16. mmdGhanbari/x402-rag (Pay-as-You-Go RAG)
- **URL:** https://github.com/mmdGhanbari/x402-rag
- **License:** Check repository
- **Language:** Python (FastAPI)
- **What's Reusable:** Semantic search with chunk-level pricing; duplicate charge prevention tracking; LangChain tool integration; FastAPI + pgvector backend pattern
- **Clone:** `git clone https://github.com/mmdGhanbari/x402-rag /tmp/x402-rag`
- **Attribution:** `// Adapted from github.com/mmdGhanbari/x402-rag`

---

## RESOURCE HUB

### 17. xpaysh/awesome-x402 (Curated x402 Ecosystem)
- **URL:** https://github.com/xpaysh/awesome-x402
- **Purpose:** Index of 200+ production APIs, 50+ SDKs and tools, all major framework integrations
- **Clone:** `git clone https://github.com/xpaysh/awesome-x402 /tmp/awesome-x402`

---

## SEARCHES WITH NO SIGNIFICANT RESULTS

| Query | Result |
|-------|--------|
| `dspy crypto payment` | No dedicated DSPy adapters — would require custom adapter or LangChain bridge |
| `autogen crypto payment tool` | Limited; agoragentic-integrations covers AutoGen but no dedicated framework |
| `x402 vercel ai sdk middleware` | Only x402-ai-starter found; Vercel's x402-mcp repo appears private |

---

## LICENSE SUMMARY

| License | Repositories |
|---------|-------------|
| MIT | agent-kit, boltzpay, lucid-agents, pinion-os, ag402, x402-openai-typescript, agoragentic-integrations, x402-sdk-ts |
| Apache-2.0 | coinbase/x402, a2a-x402-typescript, google-agentic-commerce/a2a-x402, ampersend-sdk |
| Check repo | vercel-labs/x402-ai-starter, elizaos plugins, crewai-x402, mmdGhanbari/x402-rag |

All MIT and Apache-2.0 licenses are permissive and suitable for commercial use.

---

## RECOMMENDED STARTING POINTS BY FRAMEWORK

| Framework | Primary Adapter | License |
|-----------|----------------|---------|
| LangChain | `xpaysh/agent-kit` | MIT |
| Vercel AI SDK | `vercel-labs/x402-ai-starter` | Check repo |
| CrewAI | `rhein1/agoragentic-integrations` | MIT |
| ElizaOS | `elizaos-plugins/plugin-coinbase` | Check repo |
| AutoGen | `rhein1/agoragentic-integrations` | MIT |
| DSPy | Adapt from `leventilo/boltzpay` | MIT |
| Universal | `leventilo/boltzpay` or `daydreamsai/lucid-agents` | MIT |

---

## CLONE ALL RECOMMENDED REPOS

```bash
mkdir -p /tmp/payment-adapters && cd /tmp/payment-adapters

# Official
git clone https://github.com/coinbase/x402 x402
git clone https://github.com/google-agentic-commerce/a2a-x402 a2a-x402

# Framework Adapters
git clone https://github.com/xpaysh/agent-kit agent-kit
git clone https://github.com/vercel-labs/x402-ai-starter x402-ai-starter
git clone https://github.com/dabit3/a2a-x402-typescript a2a-x402-typescript
git clone https://github.com/kmatthewsio/crewai-x402 crewai-x402
git clone https://github.com/rhein1/agoragentic-integrations agoragentic
git clone https://github.com/edgeandnode/ampersend-sdk ampersend-sdk

# ElizaOS Plugins
git clone https://github.com/elizaos-plugins/plugin-coinbase plugin-coinbase
git clone https://github.com/elizaos-plugins/plugin-lightning plugin-lightning

# Multi-Protocol & Specialized
git clone https://github.com/leventilo/boltzpay boltzpay
git clone https://github.com/daydreamsai/lucid-agents lucid-agents
git clone https://github.com/chu2bard/pinion-os pinion-os
git clone https://github.com/AetherCore-Dev/ag402 ag402
git clone https://github.com/mmdGhanbari/x402-rag x402-rag
git clone https://github.com/qntx/x402-openai-typescript x402-openai-typescript

# Resource Hub
git clone https://github.com/xpaysh/awesome-x402 awesome-x402
```

---

## KEY TAKEAWAYS

1. **x402 is production-ready** — 10.5M+ cumulative transactions, multiple official SDKs
2. **LangChain has the most mature ecosystem** — `xpaysh/agent-kit` is the leading adapter
3. **ElizaOS has native payment plugins** — Coinbase and Lightning with clear action patterns
4. **Multi-protocol libraries** (`boltzpay`, `lucid-agents`) abstract over x402/L402/other protocols — good foundation for agenti's adapter layer
5. **EIP-3009 gasless signing** (pinion-os) is worth studying for the agenti payment flow
6. **No mature DSPy integration** exists — would be net-new work
7. **Zero-code integration possible** with `ag402` (Python) — study its transparent HTTP patching approach

---

*Report generated: 2026-04-17*
*Repositories analyzed: 17 primary + 8 secondary*
*Permissive licenses: 8 MIT, 4 Apache-2.0*

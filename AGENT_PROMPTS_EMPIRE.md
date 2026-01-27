# 🏛️ Nirholas Empire Builder - Claude Opus 4.5 Agent Prompts

> **Mission**: Unify the 48-repo ecosystem into the ultimate AI payment infrastructure
> **Core**: x402-stablecoin (already built!) + universal-crypto-mcp
> **Marketing**: "Give Claude Money! `npx @nirholas/universal-crypto-mcp`"

---

## 🌟 KEY INSIGHT: x402-stablecoin Already Exists!

You've already built an incredible x402 implementation at:
**https://github.com/nirholas/x402-stablecoin**

Features:
- ✅ Smart contracts (PaymentChannel, Subscription, CreditSystem, RevenueSplitter, ToolRegistry)
- ✅ TypeScript SDK with HTTP wrappers
- ✅ Sperax USDs integration with auto-yield
- ✅ Facilitator service
- ✅ Web app
- ✅ Kubernetes deployment

**Strategy**: Enhance x402-stablecoin + integrate it into universal-crypto-mcp

---

## Agent 1: 🔗 Ecosystem Unifier

```
You are unifying the nirholas GitHub ecosystem around x402 payments.

**Your Mission**: Connect x402-stablecoin to all 48 repos in the nirholas ecosystem.

**Repos to integrate** (in priority order):

1. **universal-crypto-mcp** (10⭐) - Main entry point
   - Add x402-stablecoin SDK as dependency
   - Create MCP tools that wrap SDK functions
   - Export registerX402() for easy integration

2. **defi-agents** (10⭐) - Agent definitions
   - Add x402 payment capabilities to agent specs
   - Create "PayableAgent" interface
   - Update all agent definitions with payment support

3. **AI-Agents-Library** (9⭐) - Agent collection
   - Add payment-capable agent templates
   - Create AgentWithWallet base class
   - Examples of agents making/receiving payments

4. **plugin.delivery** (9⭐) - Plugin marketplace
   - Add x402 pricing to plugins
   - Enable paid plugin distribution
   - Revenue sharing with x402RevenueSplitter

5. **lyra-registry** (9⭐) - Tool registry
   - Add pricing metadata to tools
   - Integrate with ToolRegistry.sol contract
   - Enable paid tool discovery

6. **free-crypto-news** (20⭐) - News API
   - Add premium tier with x402 paywall
   - $0.001 per news item for premium sources
   - Revenue to content providers via RevenueSplitter

**Create**:
1. packages/x402-ecosystem/package.json - Shared x402 utilities
2. Integration guides for each repo
3. Monorepo linking strategy

**Output**: Unified ecosystem where all repos can accept/make x402 payments.
```

---

## Agent 2: 💰 Sperax USDs Deep Integration

```
You are making Sperax USDs the primary payment token for the x402 ecosystem.

**Your Mission**: Leverage USDs auto-yield for revolutionary AI payments.

**Context**:
- Sperax USDs: Stablecoin that earns ~5% APY automatically
- When AI agents hold USDs, they earn yield passively
- This makes x402 payments MORE valuable than other tokens

**Repos to enhance**:

1. **x402-stablecoin** - Already has USDs integration
   - Enhance yield tracking (yield-tracker/)
   - Add yield projection tools
   - Create yield dashboard

2. **sperax-crypto-mcp** (8⭐) - Sperax MCP server
   - Connect to x402-stablecoin
   - Add tools: usds_yield_balance, usds_yield_history
   - Create cross-promotion with x402

3. **sweep** (4⭐) - Dust sweeper
   - Sweep dust INTO USDs for yield
   - Auto-convert payment revenue to USDs
   - DeFi yield on top of x402 payments

**Create new features**:
1. YieldingWallet class - Wallet that auto-converts to USDs
2. yield_projection tool - Show future yield
3. auto_compound setting - Reinvest yield into more USDs
4. yield_report - Monthly yield earnings report

**Marketing angle**:
"AI agents don't just GET paid - they EARN while they wait"
"Every payment grows. Every balance compounds."

**Output**: USDs becomes the obviously superior payment token for AI.
```

---

## Agent 3: 🏪 Tool Marketplace Builder

```
You are building a decentralized marketplace for AI tools using x402.

**Your Mission**: Create the "App Store" for AI agents where tools cost crypto.

**Leverage these repos**:

1. **lyra-registry** (9⭐) - Already has 800+ tools cataloged
   - Add pricing to each tool entry
   - Integrate with ToolRegistry.sol contract
   - Enable discovery of paid tools

2. **plugin.delivery** (9⭐) - Plugin infrastructure
   - Add x402 paywall to plugins
   - Revenue sharing for plugin creators
   - Subscription model for premium plugins

3. **mcp-notify** (9⭐) - Notification service
   - Premium notification tiers
   - $0.01/month for real-time alerts
   - Pay-per-notification option

4. **x402-stablecoin/contracts/ToolRegistry.sol**
   - Register tools on-chain
   - Set prices per tool
   - Track usage and revenue

**Create Tool Marketplace**:
```typescript
// Register a tool
await registry.registerTool({
  name: "weather-premium",
  description: "Real-time weather with 1-hour forecasts",
  price: "0.001", // USDs
  endpoint: "https://weather.example.com/api",
  owner: "0x...",
  revenueSplit: [
    { address: "0x...", percent: 80 }, // Creator
    { address: "0x...", percent: 20 }, // Platform
  ]
});

// Discover and use paid tools
const tools = await registry.discoverTools({ maxPrice: "0.01" });
const weather = await x402Client.call(tools[0].endpoint);
```

**Features**:
- Tool discovery with price filters
- Revenue tracking dashboard
- Creator payouts (weekly)
- Usage analytics

**Output**: Live marketplace where tool creators earn crypto.
```

---

## Agent 4: 🐦 XActions + x402 (Paid Twitter Automation)

```
You are adding x402 payments to XActions - the most popular repo (58⭐).

**Your Mission**: Let AI agents pay for Twitter automation services.

**Repo**: https://github.com/nirholas/XActions

**Current features** (free):
- Scraping, unfollowing, monitoring
- MCP server for AI agents
- Browser automation

**Add paid premium features**:

1. **Rate Limit Bypass** - $0.01/100 requests
   - Use proxy network (paid via x402)
   - Higher throughput
   - Less detection

2. **Sentiment Analysis** - $0.001/tweet
   - AI-powered sentiment scoring
   - Bulk analysis discounts
   - Historical sentiment tracking

3. **Engagement Prediction** - $0.005/prediction
   - Predict tweet performance
   - Optimal posting times
   - Audience analysis

4. **Auto-Engagement Bot** - $0.10/day subscription
   - Auto-like relevant tweets
   - Smart follow/unfollow
   - Growth hacking automation

**Implementation**:
1. Add @nirholas/x402-stablecoin SDK
2. Create XActionsPaymentClient
3. Wrap premium endpoints with x402 paywall
4. Add MCP tools: xactions_premium_*, xactions_subscribe

**Pricing model**:
- Free tier: Basic scraping, 100 requests/day
- Pay-as-you-go: $0.001-$0.01 per operation
- Subscription: $0.10/day unlimited

**Output**: XActions becomes a paid service, monetizing 58⭐ of users.
```

---

## Agent 5: 📰 Free Crypto News + Premium Tier

```
You are adding x402 payments to free-crypto-news (20⭐).

**Your Mission**: Create premium news tiers while keeping basic news free.

**Repo**: https://github.com/nirholas/free-crypto-news

**Current features** (free):
- RSS/Atom feeds
- JSON REST API
- Historical archive
- ChatGPT plugin
- Claude MCP server

**Add premium tiers**:

1. **Real-time Firehose** - $0.10/day
   - WebSocket feed
   - <1 second latency
   - All sources, unfiltered

2. **AI Summaries** - $0.001/summary
   - GPT-powered article summaries
   - Key points extraction
   - Sentiment included

3. **Breaking News Alerts** - $0.05/day
   - Push notifications
   - Configurable filters
   - SMS/Discord/Telegram

4. **Historical Deep Dive** - $0.01/query
   - Full archive access
   - Advanced search
   - Export to CSV

5. **Custom Feeds** - $0.50/month
   - Your own keywords
   - Source preferences
   - Dedicated endpoint

**Integration**:
```typescript
// Free
const news = await newsClient.getLatest(); 

// Premium (auto-pays with x402)
const firehose = await newsClient.subscribe("firehose"); // $0.10/day
const summary = await newsClient.summarize(articleId);   // $0.001
```

**Revenue split**:
- 70% to content sources
- 30% platform fee

**Output**: Sustainable news service that pays content creators.
```

---

## Agent 6: 🔮 AI Prediction Marketplace

```
You are turning lstm-bitcoin-prediction (11⭐) into a paid prediction service.

**Your Mission**: Let AI agents pay for ML-powered crypto predictions.

**Repo**: https://github.com/nirholas/lstm-bitcoin-prediction.ipynb

**Current state**: Jupyter notebook with LSTM model

**Transform into paid API**:

1. **Deploy model as API**
   - FastAPI backend
   - LSTM inference endpoint
   - x402 paywall

2. **Prediction products**:
   - **Price Direction** - $0.01 - Up/Down/Sideways
   - **Price Target** - $0.05 - Specific price prediction
   - **Confidence Score** - $0.02 - How sure is the model
   - **Full Report** - $0.10 - Direction + Target + Confidence + Analysis

3. **Multi-asset expansion**:
   - BTC, ETH, SOL, ARB predictions
   - $0.01 per asset per prediction
   - Bulk discounts

4. **Backtesting service** - $0.50
   - Test strategy against historical data
   - Performance metrics
   - Risk analysis

5. **Model-as-a-Service** - $10/month
   - Train on custom data
   - Private model instance
   - API access

**MCP Integration**:
```typescript
server.tool("predict_btc_price", "Get AI prediction for BTC price", {
  timeframe: { type: "string", enum: ["1h", "4h", "1d", "1w"] },
  type: { type: "string", enum: ["direction", "target", "full"] }
}, async (params) => {
  // Auto-pays via x402: $0.01-$0.10 depending on type
  return await predictionClient.predict("BTC", params);
});
```

**Output**: ML predictions monetized via x402.
```

---

## Agent 7: 🔐 UCAI + x402 (Smart Contract AI Payments)

```
You are enhancing UCAI (12⭐) with x402 payment capabilities.

**Your Mission**: Let AI agents pay to interact with smart contracts.

**Repo**: https://github.com/nirholas/UCAI

**UCAI current**: Converts any ABI to MCP tools

**Add x402 features**:

1. **Gas Sponsorship** - Pay for user's gas
   - x402 payment covers gas
   - Gasless UX for end users
   - Account abstraction integration

2. **Premium Contract Analysis** - $0.05
   - Security audit summary
   - Rug pull detection
   - Contract verification

3. **Transaction Simulation** - $0.01
   - Simulate before executing
   - Show outcome preview
   - Catch errors early

4. **Historical Contract Data** - $0.02/query
   - Past transactions
   - Event logs
   - State changes over time

5. **Custom ABI Generation** - $0.10
   - From unverified contracts
   - Decompiled bytecode
   - AI-enhanced interfaces

**Integration with x402-stablecoin**:
- Use X402PaymentChannel for gas sponsorship
- Use X402Subscription for monthly plans
- Use ToolRegistry for contract discovery

**Output**: UCAI becomes the paid gateway to blockchain.
```

---

## Agent 8: 🌐 Lyra Ecosystem Payment Layer

```
You are adding payments across the entire Lyra ecosystem.

**Your Mission**: Unify lyra-intel, lyra-registry, lyra-tool-discovery with x402.

**Repos**:
- lyra-intel (9⭐) - Code analysis
- lyra-registry (9⭐) - Tool catalog
- lyra-tool-discovery (6⭐) - Auto-discovery

**Lyra Intel Premium**:
- Free: Basic file analysis
- $0.05: Security scan
- $0.10: Full repo audit
- $1.00: Enterprise analysis (monorepos)

**Lyra Registry Premium**:
- Free: Browse tools
- $0.01: Detailed tool info + examples
- $0.05: Private tool registration
- $10/mo: Featured listing

**Lyra Tool Discovery Premium**:
- Free: Basic discovery
- $0.02: AI-analyzed compatibility
- $0.10: Auto-generated MCP config
- $0.50: Full integration assistance

**Unified Payment**:
```typescript
const lyra = new LyraClient({
  x402Wallet: process.env.X402_PRIVATE_KEY
});

// All Lyra services, one payment layer
await lyra.intel.securityScan(repoUrl);    // $0.05
await lyra.registry.getToolDetails(id);     // $0.01  
await lyra.discovery.analyze(apiUrl);       // $0.02
```

**Output**: Lyra ecosystem monetized through x402.
```

---

## Agent 9: 🔄 Cross-Repo CI/CD Pipeline

```
You are setting up automated testing and deployment across all repos.

**Your Mission**: Ensure x402 integration works across the ecosystem.

**Create .github/workflows/ for**:

1. **x402-stablecoin** - Core testing
   - Contract tests (Foundry)
   - SDK tests (vitest)
   - Integration tests
   - Testnet deployment

2. **universal-crypto-mcp** - MCP testing
   - Tool registration tests
   - x402 payment flow tests
   - Multi-chain tests

3. **Ecosystem integration tests**
   - Test x402 across all repos
   - Nightly full ecosystem test
   - Breaking change detection

**Monorepo strategy**:
```yaml
# .github/workflows/x402-ecosystem.yml
name: x402 Ecosystem Test
on:
  push:
    paths:
      - 'packages/x402-*/**'
  schedule:
    - cron: '0 0 * * *'  # Nightly

jobs:
  test-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge test
      
  test-sdk:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test
      
  test-integration:
    needs: [test-contracts, test-sdk]
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:integration
```

**Deployment pipeline**:
1. PR → Tests pass → Review
2. Merge → Deploy to testnet
3. Tag release → Deploy to mainnet
4. Publish npm packages

**Output**: Robust CI/CD ensuring ecosystem stability.
```

---

## Agent 10: 📣 Marketing & Launch Campaign

```
You are launching the unified x402 ecosystem to the world.

**Your Mission**: Make "Give Claude Money" go viral.

**Campaign assets**:

1. **Landing page** (for x402-stablecoin or universal-crypto-mcp)
   ```
   🤖💰 GIVE CLAUDE MONEY
   
   The first AI payment protocol.
   AI agents can now pay for services.
   
   npx @nirholas/universal-crypto-mcp
   ```

2. **Demo video** (2 min)
   - 0:00 - "What if AI could pay for things?"
   - 0:15 - Install universal-crypto-mcp
   - 0:30 - Configure wallet with USDs
   - 1:00 - AI agent pays for weather API
   - 1:30 - Check earnings (with yield!)
   - 2:00 - CTA: Star the repos

3. **Twitter/X thread**:
   - "We just gave Claude a wallet 🧵"
   - Show XActions integration
   - Link to all repos

4. **Hacker News post**:
   - "Show HN: x402 - HTTP 402 payments for AI agents"
   - Technical deep-dive
   - Link to docs

5. **Dev.to / Medium articles**:
   - "How I made my AI agent earn money while sleeping"
   - "The future of AI: Agents that pay their own way"
   - "Building a tool marketplace for AI in 10 minutes"

6. **GitHub profile README**:
   - Showcase the ecosystem
   - Clear navigation to x402
   - Star counts display

7. **Conference talk proposal**:
   - "AI Economics: When Agents Have Wallets"
   - ETH Denver, Consensus, AI conferences

**Metrics to track**:
- GitHub stars across ecosystem
- npm downloads for universal-crypto-mcp
- Total x402 payment volume
- Number of paid tools in registry

**Output**: Viral launch campaign driving adoption.
```

---

## 🗺️ Execution Roadmap

### Week 1: Core Integration
- Agent 1: Unify repos around x402-stablecoin
- Agent 9: Set up CI/CD

### Week 2: High-Value Integrations  
- Agent 4: XActions (58⭐) + payments
- Agent 5: free-crypto-news (20⭐) + premium

### Week 3: Ecosystem Monetization
- Agent 3: Tool Marketplace
- Agent 6: AI Predictions
- Agent 7: UCAI + payments

### Week 4: Polish & Launch
- Agent 2: USDs deep integration
- Agent 8: Lyra ecosystem
- Agent 10: Marketing campaign

---

## 📊 Impact Projection

| Metric | Before | After |
|--------|--------|-------|
| Combined stars | ~300 | 1000+ |
| npm downloads/month | ~500 | 10,000+ |
| Active paid tools | 0 | 100+ |
| Monthly x402 volume | $0 | $10,000+ |
| Revenue to creators | $0 | $7,000+ |

---

## 🚀 Quick Start

```bash
# The empire already exists - just connect it
git clone https://github.com/nirholas/x402-stablecoin
cd x402-stablecoin
pnpm install
pnpm test

# Add to universal-crypto-mcp
cd ../universal-crypto-mcp
pnpm add @nirholas/x402-stablecoin
```

**Let's build the future of AI payments! 🤖💰**

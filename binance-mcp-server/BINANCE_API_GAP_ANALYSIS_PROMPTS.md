# Claude Opus 4.5 Agent Prompts: Binance API Gap Analysis

## Purpose
These prompts help agents analyze the official Binance API documentation and identify missing endpoints in the binance-mcp-server implementation.

**Current Implementation:** ~156 tools across 15 modules

---

## Agent 1: Spot Trading API Gap Analysis

### Task
Compare our spot trading implementation against the official Binance Spot API docs.

### Prompt

```
You are analyzing the Binance Spot API to identify missing endpoints.

## Official Documentation
Fetch and analyze: https://developers.binance.com/docs/binance-spot-api-docs/rest-api

## Current Implementation
The binance-mcp-server at `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/spot/` has these sub-modules:
- account-api/
- general-api/
- market-api/
- trade-api/
- userdatastream-api/

## Existing Tools (approximate)
Check the files in each sub-module to see what's implemented.

## Your Tasks

1. **Fetch the official Spot API documentation** from Binance developers portal

2. **Catalog ALL endpoints** in these categories:
   - General Endpoints (ping, time, exchangeInfo)
   - Market Data Endpoints (depth, trades, klines, ticker, avgPrice, etc.)
   - Account Endpoints (account info, myTrades, rateLimit)
   - Trade Endpoints (order, cancelOrder, openOrders, allOrders, OCO, SOR)
   - User Data Stream (create, ping, close)

3. **Compare against our implementation** - read the existing tool files

4. **Output a gap analysis table:**

| Endpoint | Method | Path | Implemented? | Priority |
|----------|--------|------|--------------|----------|
| Test Connectivity | GET | /api/v3/ping | ✅ | - |
| Order Book | GET | /api/v3/depth | ✅ | - |
| SOR Order | POST | /api/v3/sor/order | ❌ | HIGH |
| ... | ... | ... | ... | ... |

5. **Identify missing features:**
   - Self-Trade Prevention modes
   - SOR (Smart Order Routing)
   - Trailing stop orders
   - Cancel Replace orders
   - Prevented matches queries

6. **Provide implementation recommendations** with priority (HIGH/MEDIUM/LOW)

Focus on REST API endpoints. WebSocket streams are separate.
```

---

## Agent 2: Wallet & Sub-account API Gap Analysis

### Task
Analyze Wallet and Sub-account APIs for missing functionality.

### Prompt

```
You are analyzing Binance Wallet and Sub-account APIs.

## Official Documentation
- Wallet: https://developers.binance.com/docs/wallet
- Sub-account: https://developers.binance.com/docs/sub-account/general-info

## Current Implementation
Located at `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/wallet/`:
- account-api/
- asset-api/
- capital-api/
- others-api/
- travel-rule-api/

## Your Tasks

1. **Catalog ALL Wallet endpoints:**
   - System Status
   - Capital (deposit/withdraw)
   - Asset (dust, dividends, conversions)
   - Account (snapshots, permissions, trade fee)
   - Travel Rule compliance

2. **Catalog ALL Sub-account endpoints:**
   - Sub-account Management
   - Asset Management
   - Transfer
   - Deposit/Withdrawal
   - Margin (if applicable to sub-accounts)

3. **Identify missing endpoints:**

| Category | Endpoint | Status | Notes |
|----------|----------|--------|-------|
| Capital | Get Deposit History | ✅ | |
| Capital | Auto-Converting Stable Coins | ❌ | New feature |
| Sub-account | Create Virtual Sub-account | ❌ | Enterprise feature |
| ... | ... | ... | ... |

4. **Flag enterprise-only features** that may not be available to regular users

5. **Prioritize** based on common use cases:
   - HIGH: Deposit/withdraw, transfers
   - MEDIUM: Asset conversion, snapshots
   - LOW: Travel rule, institutional features
```

---

## Agent 3: Margin & Futures API Analysis

### Task
Determine if Margin and Futures trading should be added.

### Prompt

```
You are analyzing Binance Margin and Futures APIs to determine implementation scope.

## Official Documentation
- Margin: https://developers.binance.com/docs/margin-trading
- USD-M Futures: https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info
- COIN-M Futures: https://developers.binance.com/docs/derivatives/coin-margined-futures/general-info

## Current Status
The binance-mcp-server currently has NO margin or futures implementation.

## Your Tasks

1. **Assess scope of Margin API:**
   - Cross Margin endpoints
   - Isolated Margin endpoints
   - Margin account/trade/transfer operations
   - Borrow/repay operations
   - Interest history

2. **Assess scope of Futures API:**
   - USD-M Futures (USDT margined)
   - COIN-M Futures (coin margined)
   - Account, position, order operations
   - Leverage, margin type settings

3. **Create implementation proposal:**

| Module | Estimated Endpoints | Complexity | Priority |
|--------|--------------------:|------------|----------|
| Cross Margin | ~30 | Medium | HIGH |
| Isolated Margin | ~25 | Medium | MEDIUM |
| USD-M Futures | ~60 | High | HIGH |
| COIN-M Futures | ~50 | High | LOW |

4. **Identify shared infrastructure:**
   - Signature handling (same as spot)
   - Different base URLs
   - Position/leverage concepts

5. **Recommend module structure:**
   ```
   modules/
   ├── margin/
   │   ├── cross/
   │   └── isolated/
   └── futures/
       ├── usdt/
       └── coin/
   ```

6. **Risk assessment:** Document trading risks, leverage warnings for AI agent safety
```

---

## Agent 4: Earn Products API Gap Analysis

### Task
Analyze all Binance Earn products (Simple Earn, Staking, Dual Investment, etc.)

### Prompt

```
You are analyzing Binance Earn APIs.

## Official Documentation
- Simple Earn: https://developers.binance.com/docs/simple_earn
- ETH Staking: https://developers.binance.com/docs/staking
- Dual Investment: https://developers.binance.com/docs/dual-investment
- Auto-Invest: https://developers.binance.com/docs/auto-invest

## Current Implementation
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/simple-earn/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/staking/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/dual-investment/`

## Your Tasks

1. **Simple Earn - Catalog ALL endpoints:**
   - Flexible Products (list, subscribe, redeem, position)
   - Locked Products (list, subscribe, position)
   - Flexible rewards history
   - Collateral record
   - Rate history

2. **Staking - Catalog ALL:**
   - ETH Staking (BETH/WBETH)
   - SOL Staking (BNSOL)
   - DOT/ATOM staking if available

3. **Dual Investment - Catalog ALL:**
   - Product list
   - Subscribe
   - Positions
   - Auto-compound settings

4. **Auto-Invest (potentially missing entirely):**
   - Plan management
   - Index-linked plans
   - History

5. **Create gap analysis:**

| Product | Category | Endpoint | Implemented? |
|---------|----------|----------|--------------|
| Simple Earn | Flexible | GET /sapi/v1/simple-earn/flexible/list | ✅ |
| Simple Earn | Locked | GET /sapi/v1/simple-earn/locked/list | ❌ |
| Auto-Invest | Plan | POST /sapi/v1/lending/auto-invest/plan/add | ❌ |
| ... | ... | ... | ... |

6. **Prioritize by user demand:**
   - HIGH: Flexible earn (most popular)
   - MEDIUM: Locked earn, staking
   - LOW: Auto-invest, index products
```

---

## Agent 5: Miscellaneous APIs Gap Analysis

### Task
Analyze remaining APIs: NFT, Pay, Mining, Convert, C2C, Copy Trading, VIP Loan, Rebate.

### Prompt

```
You are analyzing miscellaneous Binance APIs.

## Official Documentation
- NFT: https://developers.binance.com/docs/nft
- Pay: https://developers.binance.com/docs/binance-pay
- Mining: https://developers.binance.com/docs/mining
- Convert: https://developers.binance.com/docs/convert
- C2C (P2P): https://developers.binance.com/docs/c2c
- Copy Trading: https://developers.binance.com/docs/copy-trading
- VIP Loan: https://developers.binance.com/docs/vip-loan
- Rebate: https://developers.binance.com/docs/rebate

## Current Implementation Locations
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/nft/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/pay/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/mining/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/convert/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/c2c/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/copy-trading/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/vip-loan/`
- `/workspaces/universal-crypto-mcp/binance-mcp-server/src/modules/rebate/`

## Your Tasks

1. **For EACH API, create a full endpoint catalog:**

### NFT API
| Endpoint | Method | Implemented? |
|----------|--------|--------------|
| Get NFT Deposit History | GET | ? |
| Get NFT Withdraw History | GET | ? |
| Get NFT Asset | GET | ? |
| ... | ... | ... |

### Pay API
| Endpoint | Method | Implemented? |
|----------|--------|--------------|
| Get Pay Trade History | GET | ? |
| Create Order | POST | ? |
| ... | ... | ... |

### Mining API
(Full catalog)

### Convert API
| Endpoint | Method | Implemented? |
|----------|--------|--------------|
| List All Convert Pairs | GET | ? |
| Send Quote Request | POST | ? |
| Accept Quote | POST | ? |
| Order Status | GET | ? |
| Get Convert Trade History | GET | ? |
| ... | ... | ... |

### C2C API
(Note: P2P trading, may have limited API access)

### Copy Trading API
| Endpoint | Method | Implemented? |
|----------|--------|--------------|
| Get Futures Lead Trader Status | GET | ? |
| Get Symbol Whitelist | GET | ? |
| ... | ... | ... |

### VIP Loan API
(Full catalog)

### Rebate API
(Full catalog)

2. **Identify completely missing APIs:**
   - Gift Card API
   - Algo Trading API extensions
   - Portfolio Margin API
   - Crypto Loans (non-VIP)

3. **Priority assessment:**

| API | Completeness | Priority to Complete |
|-----|-------------|---------------------|
| NFT | 40% | LOW |
| Pay | 20% | MEDIUM |
| Mining | 80% | LOW |
| Convert | 60% | HIGH |
| C2C | 10% | LOW |
| Copy Trading | 30% | MEDIUM |
| VIP Loan | 70% | LOW |
| Rebate | 50% | LOW |

4. **Create implementation tickets** for each missing endpoint
```

---

## How to Use These Prompts

1. **Run each agent** in a separate session
2. **Provide the agent** with:
   - Access to read files in `/workspaces/universal-crypto-mcp/binance-mcp-server/`
   - Web access to fetch Binance API docs
3. **Collect results** in a unified gap analysis document
4. **Prioritize** based on user demand and complexity
5. **Create implementation tasks** with clear specifications

## Expected Output Format

Each agent should produce:
1. **Gap Analysis Table** - all endpoints with implementation status
2. **Missing Features List** - high-priority gaps
3. **Implementation Recommendations** - file structure, complexity estimates
4. **Code Stubs** (optional) - skeleton implementations for missing endpoints

## Official Binance API Documentation Links

| Category | URL |
|----------|-----|
| Spot | https://developers.binance.com/docs/binance-spot-api-docs |
| Wallet | https://developers.binance.com/docs/wallet |
| Margin | https://developers.binance.com/docs/margin-trading |
| Futures (USD-M) | https://developers.binance.com/docs/derivatives/usds-margined-futures |
| Futures (COIN-M) | https://developers.binance.com/docs/derivatives/coin-margined-futures |
| Simple Earn | https://developers.binance.com/docs/simple_earn |
| Staking | https://developers.binance.com/docs/staking |
| Dual Investment | https://developers.binance.com/docs/dual-investment |
| Convert | https://developers.binance.com/docs/convert |
| NFT | https://developers.binance.com/docs/nft |
| Pay | https://developers.binance.com/docs/binance-pay |
| Mining | https://developers.binance.com/docs/mining |
| Copy Trading | https://developers.binance.com/docs/copy-trading |
| Gift Card | https://developers.binance.com/docs/gift-card |

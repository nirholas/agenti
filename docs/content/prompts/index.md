# Prompt Examples Library

> A curated collection of prompts for getting the most out of Universal Crypto MCP.

## Table of Contents

- [Portfolio Management](#portfolio-management)
- [Trading & Swaps](#trading--swaps)
- [DeFi Operations](#defi-operations)
- [Cross-Chain Bridges](#cross-chain-bridges)
- [Market Analysis](#market-analysis)
- [Security & Auditing](#security--auditing)
- [Technical Analysis](#technical-analysis)
- [Developer Tools](#developer-tools)
- [Advanced Workflows](#advanced-workflows)

---

## Portfolio Management

### Quick Balance Check
```
What's my ETH and USDC balance on Arbitrum?
Wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345
```

### Full Portfolio Scan
```
Scan my wallet across all supported chains and give me a complete breakdown:
- Token holdings per chain
- USD values
- Total portfolio value

Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345
```

### Multi-Wallet Summary
```
Compare these three wallets:
- Main: 0xAAA...
- Trading: 0xBBB...
- Cold: 0xCCC...

Show combined total and breakdown by wallet and chain.
```

### Token Holdings Search
```
Find all my USDC holdings across every chain.
Include staked, LP'd, and lending positions.
Address: 0x742d35...
```

### Daily Portfolio Update
```
Daily portfolio update for 0x742d35...:
1. Total value vs yesterday
2. Top 3 gainers and losers
3. Any DeFi positions needing attention
4. Pending rewards to claim
```

---

## Trading & Swaps

### Simple Swap Quote
```
How much USDC would I get for swapping 1 ETH on Arbitrum?
```

### Compare DEX Prices
```
Compare swap rates for 1000 USDC → ETH across:
- Uniswap
- SushiSwap
- 1inch
- ParaSwap

On Arbitrum. Show best rate and price impact.
```

### Execute Swap
```
Swap 0.5 ETH to USDC on Base.
Use maximum 0.5% slippage.
My wallet: 0x742d35...
```

### Optimal Route Finding
```
Find the best route to swap 5000 USDC to WBTC on Ethereum.
Consider gas costs and show net received.
```

### Large Trade Analysis
```
I want to swap 100 ETH to USDC. Analyze:
- Price impact on Arbitrum vs Ethereum
- Best execution strategy (single swap vs split)
- Estimated total cost including gas
```

---

## DeFi Operations

### Lending Rates Comparison
```
Compare USDC lending rates across:
- Aave (Ethereum, Arbitrum, Base)
- Compound (Ethereum)

Show supply APY, borrow APY, and TVL.
```

### Aave Position Check
```
Check my Aave position on Ethereum:
- Supplied assets
- Borrowed assets
- Health factor
- Liquidation price for ETH

Address: 0x742d35...
```

### Best Yield Finder
```
Find the best yields for USDC with:
- Minimum $10M TVL
- Audited protocols only
- No lock-up required

Rank by APY across all supported chains.
```

### Staking Opportunities
```
What are the current staking rewards for:
- ETH (Lido, Rocket Pool)
- MATIC (native staking)
- ATOM (Cosmos staking)

Show APY and minimum amounts.
```

### LP Position Analysis
```
Analyze my Uniswap V3 ETH/USDC LP position:
- Current value
- Fees earned
- Impermanent loss
- In-range status

Position NFT ID: 12345
Chain: Arbitrum
```

---

## Cross-Chain Bridges

### Bridge Quote
```
What's the best route to bridge 1000 USDC from Ethereum to Arbitrum?
Compare fees and time across different bridges.
```

### Multi-Hop Bridge
```
I need to move 500 USDC from Polygon to Base.
What's the cheapest route, even if it requires multiple hops?
```

### Bridge Execution
```
Bridge 100 USDC from Arbitrum to Base using the cheapest option.
My address: 0x742d35...
```

### Cross-Chain Swap
```
I have ETH on Ethereum and want USDC on Arbitrum.
Find the best combined swap + bridge route for 2 ETH.
```

---

## Market Analysis

### Price Check
```
What's the current price of ETH, BTC, and SOL in USD?
Include 24h change.
```

### Historical Prices
```
Show me ETH price history for the last 30 days.
Include high, low, and average.
```

### Token Research
```
Give me a complete overview of ARB token:
- Current price and market cap
- Circulating vs total supply
- Top exchanges
- 7d and 30d price change
```

### Market Overview
```
Crypto market overview:
- BTC dominance
- Total market cap
- Fear & Greed Index
- Top 5 gainers today
- Top 5 losers today
```

### Volume Analysis
```
What's the 24h trading volume for ETH across major exchanges?
Which exchange has the most volume?
```

---

## Security & Auditing

### Token Security Scan
```
Scan this token for security risks:
Contract: 0x1234567890abcdef1234567890abcdef12345678
Chain: Ethereum

Check for honeypot, rugpull risks, and owner privileges.
```

### Honeypot Check
```
Is this token a honeypot?
Contract: 0xdead...beef
Chain: BSC

Simulate buy and sell transactions.
```

### Contract Analysis
```
Analyze this smart contract:
- Is source code verified?
- What are the owner privileges?
- Any dangerous functions?
- Proxy or upgradeable?

Contract: 0x1234...
Chain: Arbitrum
```

### Wallet Risk Assessment
```
Analyze this wallet for risk indicators:
Address: 0xsuspicious...

Check for:
- Interaction with known scam contracts
- Mixer usage
- Unusual patterns
```

### Pre-Investment Checklist
```
Full security analysis before I invest in:
Token: 0x1234...
Chain: Ethereum

Include contract, liquidity, holders, and deployer analysis.
Give me a BUY / CAUTION / AVOID rating.
```

---

## Technical Analysis

### Basic Indicators
```
What are the current RSI and MACD for ETH/USD?
Include signal interpretation.
```

### Full Technical Analysis
```
Complete technical analysis for BTC/USD:
- RSI (14)
- MACD (12, 26, 9)
- Bollinger Bands (20, 2)
- Moving Averages (50, 200)
- Support/resistance levels
```

### Multi-Timeframe Analysis
```
Analyze ETH/USD across multiple timeframes:
- 1H: Short-term trend
- 4H: Medium-term trend  
- 1D: Long-term trend

What's the overall bias?
```

### Pattern Recognition
```
Are there any notable chart patterns forming on ETH/USD daily chart?
Check for: head & shoulders, double top/bottom, triangles.
```

---

## Developer Tools

### Contract Interaction
```
Read the totalSupply() and decimals() from this ERC20:
Contract: 0x1234...
Chain: Ethereum
```

### ABI Decoding
```
Decode this transaction input data:
0x095ea7b3000000000000000000000000...

What function was called and with what parameters?
```

### Event Log Query
```
Get all Transfer events from USDC contract in the last 100 blocks on Ethereum.
Show sender, recipient, and amount.
```

### Gas Estimation
```
Estimate gas for:
- Simple ETH transfer
- ERC20 approval
- Uniswap swap

On Ethereum, Arbitrum, and Base. Show costs in USD.
```

### ENS Lookup
```
Resolve these ENS names:
- vitalik.eth
- uniswap.eth

And reverse lookup: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

---

## Advanced Workflows

### Rebalancing Assistant
```
I want to rebalance my portfolio to:
- 50% ETH
- 30% BTC (wrapped)
- 20% stablecoins

Current holdings are at 0x742d35... across Ethereum and Arbitrum.
Calculate what trades I need and estimate costs.
```

### Yield Farming Strategy
```
I have $10,000 in stablecoins. Create a yield farming strategy:
- Risk tolerance: Medium
- Chains: Ethereum, Arbitrum, Base
- Max lock-up: 7 days

Consider gas costs and show expected monthly return.
```

### Arbitrage Detection
```
Check for arbitrage opportunities on ETH between:
- Uniswap (Ethereum)
- SushiSwap (Arbitrum)
- QuickSwap (Polygon)

Account for bridge and gas costs.
Is any route profitable?
```

### DCA Execution Plan
```
Help me set up a DCA plan:
- Buy $500 of ETH weekly
- Best time to buy (lowest gas)
- Best chain to accumulate on
- Best exchange/DEX for small amounts

I'm starting with funds on Coinbase → need to get to self-custody.
```

### Tax Loss Harvesting
```
Analyze my wallet for tax loss harvesting opportunities:
Address: 0x742d35...

Find positions that are:
- Currently at a loss
- Can be sold and rebought
- Worth more than gas to execute

This is for US tax purposes.
```

### Emergency Exit
```
Emergency: I need to convert everything in this wallet to USDC ASAP.
Address: 0x742d35...

Calculate the fastest way to:
1. Swap all tokens to USDC
2. Bridge everything to Ethereum
3. Total time and cost estimate
```

---

## Tips for Better Prompts

### Be Specific
❌ "Check my balance"
✅ "Check my ETH and USDC balance on Arbitrum. Address: 0x742d35..."

### Include Context
❌ "Is this token safe?"
✅ "Is this token safe? Contract: 0x1234... on Ethereum. Check for honeypot and owner risks."

### Specify Chains
❌ "Swap ETH to USDC"
✅ "Swap 1 ETH to USDC on Arbitrum with max 0.5% slippage"

### Ask for Comparisons
❌ "What's the best yield?"
✅ "Compare USDC yields across Aave (ETH, ARB, BASE) and Compound. Show APY and TVL."

### Request Analysis
❌ "Get me the price"
✅ "Get ETH price with 24h change, 7d trend, and current market sentiment"

---

## Save Your Favorites

Create a file with your most-used prompts. Examples:

```markdown
# My Daily Prompts

## Morning Check
[Your portfolio check prompt]

## Before Trading
[Your market analysis prompt]

## New Token
[Your security scan prompt]
```

---

Built by [Nich](https://x.com/nichxbt) • [GitHub](https://github.com/nirholas/universal-crypto-mcp)

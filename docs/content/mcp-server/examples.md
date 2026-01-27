<!-- universal-crypto-mcp | n1ch0las | 78738 -->

# Real Examples

<!-- Maintained by nicholas | ID: 0.4.14.3 -->

Comprehensive examples with actual prompts and expected outputs for all major features.

---

## 📊 Market Data Examples

### Get Token Prices

**Prompt:**
```
What's the current price of Bitcoin and Ethereum?
```

**Tool Used:** `coingecko_get_prices`

**Example Output:**
```json
{
  "bitcoin": {
    "usd": 43250.00,
    "usd_24h_change": 2.45,
    "usd_market_cap": 847000000000
  },
  "ethereum": {
    "usd": 2650.00,
    "usd_24h_change": 3.12,
    "usd_market_cap": 318000000000
  }
}
```

---

### Search for a Token

**Prompt:**
```
Find the CoinGecko ID for Berachain
```

**Tool Used:** `coingecko_search`

**Example Output:**
```
Found 1 coin matching 'Berachain':

Berachain (BERA)
CoinGecko ID: berachain-bera
Market Cap Rank: 156
```

---

### Get Trending Coins

**Prompt:**
```
What are the top trending coins right now?
```

**Tool Used:** `coingecko_trending`

**Example Output:**
```
Top Trending Coins (24h):

1. PEPE (+45.2%) - Rank #52
2. BONK (+23.1%) - Rank #78  
3. WIF (+18.9%) - Rank #95
4. BOME (+15.3%) - Rank #128
5. SLERF (+12.8%) - Rank #245
```

---

## 🔄 Swap Examples

### Get a Swap Quote

**Prompt:**
```
Get a quote to swap 1 ETH for USDC on Arbitrum
```

**Tool Used:** `get_swap_quote`

**Parameters:**
```json
{
  "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "toToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "amount": "1000000000000000000",
  "network": "arbitrum"
}
```

**Example Output:**
```json
{
  "fromToken": "ETH",
  "toToken": "USDC",
  "fromAmount": "1.0",
  "toAmount": "3248.52",
  "priceImpact": "0.02%",
  "route": ["ETH", "WETH", "USDC"],
  "dex": "Uniswap V3",
  "estimatedGas": "185000"
}
```

---

### Execute a Swap

**Prompt:**
```
Swap 0.1 ETH for USDC on Base with 1% slippage
```

**Tool Used:** `execute_swap`

**Parameters:**
```json
{
  "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "toToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "100000000000000000",
  "slippage": 1,
  "network": "base"
}
```

**Example Output:**
```json
{
  "status": "success",
  "txHash": "0x8f4e7a...2a1b",
  "fromAmount": "0.1 ETH",
  "toAmount": "324.87 USDC",
  "gasUsed": "165420",
  "effectivePrice": "3248.70"
}
```

---

## 🔒 Security Examples

### Check Token Security

**Prompt:**
```
Is this token safe? 0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE on Ethereum
```

**Tool Used:** `analyze_token_security`

**Example Output:**
```
Token Security Analysis: SHIB (Shiba Inu)
Network: Ethereum

✅ SAFE INDICATORS:
• Contract verified on Etherscan
• Ownership renounced
• No mint function
• No blacklist function
• No pause function

⚠️ WARNINGS:
• Top 10 holders own 65% of supply
• Large whale concentration

📊 HOLDER DISTRIBUTION:
• Holders: 1,420,000+
• Top holder: 15.2%
• Top 10: 65.3%

🔐 RISK SCORE: LOW (2/10)
```

---

### Detect Honeypot

**Prompt:**
```
Check if this token is a honeypot: 0x123...abc on BSC
```

**Tool Used:** `detect_honeypot`

**Example Output:**
```
🍯 HONEYPOT ANALYSIS

Token: 0x123...abc
Network: BSC

❌ HONEYPOT DETECTED

Simulation Results:
• Buy: ✅ Success (12% tax)
• Sell: ❌ Failed (100% tax - cannot sell)

🚨 DO NOT BUY - This token cannot be sold!
```

---

### Check Rug Pull Risk

**Prompt:**
```
Analyze this token for rug pull risk: 0xabc...123
```

**Tool Used:** `detect_rug_pull_risk`

**Example Output:**
```
🔍 RUG PULL RISK ANALYSIS

Token: ExampleToken (EXT)
Network: Ethereum

RISK INDICATORS:

❌ Ownership NOT renounced
   Owner: 0x742d35...
   
❌ Hidden mint function detected
   Function: _secretMint()
   
❌ Liquidity NOT locked
   LP tokens held by deployer
   
⚠️ High holder concentration
   Top wallet: 45% of supply
   
❌ Blacklist function exists
   Can block wallets from selling

🚨 RISK SCORE: CRITICAL (9/10)
⛔ HIGH RISK - Do not invest!
```

---

## 🌐 DeFi Analytics Examples

### Get Protocol TVL

**Prompt:**
```
What's the total TVL of Aave?
```

**Tool Used:** `defillama_get_protocol`

**Example Output:**
```
AAVE Protocol Overview

Total Value Locked: $12.5B
24h Change: +2.3%
7d Change: +8.7%

TVL by Chain:
• Ethereum: $8.2B (65.6%)
• Polygon: $1.8B (14.4%)
• Arbitrum: $1.2B (9.6%)
• Optimism: $680M (5.4%)
• Avalanche: $420M (3.4%)
• Base: $200M (1.6%)

Category: Lending
Website: https://aave.com
```

---

### Get Best Yield Opportunities

**Prompt:**
```
What are the best stablecoin yield opportunities?
```

**Tool Used:** `defillama_get_yields`

**Example Output:**
```
Top Stablecoin Yields (APY)

1. Pendle USDC (Arbitrum) - 18.5% APY
   Pool: $45M TVL | Audited ✅

2. Aave USDC (Ethereum) - 8.2% APY
   Pool: $2.1B TVL | Audited ✅

3. Compound USDC (Ethereum) - 7.8% APY
   Pool: $890M TVL | Audited ✅

4. Yearn USDC Vault - 6.5% APY
   Pool: $120M TVL | Audited ✅

5. Curve 3pool - 4.2% APY
   Pool: $450M TVL | Audited ✅
```

---

## 📈 DEX Analytics Examples

### Get Trending Pools

**Prompt:**
```
Show me trending pools on Uniswap V3 Ethereum
```

**Tool Used:** `dex_get_trending_pools`

**Example Output:**
```
🔥 Trending Pools - Uniswap V3 (Ethereum)

1. PEPE/WETH
   Volume 24h: $45.2M
   Liquidity: $12.5M
   Price Change: +34.5%

2. SHIB/WETH  
   Volume 24h: $28.7M
   Liquidity: $8.9M
   Price Change: +12.3%

3. WETH/USDC
   Volume 24h: $125.4M
   Liquidity: $450M
   Price Change: +2.1%

4. LINK/WETH
   Volume 24h: $18.9M
   Liquidity: $35.2M
   Price Change: +8.7%
```

---

### Get Pool OHLCV Data

**Prompt:**
```
Get 7-day OHLCV for the ETH/USDC pool on Uniswap
```

**Tool Used:** `dex_get_pool_ohlcv`

**Example Output:**
```
ETH/USDC OHLCV (7 days)

| Date       | Open    | High    | Low     | Close   | Volume    |
|------------|---------|---------|---------|---------|-----------|
| 2026-01-15 | 3180.50 | 3245.00 | 3150.00 | 3220.00 | $125.4M   |
| 2026-01-16 | 3220.00 | 3280.00 | 3200.00 | 3265.00 | $98.7M    |
| 2026-01-17 | 3265.00 | 3310.00 | 3240.00 | 3290.00 | $112.3M   |
| 2026-01-18 | 3290.00 | 3350.00 | 3275.00 | 3340.00 | $145.6M   |
| 2026-01-19 | 3340.00 | 3380.00 | 3300.00 | 3355.00 | $134.2M   |
| 2026-01-20 | 3355.00 | 3420.00 | 3340.00 | 3400.00 | $167.8M   |
| 2026-01-21 | 3400.00 | 3450.00 | 3380.00 | 3425.00 | $189.4M   |
```

---

## 🌉 Bridge Examples

### Get Bridge Quote

**Prompt:**
```
Get a quote to bridge 100 USDC from Ethereum to Arbitrum
```

**Tool Used:** `get_bridge_quote`

**Example Output:**
```
Bridge Quote: USDC Ethereum → Arbitrum

Amount: 100 USDC
You Receive: 99.85 USDC

Fee Breakdown:
• Bridge Fee: 0.10 USDC
• Gas (Source): ~$2.50
• Gas (Destination): ~$0.05

Estimated Time: 10-15 minutes

Available Routes:
1. Stargate (Fastest) - 99.85 USDC | ~10 min
2. Hop Protocol - 99.80 USDC | ~15 min  
3. Across - 99.82 USDC | ~12 min
```

---

## ⛽ Gas Examples

### Get Current Gas Prices

**Prompt:**
```
What's the current gas price on Ethereum?
```

**Tool Used:** `get_gas_price`

**Example Output:**
```
⛽ Ethereum Gas Prices

Current Base Fee: 25 gwei
Priority Fee (Tip): 1-3 gwei

Speed Estimates:
🐢 Slow: 26 gwei (~5 min) - $2.80
🚗 Standard: 28 gwei (~2 min) - $3.00  
🚀 Fast: 32 gwei (~30 sec) - $3.45

EIP-1559 Suggestion:
• Max Fee: 35 gwei
• Priority Fee: 2 gwei
```

---

### Get Gas Prices Across All Chains

**Prompt:**
```
Compare gas prices across all EVM chains
```

**Tool Used:** `get_gas_prices_all_chains`

**Example Output:**
```
⛽ Gas Prices Across Chains

| Chain      | Gas Price | Avg Tx Cost |
|------------|-----------|-------------|
| Ethereum   | 25 gwei   | $3.00       |
| Arbitrum   | 0.1 gwei  | $0.15       |
| Base       | 0.05 gwei | $0.08       |
| Optimism   | 0.08 gwei | $0.12       |
| Polygon    | 80 gwei   | $0.02       |
| BSC        | 3 gwei    | $0.10       |
| Avalanche  | 25 nAVAX  | $0.08       |

💡 Cheapest: Base ($0.08/tx)
```

---

## 💰 Staking Examples

### Get Lido Staking APY

**Prompt:**
```
What's the current ETH staking APY on Lido?
```

**Tool Used:** `get_lido_staking_info`

**Example Output:**
```
🥩 Lido ETH Staking

Current APY: 3.8%
stETH Price: 0.9985 ETH
Total Staked: 9.2M ETH ($29.8B)

Rewards Distribution: Daily
Min Stake: No minimum
Withdrawal: Instant (via DEX) or 1-5 days (protocol)

Note: stETH rebases daily - your balance increases automatically.
```

---

## 🏦 Lending Examples

### Get Aave Rates

**Prompt:**
```
Show me Aave lending rates for USDC on Arbitrum
```

**Tool Used:** `get_lending_rates`

**Example Output:**
```
🏦 Aave V3 - USDC (Arbitrum)

SUPPLY:
• APY: 5.2%
• Total Supplied: $180M
• Utilization: 78%

BORROW:
• Variable APY: 6.8%
• Stable APY: 8.2%
• Available: $40M

COLLATERAL:
• LTV: 80%
• Liquidation Threshold: 85%
• Liquidation Penalty: 5%

✅ Can be used as collateral
✅ Borrowing enabled
```

---

## 💬 Social Sentiment Examples

### Get Token Sentiment

**Prompt:**
```
What's the social sentiment for Bitcoin?
```

**Tool Used:** `lunarcrush_get_coin`

**Example Output:**
```
📊 Bitcoin Social Metrics

Galaxy Score: 72/100 (Bullish)
AltRank: #1

Social Activity (24h):
• Tweets: 125,400
• Engagement: 2.4M
• Sentiment: 68% Positive

Influencer Activity:
• Bullish Posts: 234
• Bearish Posts: 89
• Neutral: 156

Trending Topics:
1. #Bitcoin ETF
2. #BTC100K
3. #Halving
```

---

## 🆔 ENS Examples

### Resolve ENS Name

**Prompt:**
```
Resolve vitalik.eth to an address
```

**Tool Used:** `ens_resolve`

**Example Output:**
```
🆔 ENS Resolution

Name: vitalik.eth
Address: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

Records:
• ETH: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
• Twitter: @VitalikButerin
• GitHub: vbuterin
• Avatar: ipfs://Qm...
```

---

## 📁 Portfolio Examples

### Get Wallet Balances

**Prompt:**
```
Show my token balances on Ethereum: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

**Tool Used:** `get_wallet_portfolio`

**Example Output:**
```
💼 Portfolio: 0xd8dA...6045 (Ethereum)

Native Balance: 1,245.32 ETH ($4.03M)

Top Tokens:
| Token  | Balance      | Value     |
|--------|--------------|-----------|
| USDC   | 500,000.00   | $500,000  |
| USDT   | 250,000.00   | $250,000  |
| LINK   | 15,000.00    | $225,000  |
| UNI    | 10,000.00    | $85,000   |
| AAVE   | 500.00       | $45,000   |

Total Value: ~$5.1M
```

---

## 🚀 Deployment Examples

### Deploy ERC-20 Token

**Prompt:**
```
Deploy a new token called "MyToken" with symbol "MTK" and 1 million supply on Base
```

**Tool Used:** `deploy_erc20`

**Example Output:**
```
🚀 Token Deployed Successfully!

Contract: 0x742d35Cc6634C0532925a3b844Bc9e7595f...
Network: Base
Explorer: https://basescan.org/address/0x742d35...

Token Details:
• Name: MyToken
• Symbol: MTK
• Decimals: 18
• Total Supply: 1,000,000 MTK
• Owner: 0xYourAddress...

Gas Used: 1,245,000
Cost: $0.12

Next Steps:
1. Verify contract on BaseScan
2. Add liquidity on Aerodrome/Uniswap
3. Set up token metadata
```

---

## 📰 News Examples

### Get Latest Crypto News

**Prompt:**
```
Get the latest crypto news
```

**Tool Used:** `get_crypto_news`

**Example Output:**
```
📰 Latest Crypto News

1. "Bitcoin ETF Sees Record $500M Inflows"
   Source: CoinDesk | 2 hours ago
   
2. "Ethereum L2s Surpass $15B in TVL"
   Source: The Block | 4 hours ago
   
3. "Solana Memecoins Drive Network to ATH Activity"
   Source: Decrypt | 5 hours ago
   
4. "SEC Delays Decision on ETH ETF Again"
   Source: Bloomberg | 6 hours ago
   
5. "DeFi Protocol Suffers $10M Exploit"
   Source: CryptoPanic | 8 hours ago
```

---

## 🛡️ MEV Protection Examples

### Submit Private Transaction

**Prompt:**
```
Submit this swap privately via Flashbots to avoid MEV
```

**Tool Used:** `flashbots_send_private_tx`

**Example Output:**
```
🛡️ Private Transaction Submitted

Bundle Hash: 0x8f4e7a...
Status: Pending

Protection:
✅ Frontrun protection: Active
✅ Sandwich protection: Active
✅ Private mempool: Yes

Target Block: 19,234,567
Estimated Inclusion: 1-3 blocks

Note: Transaction will NOT appear in public mempool.
```

---

## Need More Examples?

Try asking:

- "Calculate technical indicators for BTC"
- "Get the Fear & Greed Index"
- "Analyze arbitrage opportunities between DEXs"
- "Decode this transaction: 0x..."
- "Get all governance proposals for Uniswap"
- "What NFTs does this wallet own?"

The MCP server has 500+ tools covering virtually every crypto operation!


<!-- EOF: n1ch0las | ucm:78738 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->
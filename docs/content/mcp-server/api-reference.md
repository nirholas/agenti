<!-- universal-crypto-mcp | n1ch0las | 78738 -->

# API Reference

<!-- Maintained by nirholas | ID: 1493814938 -->

Complete API reference for all Universal Crypto MCP tools.

---

## Tool Response Format

All tools return responses in MCP format:

```typescript
{
  content: [
    {
      type: "text",
      text: string // JSON stringified result
    }
  ]
}
```

## Error Handling

Errors are returned in this format:

```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "details": {}
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_ADDRESS` | Invalid blockchain address format |
| `INVALID_CHAIN` | Unsupported blockchain network |
| `INSUFFICIENT_FUNDS` | Not enough balance for operation |
| `RATE_LIMITED` | API rate limit exceeded |
| `NETWORK_ERROR` | RPC/API connection failed |
| `CONTRACT_ERROR` | Smart contract execution failed |
| `INVALID_PARAMS` | Invalid input parameters |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | Missing or invalid API key |

---

## EVM Module APIs

### Blocks

#### get_latest_block

Get the latest block on a chain.

**Parameters:**
```typescript
{
  chain: string  // "ethereum", "polygon", "bsc", etc.
}
```

**Response:**
```typescript
{
  number: bigint
  hash: string
  timestamp: number
  transactions: string[]
  gasUsed: bigint
  gasLimit: bigint
  baseFeePerGas: bigint
  miner: string
}
```

---

#### get_block_by_number

Get block by block number.

**Parameters:**
```typescript
{
  blockNumber: number | "latest" | "pending" | "earliest"
  chain: string
  includeTransactions?: boolean
}
```

---

### Tokens

#### get_erc20_token_info

Get ERC20 token information.

**Parameters:**
```typescript
{
  address: string  // Token contract address
  chain: string
}
```

**Response:**
```typescript
{
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
}
```

---

#### get_erc20_balance

Get ERC20 token balance.

**Parameters:**
```typescript
{
  tokenAddress: string
  walletAddress: string
  chain: string
}
```

**Response:**
```typescript
{
  balance: string        // Raw balance
  formatted: string      // Human readable
  decimals: number
  symbol: string
}
```

---

### Wallet

#### transfer_native_token

Transfer native tokens (ETH, BNB, MATIC, etc.).

**Parameters:**
```typescript
{
  to: string       // Recipient address
  amount: string   // Amount in ether units
  chain: string
}
```

**Response:**
```typescript
{
  hash: string
  from: string
  to: string
  value: string
  gasUsed: bigint
  status: "success" | "failed"
}
```

---

#### transfer_erc20

Transfer ERC20 tokens.

**Parameters:**
```typescript
{
  tokenAddress: string
  to: string
  amount: string   // In token units (not wei)
  chain: string
}
```

---

### Contracts

#### read_contract

Read data from a smart contract.

**Parameters:**
```typescript
{
  address: string
  abi: AbiItem[]
  functionName: string
  args?: any[]
  chain: string
}
```

**Response:**
```typescript
{
  result: any  // Function return value
}
```

---

#### write_contract

Execute a write operation on a contract.

**Parameters:**
```typescript
{
  address: string
  abi: AbiItem[]
  functionName: string
  args?: any[]
  value?: string  // ETH to send (optional)
  chain: string
}
```

---

### Swap

#### get_swap_quote

Get a swap quote from DEX aggregators.

**Parameters:**
```typescript
{
  fromToken: string      // Token address or symbol
  toToken: string
  amount: string         // In token units
  chain: string
  slippage?: number      // Default: 0.5 (0.5%)
}
```

**Response:**
```typescript
{
  fromToken: TokenInfo
  toToken: TokenInfo
  fromAmount: string
  toAmount: string
  exchangeRate: number
  priceImpact: number
  route: string[]
  protocols: string[]
  estimatedGas: string
  tx: {
    to: string
    data: string
    value: string
  }
}
```

---

### ENS Domains

#### resolve_ens_name

Resolve ENS name to address.

**Parameters:**
```typescript
{
  name: string  // e.g., "vitalik.eth"
}
```

**Response:**
```typescript
{
  name: string
  address: string
  resolver: string
}
```

---

## Data Module APIs

### CoinGecko

#### coingecko_get_prices

Get current prices.

**Parameters:**
```typescript
{
  ids: string[]           // Coin IDs: ["bitcoin", "ethereum"]
  vs_currencies: string[] // Currencies: ["usd", "eur", "btc"]
}
```

**Response:**
```typescript
{
  bitcoin: {
    usd: 43250.00,
    usd_24h_change: 2.5
  },
  ethereum: {
    usd: 2280.00,
    usd_24h_change: 1.8
  }
}
```

---

### Technical Indicators

#### indicator_rsi

Calculate Relative Strength Index.

**Parameters:**
```typescript
{
  symbol: string      // "BTC/USDT"
  exchange?: string   // "binance" (default)
  timeframe?: string  // "1h" (default)
  period?: number     // 14 (default)
  limit?: number      // Number of candles
}
```

**Response:**
```typescript
{
  symbol: string
  timeframe: string
  indicator: "RSI"
  period: number
  values: number[]
  latest: number
  interpretation: "oversold" | "neutral" | "overbought"
  timestamp: string
}
```

---

#### indicator_macd

Calculate MACD.

**Parameters:**
```typescript
{
  symbol: string
  exchange?: string
  timeframe?: string
  fastPeriod?: number   // 12 (default)
  slowPeriod?: number   // 26 (default)
  signalPeriod?: number // 9 (default)
}
```

**Response:**
```typescript
{
  symbol: string
  timeframe: string
  indicator: "MACD"
  macd: number[]
  signal: number[]
  histogram: number[]
  latest: {
    macd: number
    signal: number
    histogram: number
  }
  interpretation: "bullish" | "bearish" | "neutral"
}
```

---

#### indicator_bollinger_bands

Calculate Bollinger Bands.

**Parameters:**
```typescript
{
  symbol: string
  exchange?: string
  timeframe?: string
  period?: number    // 20 (default)
  stdDev?: number    // 2 (default)
}
```

**Response:**
```typescript
{
  symbol: string
  timeframe: string
  indicator: "Bollinger Bands"
  upper: number[]
  middle: number[]
  lower: number[]
  bandwidth: number[]
  latest: {
    upper: number
    middle: number
    lower: number
    bandwidth: number
    percentB: number
  }
}
```

---

### Screeners

#### screener_top_gainers

Find top gaining cryptocurrencies.

**Parameters:**
```typescript
{
  exchange?: string  // "binance" (default)
  limit?: number     // 10 (default)
  minVolume?: number // Minimum 24h volume in USD
}
```

**Response:**
```typescript
{
  screener: "top_gainers"
  timestamp: string
  results: [
    {
      symbol: string
      price: number
      change24h: number
      volume24h: number
      marketCap: number
    }
  ]
}
```

---

#### screener_rsi_oversold

Find RSI oversold coins.

**Parameters:**
```typescript
{
  exchange?: string
  threshold?: number  // 30 (default)
  timeframe?: string  // "4h" (default)
  limit?: number
}
```

---

### Research

#### research_create_plan

Create a research plan for a token.

**Parameters:**
```typescript
{
  token: string      // Token name: "Solana"
  symbol: string     // Symbol: "SOL"
}
```

**Response:**
```typescript
{
  sessionId: string
  token: string
  symbol: string
  createdAt: string
  sections: [
    {
      id: string
      title: string
      status: "pending" | "in_progress" | "complete"
      queries: string[]
    }
  ]
}
```

---

## Multi-Chain APIs

### Solana

#### solana_get_balance

Get SOL balance.

**Parameters:**
```typescript
{
  address: string  // Solana address (base58)
}
```

**Response:**
```typescript
{
  address: string
  balance: number      // In SOL
  lamports: number     // In lamports
}
```

---

#### solana_get_swap_quote

Get Jupiter DEX swap quote.

**Parameters:**
```typescript
{
  inputMint: string   // Input token mint address
  outputMint: string  // Output token mint address
  amount: string      // Amount in smallest unit (lamports/token units)
  slippage?: number   // Default: 50 (0.5%)
}
```

---

### TON

#### ton_get_balance

Get TON balance.

**Parameters:**
```typescript
{
  address: string  // TON address
}
```

**Response:**
```typescript
{
  address: string
  balance: string   // In TON
  state: "active" | "uninitialized" | "frozen"
}
```

---

### XRP

#### xrp_get_balance

Get XRP balance.

**Parameters:**
```typescript
{
  address: string  // XRP address (starts with 'r')
}
```

**Response:**
```typescript
{
  address: string
  balance: string
  reserve: string    // Required reserve
  available: string  // Balance - reserve
}
```

---

### THORChain

#### thorchain_get_swap_quote

Get cross-chain swap quote.

**Parameters:**
```typescript
{
  fromAsset: string   // "BTC.BTC", "ETH.ETH", etc.
  toAsset: string
  amount: string      // In base units (satoshis for BTC)
  destination?: string
}
```

**Response:**
```typescript
{
  fromAsset: string
  toAsset: string
  inputAmount: string
  expectedOutput: string
  fees: {
    affiliate: string
    outbound: string
    liquidity: string
  }
  slippage: number
  route: string[]
  expiry: number
  memo: string
}
```

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Read operations | 100/min |
| Write operations | 20/min |
| Price queries | 30/min |
| Indicator calculations | 50/min |

## Pagination

For endpoints that return lists:

```typescript
{
  limit?: number   // Items per page (default: 20, max: 100)
  offset?: number  // Skip n items (default: 0)
  cursor?: string  // Cursor-based pagination
}
```

Response includes:

```typescript
{
  data: any[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
    nextCursor?: string
  }
}
```


<!-- EOF: n1ch0las | ucm:78738 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->
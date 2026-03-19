# Tool Schema Reference

Every tool in Agenti follows a standard interface for consistent interaction with AI agents via the Model Context Protocol.

## Tool Interface

```typescript
interface Tool {
  name: string;           // Unique tool identifier (snake_case)
  description: string;    // Human-readable description for AI agents
  inputSchema: ZodSchema; // Zod validation schema for inputs
  execute(params: unknown): Promise<ToolResponse>;
}

interface ToolResponse {
  success: boolean;
  data?: any;             // Present on success
  error?: string;         // Present on failure
  code?: string;          // Error code for programmatic handling
  details?: any;          // Additional error context
}
```

## Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `category_action` | `market_data_price` | Standard tools |
| `chain_action` | `ethereum_balance` | Chain-specific tools |
| `protocol_action` | `aave_supply` | Protocol tools |
| `x402_action` | `x402_pay_request` | Payment tools |
| `indicator_name` | `indicator_rsi` | Technical indicators |

## Input Schema Patterns

### Zod Types Used

```typescript
// String parameters
z.string().describe('Description')

// Numeric parameters
z.number().min(0).max(100).describe('Percentage value')

// Enumerations
z.enum(['ethereum', 'polygon', 'base']).describe('Target chain')

// Optional with defaults
z.string().default('usd').describe('Currency code')

// Optional parameters
z.number().optional().describe('Optional limit')

// Validated formats
z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe('EVM address')

// Arrays
z.array(z.string()).describe('List of token IDs')

// Nested objects
z.object({
  token: z.string(),
  amount: z.string(),
}).describe('Token and amount pair')
```

### Common Parameter Patterns

```typescript
// Chain selection (used across most tools)
chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bnb'])
  .default('ethereum')
  .describe('Target blockchain network')

// Wallet address
address: z.string()
  .describe('Wallet address (0x... for EVM, base58 for Solana)')

// Token identifier
token: z.string()
  .describe('Token symbol (e.g., "ETH") or contract address')

// Pagination
limit: z.number().min(1).max(100).default(20)
  .describe('Maximum number of results')

// Timeframes
timeframe: z.enum(['1h', '4h', '24h', '7d', '30d'])
  .default('24h')
  .describe('Time period for data')
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "result": "value",
    "metadata": {
      "chain": "ethereum",
      "timestamp": "2024-01-15T12:00:00Z"
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "address",
    "reason": "Invalid checksum"
  }
}
```

## Tool Discovery

AI agents discover tools through the MCP `tools/list` method:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

Response includes all registered tools with their names, descriptions, and JSON schemas (converted from Zod).

## Tool Execution

Tools are called via the MCP `tools/call` method:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "market_data_price",
    "arguments": {
      "coinId": "bitcoin",
      "currency": "usd"
    }
  },
  "id": 2
}
```

## Tool Categories Summary

| Category | Count | Prefix |
|----------|-------|--------|
| Market Data | 15+ | `market_data_` |
| DeFi | 20+ | `defi_` |
| DEX Analytics | 15+ | `dex_` |
| Portfolio | 15+ | `portfolio_`, `wallet_`, `whale_` |
| Indicators | 50+ | `indicator_` |
| Sentiment | 10+ | `sentiment_` |
| Governance | 10+ | `governance_` |
| Social | 15+ | `social_` |
| Alerts | 10+ | `alert_` |
| Predictions | 10+ | `predictions_` |
| x402 Payments | 14 | `x402_` |
| Chain-specific | 100+ | `<chain>_` |
| **Total** | **380+** | |

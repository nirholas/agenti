# x402 Payment Protocol Reference

The x402 protocol enables AI agents to make autonomous payments using HTTP 402 (Payment Required) responses. This is a core differentiator of Agenti.

## Protocol Overview

```
1. Agent sends HTTP request to paid API
2. Server responds with 402 + payment requirements
3. Agent signs payment authorization (EIP-3009)
4. Agent retries with payment proof header
5. Server verifies payment, returns content
6. Facilitator settles payment on-chain
```

## Payment Flow

```
Agent                    API Server               Facilitator
  |                         |                         |
  |-- GET /resource ------->|                         |
  |<-- 402 + X-Payment ----|                         |
  |                         |                         |
  |  [sign payment]         |                         |
  |                         |                         |
  |-- GET /resource ------->|                         |
  |   X-Payment: <signed>   |                         |
  |                         |-- verify payment ------>|
  |                         |<-- valid ---------------|
  |<-- 200 + content ------|                         |
  |                         |                         |
  |                         |-- settle on-chain ----->|
```

## x402 Tools

| Tool | Description |
|------|-------------|
| `x402_pay_request` | Make HTTP request with automatic 402 payment handling |
| `x402_balance` | Check USDC/USDs + native token balance |
| `x402_send` | Direct payment to an address |
| `x402_batch_send` | Send multiple payments in one transaction |
| `x402_gasless_send` | EIP-3009 gasless USDC transfer |
| `x402_estimate` | Estimate cost before making payment |
| `x402_address` | Get the agent's wallet address |
| `x402_networks` | List supported payment networks |
| `x402_yield` | Check USDs auto-yield earnings |
| `x402_apy` | Get current USDs APY rate |
| `x402_yield_estimate` | Project future yield earnings |
| `x402_approve` | Approve token spending |
| `x402_tx_status` | Check transaction status |
| `x402_config` | View current x402 configuration |

## Supported Networks

### EVM (via @x402/evm)

| Network | Chain ID | USDC Address |
|---------|----------|-------------|
| Base | 8453 | Native USDC |
| Base Sepolia | 84532 | Test USDC |
| Ethereum | 1 | Native USDC |
| Arbitrum | 42161 | Native USDC |
| Optimism | 10 | Native USDC |
| Polygon | 137 | Native USDC |

### Solana (via @x402/svm)

| Network | USDC |
|---------|------|
| Solana Mainnet | SPL USDC |
| Solana Devnet | Test USDC |

## Payment Header Format

### 402 Response Header (from server)

```
X-Payment: {"scheme":"exact","network":"base","maxAmountRequired":"100000","resource":"https://api.example.com/data","facilitator":"0x...","extra":{"name":"API Access","description":"Per-request pricing"}}
```

### Payment Proof Header (from agent)

```
X-Payment: {"scheme":"exact","network":"base","payload":{"signature":"0x...","authorization":{"from":"0x...","to":"0x...","value":"100000","validAfter":"0","validBefore":"1705312800","nonce":"0x..."}}}
```

## Input Schemas

### x402_pay_request

```typescript
z.object({
  url: z.string().url().describe('URL to request (may return 402)'),
  method: z.enum(['GET', 'POST']).default('GET'),
  body: z.any().optional(),
  maxPayment: z.number().optional().describe('Maximum payment in USD'),
  chain: z.string().default('base'),
})
```

### x402_send

```typescript
z.object({
  to: z.string().describe('Recipient address'),
  amount: z.string().describe('Amount in USDC'),
  chain: z.string().default('base'),
  token: z.enum(['USDC', 'USDs']).default('USDC'),
})
```

## Configuration

```env
X402_ENABLED=true           # Enable x402 tools
X402_DEFAULT_CHAIN=base     # Default payment chain
X402_MAX_PAYMENT=10         # Max auto-payment in USD
X402_AUTO_PAY=false         # Auto-pay without confirmation
PRIVATE_KEY=0x...           # Wallet for signing payments
```

## SDK Packages

| Package | Language | Purpose |
|---------|----------|---------|
| `@x402/core` | TypeScript | Core protocol logic |
| `@x402/evm` | TypeScript | EVM payment execution |
| `@x402/svm` | TypeScript | Solana payment execution |
| `@x402/http` | TypeScript | HTTP client middleware |
| `x402-python` | Python | Python SDK |
| `x402-go` | Go | Go SDK |
| `x402-java` | Java | Java SDK |

## USDs Integration

Agenti integrates with Sperax USDs stablecoin which provides:
- Auto-yield on holdings (no staking/locking required)
- Compatible with x402 payments
- Yield tracking via `x402_yield` and `x402_apy` tools

# Trading Recommendation Agent - AI Implementation Guide

This template creates a shopper agent that buys data and generates trading signals.

## Architecture

**Role**: Shopper agent (makes payments)

**Capabilities**:
- Buys data from other agents via A2A
- Uses payment-enabled fetch for automatic payments
- Generates trading signals from data

## Key Concepts

### 1. Payment-Enabled A2A Calls

The agent uses `createRuntimePaymentContext()` to get a payment-enabled `fetch`:

```typescript
const paymentContext = await createRuntimePaymentContext({
  runtime,
  network: 'base-sepolia',
});
const fetchWithPayment = paymentContext.fetchWithPayment;
```

This `fetch` automatically includes x402 payment headers when calling other agents.

### 2. Fetching Agent Cards

Before calling an agent, fetch its Agent Card to discover capabilities and pricing:

```typescript
const dataCard = await runtime.a2a?.fetchCard(
  DATA_AGENT_URL,
  fetchWithPayment
);
const price = dataCard?.entrypoints?.getMarketData?.pricing?.invoke;
```

### 3. Calling Other Agents

Use `fetchAndInvoke` from `@lucid-agents/a2a`:

```typescript
const result = await fetchAndInvoke(
  DATA_AGENT_URL,
  'getMarketData',
  { symbol: 'BTC/USD', timeframe: '1h' },
  fetchWithPayment  // Payment-enabled fetch
);
```

## Template Structure

### Wallet Configuration

The agent needs a wallet to pay for data:

```typescript
config: {
  wallets: {
    agent: {
      type: 'private-key',
      privateKey: process.env.AGENT_WALLET_PRIVATE_KEY,
    },
  },
}
```

### Signal Generation

The agent implements three trading strategies:

- **Momentum**: Detects price trends
- **Mean Reversion**: Expects price to revert to mean
- **Breakout**: Detects price breaking support/resistance

## Customization

### Adding More Strategies

Extend the strategy switch:

```typescript
case 'custom-strategy':
  // Your analysis logic
  break;
```

### Using Different Data Sources

Call different data agents:

```typescript
const result = await fetchAndInvoke(
  OTHER_DATA_AGENT_URL,
  'getCustomData',
  { /* params */ },
  fetchWithPayment
);
```

### Adding More Entrypoints

Add new entrypoints that use different data or strategies:

```typescript
addEntrypoint({
  key: 'portfolioAnalysis',
  handler: async ctx => {
    // Buy data from multiple agents
    // Analyze portfolio
    // Return recommendations
  },
});
```

## Next Steps

- Add more sophisticated signal strategies
- Integrate with real trading APIs
- Add risk management
- Implement backtesting
- Add streaming for real-time signals


# Alerts Module

The alerts module provides configurable notifications for price movements, whale transactions, governance events, and DeFi position health.

## Tools

### Price Alerts
- `alert_price_above` - Alert when token price exceeds a threshold
- `alert_price_below` - Alert when token price drops below a threshold
- `alert_price_change` - Alert on percentage price change (up or down)

### Whale Alerts
- `alert_whale_transfer` - Alert on large token transfers
- `alert_whale_exchange_flow` - Alert on large exchange inflows/outflows

### DeFi Alerts
- `alert_health_factor` - Alert when Aave/Compound health factor drops
- `alert_liquidation_risk` - Alert when position approaches liquidation
- `alert_yield_change` - Alert on significant APY changes

### Governance Alerts
- `alert_new_proposal` - Alert on new governance proposals
- `alert_vote_ending` - Alert when a vote is about to end

### Portfolio Alerts
- `alert_portfolio_value` - Alert on portfolio value changes
- `alert_token_unlock` - Alert on upcoming token unlock events

## Input Schemas

### alert_price_above

```typescript
z.object({
  token: z.string().describe('Token symbol or CoinGecko ID'),
  price: z.number().describe('Price threshold in USD'),
  message: z.string().optional().describe('Custom alert message'),
})
```

### alert_health_factor

```typescript
z.object({
  protocol: z.enum(['aave', 'compound']),
  chain: z.string(),
  address: z.string().describe('Position owner address'),
  threshold: z.number().default(1.5).describe('Health factor alert threshold'),
})
```

## Alert Delivery

Alerts are delivered through the MCP notification system. Integrations include:
- MCP notification events (consumed by AI agent)
- Webhook callbacks (configurable URL)
- Console logging (development)

## Configuration

```json
{
  "alerts": {
    "enabled": true,
    "checkInterval": 60,
    "maxAlerts": 100,
    "webhookUrl": "https://your-webhook.com/alerts"
  }
}
```

## Common Workflows

### Risk Monitoring
1. Set `alert_health_factor` for all lending positions
2. Configure `alert_liquidation_risk` at critical thresholds
3. AI agent can auto-repay or add collateral when alerted

### Opportunity Detection
1. Set price alerts for tokens on watchlist
2. Monitor whale flows for smart money signals
3. Track yield changes to optimize DeFi positions

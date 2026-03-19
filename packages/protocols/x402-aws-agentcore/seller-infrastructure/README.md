# Seller Infrastructure (x402 Payment Gateway)

CloudFront distribution that acts as the **payment-gated content API** - the "seller" in the x402 protocol.

## What This Is

This is the **backend API** that the AI agent calls to fetch paid content.

```
┌─────────────┐         ┌─────────────────────────────┐
│  AI Agent   │ ──────▶ │  This CloudFront (Seller)   │
│  (Payer)    │   HTTP  │  - Returns 402 + price      │
│             │ ◀────── │  - Verifies payment         │
│             │         │  - Serves content           │
└─────────────┘         └─────────────────────────────┘
```

Endpoints like `/api/premium-article` return:
- **402 Payment Required** (no payment) with x402 headers
- **200 OK** (valid payment) with content

## Architecture

- **CloudFront** — Content delivery
- **Lambda@Edge** — Payment verification at edge locations
- **S3** — Content storage (optional)

## How It Works

1. Client requests content without payment → 402 response with payment requirements
2. Client requests content with payment signature → Content delivered, payment settled

The `payment-verifier` Lambda@Edge function intercepts requests, validates payment signatures, and either returns a 402 or serves the content.

## Content Types

| Path | Type | Description |
|------|------|-------------|
| `/api/premium-article` | Inline | Static article content |
| `/api/weather-data` | Dynamic | Generated weather data |
| `/api/market-analysis` | Dynamic | Generated market analysis |
| `/api/research-report` | S3 | Stored research report |
| `/api/dataset` | S3 | Premium dataset |
| `/api/tutorial` | S3 | Smart contract tutorial |

## Deploy

```bash
npm install
cdk bootstrap    # first time only
npm run build
npm run deploy
```

Note the CloudFront distribution URL from the output.

### Upload S3 Content

```bash
./scripts/upload-content.sh <bucket-name>
```

## Configuration

### Payment Settings

Set in `seller-infrastructure/.env` (CDK injects into the Lambda@Edge bundle at deploy time):

| Setting | `.env` Variable | Description |
|---------|----------------|-------------|
| `DEFAULT_PAY_TO` | `PAYMENT_RECIPIENT_ADDRESS` | Wallet address to receive payments |
| `DEFAULT_NETWORK` | — | Network ID (default: `eip155:84532` for Base Sepolia) |
| `DEFAULT_ASSET` | — | Asset contract address (default: USDC on Base Sepolia) |

### Adding Content

Update `content-config.ts`:

```typescript
contentManager.setContentItem({
  id: 'my-content',
  path: '/api/my-content',
  title: 'My Premium Content',
  description: 'Description',
  mimeType: 'application/json',
  pricing: createPaymentRequirements('1500'), // 0.0015 USDC
  source: {
    type: 'inline',
    data: { /* content */ },
  },
});
```

Source types: `inline`, `dynamic` (with generator), or `s3` (with bucket/key).

## Testing

```bash
# Without payment (returns 402)
curl -i https://YOUR_DISTRIBUTION.cloudfront.net/api/premium-article

# With payment
curl -i -H "X-PAYMENT: <payment-header>" \
  https://YOUR_DISTRIBUTION.cloudfront.net/api/premium-article
```

## Monitoring

Lambda@Edge logs appear in CloudWatch in the region where the function executes:
- Log group: `/aws/lambda/us-east-1.PaymentVerifier`

## Cleanup

```bash
cdk destroy
```

## Cost

Estimated < $5/month for development use.

# PocketBase x402 Payment Middleware Example

This example demonstrates how to integrate x402 payment gating into a PocketBase application.

## Prerequisites

- Go 1.25.1 or later
- PocketBase framework
- Access to a facilitator service (default: Coinbase facilitator)

## Installation

```bash
go get github.com/mark3labs/x402-go
```

## Running the Example

```bash
go run main.go serve
```

The application will start on `http://localhost:8090` by default.

## Testing Endpoints

### Without Payment (Returns 402)

```bash
curl http://localhost:8090/api/premium/data
```

**Response**:
```json
{
  "x402Version": 1,
  "error": "Payment required for this resource",
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "10000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "maxTimeoutSeconds": 300,
    "resource": "http://localhost:8090/api/premium/data",
    "description": "Payment required for /api/premium/data"
  }]
}
```

### With Valid Payment (Returns 200)

```bash
curl -H "X-PAYMENT: <base64-encoded-payment>" \
     http://localhost:8090/api/premium/data
```

**Response**:
```json
{
  "data": "Premium content here",
  "payer": "0x1234567890abcdef1234567890abcdef12345678"
}
```

## Configuration

### Basic Configuration

```go
config := &httpx402.Config{
    FacilitatorURL: "https://api.x402.coinbase.com",
    PaymentRequirements: []x402.PaymentRequirement{{
        Scheme:            "exact",
        Network:           "base-sepolia",
        MaxAmountRequired: "10000", // 0.01 USDC
        Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        PayTo:             "0xYourWallet",
        MaxTimeoutSeconds: 300,
    }},
}
```

### Verify-Only Mode (Testing)

```go
config := &httpx402.Config{
    FacilitatorURL: "https://api.x402.coinbase.com",
    VerifyOnly:     true, // Skip settlement
    PaymentRequirements: []x402.PaymentRequirement{{
        // ... requirements
    }},
}
```

### Fallback Facilitator

```go
config := &httpx402.Config{
    FacilitatorURL:         "https://api.x402.coinbase.com",
    FallbackFacilitatorURL: "https://backup.x402.example.com",
    PaymentRequirements: []x402.PaymentRequirement{{
        // ... requirements
    }},
}
```

### Multiple Payment Options

```go
config := &httpx402.Config{
    FacilitatorURL: "https://api.x402.coinbase.com",
    PaymentRequirements: []x402.PaymentRequirement{
        {
            Scheme:            "exact",
            Network:           "base-sepolia",
            MaxAmountRequired: "10000",
            Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            PayTo:             "0xYourWallet",
            MaxTimeoutSeconds: 300,
        },
        {
            Scheme:            "exact",
            Network:           "solana-devnet",
            MaxAmountRequired: "10000",
            Asset:             "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            PayTo:             "YourSolanaWallet",
            MaxTimeoutSeconds: 300,
        },
    },
}
```

## Usage Patterns

### Route-Level Protection

```go
se.Router.GET("/api/premium/data", handler).BindFunc(middleware)
```

### Group-Level Protection

```go
premiumGroup := se.Router.Group("/api/premium")
premiumGroup.BindFunc(middleware)

// All routes in this group require payment
premiumGroup.GET("/data", dataHandler)
premiumGroup.GET("/reports", reportsHandler)
premiumGroup.POST("/analytics", analyticsHandler)
```

### Accessing Payment Details

```go
se.Router.GET("/api/premium/data", func(e *core.RequestEvent) error {
    // Retrieve payment details from request store
    payment := e.Get("x402_payment").(*httpx402.VerifyResponse)
    
    // Access payment fields
    payer := payment.Payer           // Wallet address
    isValid := payment.IsValid       // Always true in handler
    reason := payment.InvalidReason  // Empty if valid

    return e.JSON(http.StatusOK, map[string]any{
        "data":  "Premium content",
        "payer": payer,
    })
}).BindFunc(middleware)
```

## Error Handling

The middleware automatically handles errors:

| Scenario | Status Code | Response |
|----------|-------------|----------|
| Missing X-PAYMENT | 402 | PaymentRequirementsResponse |
| Invalid base64/JSON | 400 | Error with x402Version |
| Payment verification fails | 402 | PaymentRequirementsResponse |
| Facilitator unreachable | 503 | Service unavailable error |
| Settlement fails | 503 | Settlement error |

## Production Checklist

- [ ] Switch from testnet to mainnet networks
- [ ] Update USDC contract addresses for mainnet
- [ ] Configure production wallet addresses
- [ ] Set up facilitator URL
- [ ] Configure fallback facilitator
- [ ] Test payment flow on testnet
- [ ] Monitor facilitator response times
- [ ] Set up logging for payment events

## Next Steps

- Review the [main specification](../../specs/005-pocketbase-middleware/spec.md)
- Check [quickstart guide](../../specs/005-pocketbase-middleware/quickstart.md)
- See [API reference](../../specs/005-pocketbase-middleware/contracts/pocketbase-middleware-api.yaml)

## Support

For issues or questions:
- GitHub Issues: https://github.com/mark3labs/x402-go/issues
- Documentation: https://github.com/mark3labs/x402-go

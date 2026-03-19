## Multi-Token Example

This example demonstrates advanced x402 features:

- Multiple payment options (USDC, DAI, USDT)
- Different pricing tiers for different endpoints
- Multiple blockchain networks
- Accessing payment details in gRPC handlers

## Features

### Endpoint Pricing

- `/v1/premium/*` - $1.00 - Premium content
- `/v1/basic/*` - $0.10 - Basic content
- `/v1/micro/*` - $0.01 - Micro-transactions

### Accepted Currencies

**Base Mainnet:**
- USDC
- DAI

**Ethereum Mainnet:**
- USDC
- DAI
- USDT

**Polygon:**
- USDC (POL)

## Running

```bash
export FACILITATOR_URL="https://facilitator.x402.org"
export RECIPIENT_ADDRESS="0xYourAddress"
go run main.go
```

## Testing Different Endpoints

```bash
# Should require $1.00 payment
curl http://localhost:8080/v1/premium/content

# Should require $0.10 payment
curl http://localhost:8080/v1/basic/content

# Should require $0.01 payment
curl http://localhost:8080/v1/micro/content

# Free - no payment required
curl http://localhost:8080/health
```

## Payment Context in Handlers

The example shows how to access payment information in your gRPC handlers:

```go
func (s *server) GetPremiumContent(ctx context.Context, req *pb.Request) (*pb.Response, error) {
    // Extract payment info from context
    payment, ok := x402.GetPaymentFromGRPCContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "payment required")
    }

    log.Printf("Payment received: %s %s from %s (tx: %s)",
        payment.Amount, payment.TokenSymbol, payment.PayerAddress, payment.TransactionHash)

    // Return premium content
    return &pb.Response{Message: "Premium content"}, nil
}
```

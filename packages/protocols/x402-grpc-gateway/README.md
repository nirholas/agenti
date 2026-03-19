# grpc-gateway-x402

Payment middleware for gRPC services that implements the [x402 protocol](https://x402.org).

[![Go Reference](https://pkg.go.dev/badge/github.com/becomeliminal/grpc-gateway-x402.svg)](https://pkg.go.dev/github.com/becomeliminal/grpc-gateway-x402)
[![Go Report Card](https://goreportcard.com/badge/github.com/becomeliminal/grpc-gateway-x402)](https://goreportcard.com/report/github.com/becomeliminal/grpc-gateway-x402)

## Features

- **V2 protocol**: CAIP-2 networks, structured payment requirements, multi-option 402 responses
- **V1 backward compatible**: Auto-detects V1 clients, no migration required
- Multi-currency: Accept any ERC-20 token (USDC, EURC, DAI, USDT, custom tokens)
- Multi-chain: Arbitrum, Base, Polygon, Avalanche, Gnosis, Codex
- Per-endpoint/method pricing with wildcard pattern matching
- Payment context propagates to gRPC handlers
- Custom HTML paywall support with User-Agent detection
- Pluggable verification: Use any x402 facilitator or implement custom logic
- HTTP (grpc-gateway) and native gRPC transports

## Quick Start

### Installation

```bash
go get github.com/becomeliminal/grpc-gateway-x402/v2
```

### Basic Usage

```go
package main

import (
    "net/http"

    x402 "github.com/becomeliminal/grpc-gateway-x402/v2"
    "github.com/becomeliminal/grpc-gateway-x402/v2/evm"
    "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
)

func main() {
    // Create EVM verifier (supports all EVM chains + ERC-20 tokens)
    verifier, _ := evm.NewEVMVerifier("https://facilitator.liminal.cash")

    // Configure payment requirements
    x402Config := x402.Config{
        Verifier: verifier,
        EndpointPricing: map[string]x402.PricingRule{
            "/v1/premium/*": {
                Amount: "1000000", // 1 USDC (6 decimals, atomic units)
                AcceptedTokens: []x402.TokenRequirement{
                    {
                        Network:       "eip155:8453", // Base (CAIP-2)
                        AssetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                        Symbol:        "USDC",
                        Recipient:     "0xYourAddress",
                    },
                },
            },
        },
    }

    // Create grpc-gateway mux with payment metadata propagation
    mux := runtime.NewServeMux(x402.WithPaymentMetadata())

    // Wrap with payment middleware
    handler := x402.PaymentMiddleware(x402Config)(mux)

    // Start server
    http.ListenAndServe(":8080", handler)
}
```

### Access Payment Details in Handlers

```go
func (s *server) GetPremiumContent(ctx context.Context, req *pb.Request) (*pb.Response, error) {
    payment, ok := x402.GetPaymentFromGRPCContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "payment required")
    }

    log.Printf("Payment: %s %s on %s (tx: %s)",
        payment.Amount, payment.TokenSymbol, payment.Network, payment.TransactionHash)

    return &pb.Response{Data: "premium content"}, nil
}
```

## What Changed in V2

| V1 | V2 |
|---|---|
| `go get github.com/becomeliminal/grpc-gateway-x402` | `go get github.com/becomeliminal/grpc-gateway-x402/v2` |
| Header: `X-PAYMENT` | Header: `PAYMENT-SIGNATURE` |
| Header: `X-PAYMENT-RESPONSE` | Header: `PAYMENT-RESPONSE` |
| 402 body only | 402 body + `PAYMENT-REQUIRED` header |
| Network: `"base-mainnet"` | Network: `"eip155:8453"` (CAIP-2) |
| Amount: `"1.00"` (human-readable) | Amount: `"1000000"` (atomic units) |
| `ChainVerifier.Verify(ctx, payment)` | `ChainVerifier.Verify(ctx, payload, requirements)` |
| `SupportedNetworks() []NetworkInfo` | `SupportedKinds() []SupportedKind` |
| No cross-validation | Payload `accepted` cross-validated against `requirements` |

### Amounts Are Atomic Units

V2 uses atomic units (smallest denomination) instead of human-readable decimals:

| Token | Decimals | 1.00 token | Atomic units |
|---|---|---|---|
| USDC | 6 | 1 USDC | `"1000000"` |
| EURC | 6 | 1 EURC | `"1000000"` |
| DAI | 18 | 1 DAI | `"1000000000000000000"` |
| USDT | 6 | 1 USDT | `"1000000"` |

## Configuration

### Multi-Currency, Multi-Chain

```go
x402Config := x402.Config{
    Verifier: verifier,
    EndpointPricing: map[string]x402.PricingRule{
        "/v1/api/*": {
            Amount: "100000", // 0.10 USDC
            AcceptedTokens: []x402.TokenRequirement{
                {
                    Network:       "eip155:8453",  // Base
                    AssetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    Symbol:        "USDC",
                    Recipient:     "0xYourAddress",
                },
                {
                    Network:       "eip155:42161", // Arbitrum
                    AssetContract: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                    Symbol:        "USDC",
                    Recipient:     "0xYourAddress",
                },
                {
                    Network:       "eip155:137",   // Polygon
                    AssetContract: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
                    Symbol:        "USDC",
                    Recipient:     "0xYourAddress",
                },
            },
        },
    },
}
```

### Path-Based Pricing

```go
EndpointPricing: map[string]x402.PricingRule{
    "/v1/premium/*":     {Amount: "1000000", ...},  // 1 USDC
    "/v1/basic/*":       {Amount: "100000", ...},   // 0.10 USDC
    "/v1/micro/*":       {Amount: "10000", ...},    // 0.01 USDC
    "/v1/specific-path": {Amount: "500000", ...},   // 0.50 USDC
}
```

### Skip Free Endpoints

```go
Config{
    SkipPaths: []string{
        "/health",
        "/metrics",
        "/v1/public/*",
    },
}
```

### Default Pricing

```go
Config{
    DefaultPricing: &x402.PricingRule{
        Amount: "50000", // 0.05 USDC default for unmatched paths
        AcceptedTokens: []x402.TokenRequirement{...},
    },
}
```

### Custom HTML Paywall

```go
Config{
    CustomPaywallHTML: `
        <html>
        <head><title>Payment Required</title></head>
        <body>
            <h1>Payment Required</h1>
            <p>This content requires payment. Please connect your wallet to continue.</p>
        </body>
        </html>
    `,
}
```

Browsers get HTML, API clients get JSON.

### Output Schema

```go
PricingRule{
    Amount: "1000000",
    OutputSchema: map[string]interface{}{
        "type": "object",
        "properties": map[string]interface{}{
            "joke": map[string]interface{}{
                "type":        "string",
                "description": "A programming joke",
            },
        },
    },
    AcceptedTokens: []x402.TokenRequirement{...},
}
```

## Protocol Flow

```
Client                    Gateway                    Facilitator              Blockchain
  |                          |                            |                        |
  |-- GET /v1/premium/data ->|                            |                        |
  |                          |                            |                        |
  |<- 402 Payment Required --|                            |                        |
  |   Body: {accepts: [...]} |                            |                        |
  |   PAYMENT-REQUIRED: ...  |                            |                        |
  |                          |                            |                        |
  |-- GET /v1/premium/data ->|                            |                        |
  |   PAYMENT-SIGNATURE: ... |                            |                        |
  |                          |-- POST /v2/x402/verify --->|                        |
  |                          |<- {valid: true} -----------|                        |
  |                          |                            |                        |
  |                          |-- POST /v2/x402/settle --->|                        |
  |                          |                            |-- transfer() --------->|
  |                          |                            |<- tx hash -------------|
  |                          |<- {txHash: "0x..."} -------|                        |
  |                          |                            |                        |
  |<- 200 OK ----------------|                            |                        |
  |   PAYMENT-RESPONSE: ...  |                            |                        |
  |   Premium Data           |                            |                        |
```

## Types

### `Config`

```go
type Config struct {
    Verifier         ChainVerifier              // Payment verification backend
    EndpointPricing  map[string]PricingRule      // URL patterns to pricing (HTTP)
    MethodPricing    map[string]PricingRule      // gRPC method names to pricing
    DefaultPricing   *PricingRule               // Fallback pricing (optional)
    ValidityDuration time.Duration              // Payment validity (default: 5 min)
    SkipPaths        []string                   // HTTP paths to skip
    SkipMethods      []string                   // gRPC methods to skip
    CustomPaywallHTML string                    // HTML for browser 402 responses
}
```

### `PricingRule`

```go
type PricingRule struct {
    Amount         string                 // Atomic units (e.g., "1000000" = 1 USDC)
    AcceptedTokens []TokenRequirement     // Accepted payment options
    Description    string                 // What this payment is for
    MimeType       string                 // Resource MIME type (optional)
    OutputSchema   map[string]interface{} // Response JSON schema (optional)
}
```

### `TokenRequirement`

```go
type TokenRequirement struct {
    Network       string // CAIP-2 (e.g., "eip155:8453")
    AssetContract string // Token contract address
    Symbol        string // Token symbol (e.g., "USDC")
    Recipient     string // Payment recipient address
    TokenName     string // Human-readable name (optional)
    TokenDecimals int    // Token decimals (optional)
}
```

### `PaymentRequirements`

Structured requirements sent in the 402 response. Each entry in the `Accepts` array is one of these.

```go
type PaymentRequirements struct {
    Scheme            string                 `json:"scheme"`
    Network           string                 `json:"network"`           // CAIP-2
    Amount            string                 `json:"amount"`            // atomic units
    Asset             string                 `json:"asset"`             // token contract
    PayTo             string                 `json:"payTo"`             // recipient
    MaxTimeoutSeconds int                    `json:"maxTimeoutSeconds,omitempty"`
    Extra             map[string]interface{} `json:"extra,omitempty"`   // merchant metadata
}
```

The `Extra` map allows merchant-defined metadata (e.g., `{"orderId": "...", "tier": "premium"}`).

### `PaymentPayload`

What the client sends in the `PAYMENT-SIGNATURE` header.

```go
type PaymentPayload struct {
    X402Version int                    `json:"x402Version"`
    Accepted    PaymentRequirements    `json:"accepted"`    // what client agreed to
    Payload     interface{}            `json:"payload"`     // scheme-specific (e.g., EVMPayload)
    Extensions  map[string]interface{} `json:"extensions,omitempty"` // protocol extensions
}
```

The `Extensions` map allows protocol extensions without breaking changes.

### `PaymentRequiredResponse`

The 402 response body. The `Accepts` array lets merchants offer multiple payment options (different chains, tokens, amounts).

```go
type PaymentRequiredResponse struct {
    X402Version int                   `json:"x402Version"`
    Error       string                `json:"error"`
    Accepts     []PaymentRequirements `json:"accepts"`
}
```

### `PaymentResponse`

Settlement receipt sent in the `PAYMENT-RESPONSE` header.

```go
type PaymentResponse struct {
    Success     bool   `json:"success"`
    Transaction string `json:"transaction,omitempty"` // tx hash
    Network     string `json:"network,omitempty"`     // CAIP-2
    Payer       string `json:"payer,omitempty"`
    ErrorReason string `json:"errorReason,omitempty"`
}
```

### `PaymentContext`

What handlers receive after payment is verified and settled.

```go
type PaymentContext struct {
    Verified        bool
    PayerAddress    string
    Amount          string
    TokenSymbol     string
    Network         string    // CAIP-2
    TransactionHash string
    SettledAt       time.Time
}
```

### `SupportedKind`

Scheme + network pair returned by the facilitator.

```go
type SupportedKind struct {
    Scheme  string `json:"scheme"`  // e.g., "exact"
    Network string `json:"network"` // CAIP-2
}
```

### `ChainVerifier` Interface

```go
type ChainVerifier interface {
    Verify(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*VerificationResult, error)
    Settle(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*SettlementResult, error)
    SupportedKinds() []SupportedKind
}
```

### Functions

| Function | Description |
|---|---|
| `PaymentMiddleware(cfg Config)` | Creates HTTP middleware |
| `GetPaymentFromContext(ctx)` | Extract payment from HTTP context |
| `GetPaymentFromGRPCContext(ctx)` | Extract payment from gRPC metadata |
| `RequirePayment(ctx)` | Extract payment or return error |
| `WithPaymentMetadata()` | grpc-gateway option to propagate payment context |
| `EncodePaymentPayload(payload)` | Encode payload for `PAYMENT-SIGNATURE` header |
| `DecodePaymentResponse(header)` | Decode `PAYMENT-RESPONSE` header |
| `ReadPaymentRequirements(resp)` | Read requirements from 402 response |
| `evm.NewEVMVerifier(url)` | Create EVM chain verifier |

## Supported Networks & Token Addresses

### USDC

| Network | CAIP-2 | Address |
|---|---|---|
| Arbitrum | `eip155:42161` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Base | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Polygon | `eip155:137` | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Avalanche | `eip155:43114` | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| Gnosis | `eip155:100` | `0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83` |
| Codex | `eip155:81224` | `0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4` |

### EURC

| Network | CAIP-2 | Address |
|---|---|---|
| Base | `eip155:8453` | `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42` |

## gRPC Transport

For native gRPC-to-gRPC communication, use the interceptors instead of HTTP middleware.

### Server Setup

```go
import x402grpc "github.com/becomeliminal/grpc-gateway-x402/v2/grpc"

srv := grpc.NewServer(
    grpc.UnaryInterceptor(x402grpc.UnaryServerInterceptor(x402Config)),
    grpc.StreamInterceptor(x402grpc.StreamServerInterceptor(x402Config)),
)
```

### gRPC Metadata Keys

| Version | Payment | Response | Requirements |
|---|---|---|---|
| V2 | `payment-signature` | `payment-response` | `payment-required` |
| V1 | `x402-payment` | `x402-payment-response` | `x402-payment-requirements` |

### Handler Access

```go
payment, ok := x402grpc.GetPaymentFromContext(ctx)
// or
payment, err := x402grpc.RequirePayment(ctx)
```

## Custom Facilitators

```go
// Liminal facilitator
verifier, _ := evm.NewEVMVerifier("https://facilitator.liminal.cash")

// Coinbase facilitator
verifier, _ := evm.NewEVMVerifier("https://facilitator.x402.org")

// Your own facilitator
verifier, _ := evm.NewEVMVerifier("https://my-facilitator.com")

// Local development
verifier, _ := evm.NewEVMVerifier("http://localhost:3000")
```

### Custom Verification

Skip facilitators entirely by implementing `ChainVerifier`:

```go
type CustomVerifier struct{}

func (v *CustomVerifier) Verify(ctx context.Context, payload *x402.PaymentPayload, requirements *x402.PaymentRequirements) (*x402.VerificationResult, error) {
    // Your verification logic
    return &x402.VerificationResult{Valid: true}, nil
}

func (v *CustomVerifier) Settle(ctx context.Context, payload *x402.PaymentPayload, requirements *x402.PaymentRequirements) (*x402.SettlementResult, error) {
    // Your settlement logic
    return &x402.SettlementResult{TransactionHash: "0x..."}, nil
}

func (v *CustomVerifier) SupportedKinds() []x402.SupportedKind {
    return []x402.SupportedKind{{Scheme: "exact", Network: "eip155:8453"}}
}

config := x402.Config{Verifier: &CustomVerifier{}}
```

## V1 Compatibility

The V2 middleware auto-detects V1 clients via header detection:

- `X-PAYMENT` header → V1 path (responds with `X-PAYMENT-RESPONSE`)
- `PAYMENT-SIGNATURE` header → V2 path (responds with `PAYMENT-RESPONSE`)

Both work simultaneously. Existing V1 clients require no changes.

## Examples

```bash
cd examples/basic
export RECIPIENT_ADDRESS="0xYourAddress"
go run main.go
```

See [`examples/`](./examples) for more:
- `basic/` - Single token integration
- `multi-token/` - Multiple currencies and networks, tiered pricing
- `jokes-api/` - Fun demo (pay $0.0001 for programming jokes)

## Testing

```bash
go test ./...
go test -cover ./...
```

## License

MIT

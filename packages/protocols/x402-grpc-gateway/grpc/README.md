# Native gRPC Support for x402

This package provides native gRPC interceptors for the x402 payment protocol, enabling payment-gated gRPC services.

## Overview

The `grpc` package implements the **gRPC Transport** for x402, distinct from the HTTP transport used with grpc-gateway. This is for native gRPC-to-gRPC communication.

### When to Use This

- **Service-to-service** communication in microservice architectures
- **Native gRPC clients** (mobile apps, CLIs, backend services)
- **High-performance** scenarios requiring binary protobuf (not JSON)
- **Service mesh** environments (Istio, Linkerd, etc.)

### When to Use HTTP Transport Instead

- **Browser clients** (use grpc-gateway with HTTP middleware)
- **REST API compatibility** requirements
- **OpenAPI/Swagger** documentation needs
- **curl/HTTP** testing and development

## Quick Start

### Server Setup

```go
package main

import (
	"log"
	"net"

	"github.com/becomeliminal/grpc-gateway-x402"
	x402grpc "github.com/becomeliminal/grpc-gateway-x402/grpc"
	"github.com/becomeliminal/grpc-gateway-x402/evm"
	"google.golang.org/grpc"

	pb "your/proto/package"
)

func main() {
	// Create EVM verifier (facilitator handles settlement)
	verifier, err := evm.NewEVMVerifier("https://facilitator.x402.org")
	if err != nil {
		log.Fatal(err)
	}

	// Configure payment requirements for gRPC methods
	cfg := x402.Config{
		Verifier: verifier,
		MethodPricing: map[string]x402.PricingRule{
			// Pay for specific method
			"/compute.v1.ComputeService/RunTask": {
				Amount: "0.10",
				AcceptedTokens: []x402.TokenRequirement{
					{
						Network:       "base-mainnet",
						AssetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
						Symbol:        "USDC",
						Recipient:     "0xYourAddress",
						TokenDecimals: 6,
					},
				},
			},
			// Pay for all methods in a service
			"/inference.v1.InferenceService/*": {
				Amount: "0.01",
				AcceptedTokens: []x402.TokenRequirement{...},
			},
		},
		// Skip health check
		SkipMethods: []string{
			"/grpc.health.v1.Health/Check",
		},
	}

	// Create gRPC server with x402 interceptors
	server := grpc.NewServer(
		grpc.UnaryInterceptor(x402grpc.UnaryServerInterceptor(cfg)),
		grpc.StreamInterceptor(x402grpc.StreamServerInterceptor(cfg)),
	)

	// Register your services
	pb.RegisterComputeServiceServer(server, &computeServiceImpl{})

	// Start listening
	lis, _ := net.Listen("tcp", ":9000")
	log.Println("gRPC server listening on :9000")
	server.Serve(lis)
}
```

### Accessing Payment Details in Handlers

```go
func (s *computeServiceImpl) RunTask(ctx context.Context, req *pb.RunTaskRequest) (*pb.RunTaskResponse, error) {
	// Extract payment info from context
	payment, ok := x402grpc.GetPaymentFromContext(ctx)
	if !ok {
		return nil, status.Error(codes.FailedPrecondition, "payment required")
	}

	log.Printf("Received payment: %s %s from %s (tx: %s)",
		payment.Amount,
		payment.TokenSymbol,
		payment.PayerAddress,
		payment.TransactionHash,
	)

	// Process the task...
	return &pb.RunTaskResponse{...}, nil
}

// Or use RequirePayment helper
func (s *computeServiceImpl) RunTask(ctx context.Context, req *pb.RunTaskRequest) (*pb.RunTaskResponse, error) {
	payment, err := x402grpc.RequirePayment(ctx)
	if err != nil {
		return nil, err
	}

	// payment is guaranteed to be valid here
	log.Printf("Paid by: %s", payment.PayerAddress)

	return &pb.RunTaskResponse{...}, nil
}
```

### Client Implementation

```go
package main

import (
	"context"
	"log"

	"github.com/becomeliminal/grpc-gateway-x402"
	x402grpc "github.com/becomeliminal/grpc-gateway-x402/grpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	pb "your/proto/package"
)

func main() {
	// Connect to service
	conn, err := grpc.Dial("api.example.com:9000", grpc.WithInsecure())
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	client := pb.NewComputeServiceClient(conn)
	ctx := context.Background()

	// First request (no payment) -> gets payment requirements
	var trailer metadata.MD
	_, err = client.RunTask(ctx, &pb.RunTaskRequest{...}, grpc.Trailer(&trailer))

	// Check if payment required
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.ResourceExhausted {
		log.Fatal("Unexpected error:", err)
	}

	// Extract payment requirements from error message
	// (In production, parse from status details)
	requirementsEncoded := st.Message() // base64-encoded JSON

	requirements, err := x402grpc.DecodePaymentRequirements(requirementsEncoded)
	if err != nil {
		log.Fatal("Failed to decode requirements:", err)
	}

	log.Printf("Payment required: %s %s",
		requirements.PaymentRequirements[0].MaxAmountRequired,
		requirements.PaymentRequirements[0].Metadata.TokenSymbol,
	)

	// Create payment (sign with wallet)
	payment := createAndSignPayment(requirements.PaymentRequirements[0], myWallet)

	// Encode payment
	paymentEncoded, err := x402grpc.EncodePayment(payment)
	if err != nil {
		log.Fatal(err)
	}

	// Retry with payment metadata
	md := metadata.Pairs("x402-payment", paymentEncoded)
	ctx = metadata.NewOutgoingContext(context.Background(), md)

	var trailer2 metadata.MD
	resp, err := client.RunTask(ctx, &pb.RunTaskRequest{...}, grpc.Trailer(&trailer2))
	if err != nil {
		log.Fatal("Payment failed:", err)
	}

	// Extract settlement response from trailer
	settlementEncoded := trailer2.Get("x402-payment-response")
	if len(settlementEncoded) > 0 {
		settlement, _ := x402grpc.DecodePaymentResponse(settlementEncoded[0])
		log.Printf("Payment settled: %s", settlement.TransactionHash)
	}

	log.Printf("Success! Result: %v", resp)
}
```

## How It Works

### Protocol Flow

1. **Client** calls gRPC method without payment
2. **Server interceptor** checks if method requires payment
3. **Server** returns `RESOURCE_EXHAUSTED` with payment requirements in error
4. **Client** creates and signs payment (EIP-3009 for EVM)
5. **Client** retries with `x402-payment` metadata
6. **Server** verifies and settles payment via facilitator
7. **Server** calls handler and returns response with settlement in trailing metadata

### Streaming RPCs

For streaming RPCs (server streaming, client streaming, bidirectional), payment is verified **before the stream begins**:

```go
// Payment happens upfront
stream, err := client.StreamingMethod(ctx)
// If payment required, error is returned before stream starts
// If payment valid, stream proceeds normally
```

Per-message payment is not supported in this version.

## Protocol Details

### gRPC Metadata Keys

- **`x402-payment-requirements`**: Base64-encoded JSON payment requirements (in error)
- **`x402-payment`**: Base64-encoded JSON payment payload (client → server)
- **`x402-payment-response`**: Base64-encoded JSON settlement response (server → client, trailing metadata)

### Status Codes

| x402 Event | gRPC Status Code | Description |
|------------|------------------|-------------|
| Payment Required | `RESOURCE_EXHAUSTED` (8) | No payment or invalid payment |
| Invalid Payment | `INVALID_ARGUMENT` (3) | Malformed payment data |
| Settlement Failed | `RESOURCE_EXHAUSTED` (8) | Payment verification or settlement failed |
| Success | `OK` (0) | Payment verified and settled |

**Note**: `RESOURCE_EXHAUSTED` follows Google Cloud's precedent for billing/quota enforcement, semantically representing "you've exhausted free access quota."

### Metadata Format

All payment data is encoded as base64 JSON in metadata, consistent with x402 HTTP transport.

**Payment Requirements** (error details):
```json
{
  "error": "payment required",
  "paymentRequirements": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-mainnet",
      "maxAmountRequired": "0.10",
      "resource": "/compute.v1.ComputeService/RunTask",
      "recipient": "0xRecipient",
      "assetContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "validBefore": 1730000000,
      "metadata": {
        "tokenSymbol": "USDC",
        "tokenDecimals": 6
      }
    }
  ]
}
```

**Payment Payload** (client metadata):
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base-mainnet",
  "payload": {
    "signature": "0x...",
    "authorization": {
      "from": "0xPayer",
      "to": "0xRecipient",
      "value": "100000",
      "validAfter": 0,
      "validBefore": 1730000000,
      "nonce": "0x..."
    }
  }
}
```

**Settlement Response** (trailing metadata):
```json
{
  "transactionHash": "0xabc123...",
  "status": "confirmed"
}
```

## API Reference

### Interceptors

#### `UnaryServerInterceptor(cfg x402.Config) grpc.UnaryServerInterceptor`

Creates a unary server interceptor that enforces x402 payments for unary RPC calls.

#### `StreamServerInterceptor(cfg x402.Config) grpc.StreamServerInterceptor`

Creates a stream server interceptor that enforces x402 payments for streaming RPC calls (upfront payment).

### Context Helpers

#### `GetPaymentFromContext(ctx context.Context) (*x402.PaymentContext, bool)`

Extracts payment information from the gRPC context. Returns nil, false if not found.

#### `RequirePayment(ctx context.Context) (*x402.PaymentContext, error)`

Extracts payment from context and returns error if not found or not verified. Useful for handlers that must have valid payment.

### Metadata Helpers

#### `EncodePaymentRequirements(requirements []x402.PaymentRequirements) (string, error)`

Encodes payment requirements to base64 JSON for metadata.

#### `DecodePaymentRequirements(encoded string) (*x402.PaymentRequiredResponse, error)`

Decodes payment requirements from base64 JSON.

#### `EncodePayment(payment *x402.Payment) (string, error)`

Encodes a payment to base64 JSON for metadata.

#### `DecodePayment(encoded string) (*x402.Payment, error)`

Decodes and validates a payment from base64 JSON.

#### `EncodePaymentResponse(response *x402.PaymentResponse) (string, error)`

Encodes a payment response to base64 JSON for metadata.

#### `DecodePaymentResponse(encoded string) (*x402.PaymentResponse, error)`

Decodes a payment response from base64 JSON.

## Examples

See the main repository examples for complete working code:
- Basic unary RPC with payment
- Streaming RPC with payment
- Client implementation with payment signing
- Multi-service configuration

## Differences from HTTP Transport

| Aspect | HTTP Transport | gRPC Transport |
|--------|----------------|----------------|
| **Protocol** | HTTP/1.1 or HTTP/2 | HTTP/2 with gRPC framing |
| **Encoding** | JSON | Binary Protobuf |
| **Payment Signal** | 402 HTTP status | RESOURCE_EXHAUSTED status |
| **Payment Header** | `X-PAYMENT` header | `x402-payment` metadata |
| **Response** | `X-PAYMENT-RESPONSE` header | Trailing metadata |
| **Use Case** | grpc-gateway, browsers, REST | Native gRPC, microservices |

## See Also

- [Main README](../README.md) - Overview and HTTP transport
- [x402 Specification](https://x402.org) - Protocol specification
- [gRPC Transport Spec](https://github.com/coinbase/x402/blob/main/specs/transports/grpc.md) - Official transport spec

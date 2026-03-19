# Basic Example

This example demonstrates how to integrate x402 payment middleware with a simple grpc-gateway service.

## Features

- Single endpoint with payment requirement
- USDC on Base Sepolia testnet
- Simple configuration

## Prerequisites

1. Go 1.21 or later
2. A Coinbase x402 facilitator URL (e.g., `https://facilitator.x402.org`)
3. An Ethereum address to receive payments

## Running the Example

1. Set environment variables:

```bash
export FACILITATOR_URL="https://facilitator.x402.org"
export RECIPIENT_ADDRESS="0xYourEthereumAddress"
```

2. Run the server:

```bash
go run main.go
```

3. Test without payment (should return 402):

```bash
curl -v http://localhost:8080/v1/hello
```

4. Test with payment (you'll need to construct a valid X-PAYMENT header):

```bash
# This requires a valid payment signature from a wallet
curl -v http://localhost:8080/v1/hello \
  -H "X-PAYMENT: <base64-encoded-payment>"
```

## Configuration

The example accepts USDC payments on Base Sepolia network:

- **Amount**: $0.01 (1 cent)
- **Token**: USDC
- **Network**: base-sepolia
- **Recipient**: Your configured address

## Code Structure

- `main.go` - Server setup with x402 middleware
- `proto/` - Proto definitions
- `generated/` - Generated gRPC and gateway code

# HTTP x402 Example

This example demonstrates basic usage of the x402 payment protocol with Go's standard `net/http` package. It includes both a server and client implementation.

## Features

- **Standard Library**: Uses only Go's `net/http` package (no framework)
- **Multi-Chain Support**: Works with EVM (Base, Ethereum) and SVM (Solana) networks
- **Server & Client**: Complete example of both payment provider and consumer
- **Flexible Signers**: Supports both EVM and Solana wallets

## Quick Start

### Running the Server

```bash
cd examples/http
go build -o http-example

# Run server with Base Sepolia (testnet - default)
./http-example server --pay-to YOUR_ADDRESS

# Run server with Base network (mainnet)
./http-example server --network base --pay-to YOUR_ADDRESS

# Custom configuration
./http-example server \
  --network base-sepolia \
  --pay-to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0 \
  --amount 1000 \
  --port 8080 \
  --verbose
```

### Running the Client

```bash
# Make a request to a paywalled endpoint (EVM)
./http-example client \
  --network base-sepolia \
  --key YOUR_PRIVATE_KEY \
  --url http://localhost:8080/data

# With verbose output
./http-example client \
  --network base-sepolia \
  --key YOUR_PRIVATE_KEY \
  --url http://localhost:8080/data \
  --verbose

# Using Solana with keyfile
./http-example client \
  --network solana-devnet \
  --key-file ~/.config/solana/id.json \
  --url http://localhost:8080/data

# Using Solana with base58 private key
./http-example client \
  --network solana-devnet \
  --key YOUR_BASE58_PRIVATE_KEY \
  --url http://localhost:8080/data
```

## Server Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--port` | Server port | `8080` |
| `--network` | Network (base, base-sepolia, solana, solana-devnet) | `base-sepolia` |
| `--pay-to` | Payment recipient address (required) | - |
| `--token` | Token contract address | Auto-detected |
| `--amount` | Payment amount in atomic units | `1000` (0.001 USDC) |
| `--facilitator` | Facilitator URL | `https://facilitator.x402.rs` |
| `--verbose` | Enable verbose debug output | `false` |

## Client Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--network` | Network to use | `base-sepolia` |
| `--key` | Private key (hex for EVM, base58 for Solana) | - |
| `--key-file` | Solana keygen JSON file | - |
| `--url` | URL to fetch (required) | - |
| `--token` | Token address | Auto-detected |
| `--max-amount` | Maximum amount per call | - |
| `--verbose` | Enable verbose debug output | `false` |

## Available Endpoints

### Public Endpoint (No Payment Required)

**GET /public**
```bash
curl http://localhost:8080/public
```

Response:
```json
{
  "message": "This is a free public endpoint",
  "info": "Try /data endpoint to test x402 payments"
}
```

### Protected Endpoint (Payment Required)

**GET /data** - Requires payment (default: 0.001 USDC)
```bash
# Without payment - returns 402
curl http://localhost:8080/data

# With x402 client
./http-example client --network base-sepolia --key YOUR_KEY --url http://localhost:8080/data
```

Response without payment (402):
```json
{
  "x402Version": 1,
  "error": "Payment required for this resource",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "1000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      "resource": "http://localhost:8080/data",
      "maxTimeoutSeconds": 60
    }
  ]
}
```

Response with valid payment (200):
```json
{
  "data": {
    "premium": true,
    "secret": "This is premium data that requires payment"
  },
  "message": "Successfully accessed paywalled content!",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Example Usage

### End-to-End Test

Terminal 1 - Start the server:
```bash
./http-example server \
  --network base-sepolia \
  --pay-to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0 \
  --amount 1000
```

Terminal 2 - Test the client:
```bash
# Test public endpoint (no payment)
curl http://localhost:8080/public

# Test paywalled endpoint with client
./http-example client \
  --network base-sepolia \
  --key YOUR_PRIVATE_KEY \
  --url http://localhost:8080/data
```

### Network Examples

**Base Sepolia (Testnet - Recommended for testing)**:
```bash
# Server
./http-example server --pay-to YOUR_ADDRESS

# Client
./http-example client --key YOUR_KEY --url http://server:8080/data
```

**Base Mainnet**:
```bash
# Server
./http-example server --network base --pay-to YOUR_ADDRESS

# Client
./http-example client --network base --key YOUR_KEY --url http://server:8080/data
```

**Solana Devnet**:
```bash
# Server
./http-example server --network solana-devnet --pay-to YOUR_SOLANA_ADDRESS

# Client (with keyfile)
./http-example client \
  --network solana-devnet \
  --key-file ~/.config/solana/id.json \
  --url http://server:8080/data

# Client (with private key)
./http-example client \
  --network solana-devnet \
  --key YOUR_BASE58_PRIVATE_KEY \
  --url http://server:8080/data
```

## Implementation Guide

### Basic Server Setup

```go
package main

import (
    "net/http"
    "github.com/mark3labs/x402-go"
    x402http "github.com/mark3labs/x402-go/http"
)

func main() {
    // Configure x402 middleware
    config := &x402http.Config{
        FacilitatorURL: "https://facilitator.x402.rs",
        PaymentRequirements: []x402.PaymentRequirement{{
            Scheme:            "exact",
            Network:           "base-sepolia",
            MaxAmountRequired: "1000", // 0.001 USDC
            Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            PayTo:             "YOUR_ADDRESS",
            MaxTimeoutSeconds: 60,
        }},
    }

    // Create middleware
    middleware := x402http.NewX402Middleware(config)

    // Create protected handler
    dataHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Protected content"))
    })

    // Apply middleware and serve
    http.Handle("/data", middleware(dataHandler))
    http.ListenAndServe(":8080", nil)
}
```

### Basic Client Setup

```go
package main

import (
    "fmt"
    "io"
    x402http "github.com/mark3labs/x402-go/http"
    "github.com/mark3labs/x402-go/signers/evm"
)

func main() {
    // Create EVM signer
    signer, _ := evm.NewSigner(
        evm.WithPrivateKey("YOUR_PRIVATE_KEY"),
        evm.WithNetwork("base-sepolia"),
        evm.WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
    )

    // Create x402-enabled HTTP client
    client, _ := x402http.NewClient(
        x402http.WithSigner(signer),
    )

    // Make request (payment handled automatically)
    resp, _ := client.Get("http://localhost:8080/data")
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}
```

## Configuration Options

### Network Detection

Token addresses are auto-detected based on network:
- `base`: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC mainnet)
- `base-sepolia`: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (USDC testnet)
- `solana`: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC mainnet)
- `solana-devnet`: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (USDC testnet)

### Payment Amounts

Payment amounts are in atomic units (6 decimals for USDC):
- `1000` = 0.001 USDC
- `10000` = 0.01 USDC
- `100000` = 0.1 USDC
- `1000000` = 1 USDC

## Production Considerations

1. **Use HTTPS**: Always use TLS in production
2. **Recipient Address**: Use your actual wallet address for `--pay-to`
3. **Network**: Switch to mainnet (`base` or `solana`) for production
4. **Amount**: Set appropriate payment amounts in atomic units
5. **Timeouts**: Adjust `MaxTimeoutSeconds` based on your requirements
6. **Monitoring**: Log payment verification and settlement for debugging

## Differences from Framework Examples

This example uses Go's standard library, while other examples use web frameworks:

| Feature | http | gin | chi |
|---------|------|-----|-----|
| Framework | None (stdlib) | Gin | Chi |
| Middleware | Standard http.Handler | Gin-specific | Standard http.Handler |
| Context | http.Request.Context() | gin.Context | http.Request.Context() |
| Setup | Simple | Feature-rich | Simple |

For more features (routing, JSON helpers, etc.), see the [Gin](../gin/) or [Chi](../chi/) examples.

## Learn More

- [x402 Protocol Specification](https://github.com/mark3labs/x402-go)
- [Go net/http Documentation](https://pkg.go.dev/net/http)
- [Base Network Documentation](https://docs.base.org/)
- [Solana Documentation](https://docs.solana.com/)

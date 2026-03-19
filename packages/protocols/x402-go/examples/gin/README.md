# Gin x402 Example

This example demonstrates how to use the x402 Gin middleware to protect API endpoints with payment requirements. It includes both a server and client implementation.

## Quick Start

### Running the Server

```bash
cd examples/gin
go build -o gin-example

# Run server with Base Sepolia (testnet - default)
./gin-example server --pay-to YOUR_ADDRESS

# Run server with Base network (mainnet)
./gin-example server --network base --pay-to YOUR_ADDRESS

# Custom configuration
./gin-example server \
  --network base-sepolia \
  --pay-to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0 \
  --amount 1000 \
  --port 8080 \
  --verbose
```

### Running the Client

```bash
# Make a request to a paywalled endpoint
./gin-example client \
  --network base-sepolia \
  --key YOUR_PRIVATE_KEY \
  --url http://localhost:8080/data

# With verbose output
./gin-example client \
  --network base-sepolia \
  --key YOUR_PRIVATE_KEY \
  --url http://localhost:8080/data \
  --verbose

# Using Solana
./gin-example client \
  --network solana-devnet \
  --key-file ~/.config/solana/id.json \
  --url http://localhost:8080/data

# Client (with private key)
./gin-example client \
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
./gin-example client --network base-sepolia --key YOUR_KEY --url http://localhost:8080/data
```

Response without payment (402):
```json
{
  "x402Version": 1,
  "error": "Payment required for this resource",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
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
  "payer": "0x1234...",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Example Usage

### End-to-End Test

Terminal 1 - Start the server:
```bash
./gin-example server \
  --network base-sepolia \
  --payTo 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0 \
  --amount 1000
```

Terminal 2 - Test the client:
```bash
# Test public endpoint (no payment)
curl http://localhost:8080/public

# Test paywalled endpoint with client
./gin-example client \
  --network base-sepolia \
  --key YOUR_PRIVATE_KEY \
  --url http://localhost:8080/data
```

### Network Examples

**Base Mainnet**:
```bash
# Server
./gin-example server --network base --payTo YOUR_ADDRESS

# Client
./gin-example client --network base --key YOUR_KEY --url http://server:8080/data
```

**Base Sepolia (Testnet)**:
```bash
# Server
./gin-example server --network base-sepolia --payTo YOUR_ADDRESS

# Client
./gin-example client --network base-sepolia --key YOUR_KEY --url http://server:8080/data
```

**Solana Devnet**:
```bash
# Server
./gin-example server --network solana-devnet --payTo YOUR_SOLANA_ADDRESS

# Client (with keyfile)
./gin-example client \
  --network solana-devnet \
  --keyfile ~/.config/solana/id.json \
  --url http://server:8080/data

# Client (with private key)
./gin-example client \
  --network solana-devnet \
  --key YOUR_BASE58_PRIVATE_KEY \
  --url http://server:8080/data
```

## Implementation Guide

### Basic Server Setup

```go
import (
    "github.com/gin-gonic/gin"
    "github.com/mark3labs/x402-go"
    x402http "github.com/mark3labs/x402-go/http"
    ginx402 "github.com/mark3labs/x402-go/http/gin"
)

// Create Gin router
r := gin.Default()

// Configure x402 middleware
config := &x402http.Config{
    FacilitatorURL: "https://facilitator.x402.rs",
    PaymentRequirements: []x402.PaymentRequirement{{
        Scheme:            "exact",
        Network:           "base",
        MaxAmountRequired: "1000", // 0.001 USDC
        Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        PayTo:             "YOUR_ADDRESS",
        MaxTimeoutSeconds: 60,
    }},
}

// Apply middleware to specific route
r.GET("/data", ginx402.NewGinX402Middleware(config), func(c *gin.Context) {
    // Access payment info
    if payment, exists := c.Get("x402_payment"); exists {
        verifyResp := payment.(*x402http.VerifyResponse)
        c.JSON(200, gin.H{"payer": verifyResp.Payer})
    }
})
```

### Route Groups

```go
// Public routes (no payment)
r.GET("/public", publicHandler)

// Protected routes (payment required)
protected := r.Group("/protected")
protected.Use(ginx402.NewGinX402Middleware(config))
{
    protected.GET("/data", dataHandler)
    protected.GET("/premium", premiumHandler)
}
```

### Accessing Payment Information

```go
func handler(c *gin.Context) {
    // Get payment info from Gin context
    paymentInfo, exists := c.Get("x402_payment")
    if !exists {
        c.JSON(500, gin.H{"error": "No payment info"})
        return
    }
    
    // Type assert to VerifyResponse
    verifyResp := paymentInfo.(*x402http.VerifyResponse)
    
    // Use payment information
    c.JSON(200, gin.H{
        "payer": verifyResp.Payer,
        "data": "protected content",
    })
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

### Verify-Only Mode

Skip settlement and only verify payment validity:

```go
config := &x402http.Config{
    VerifyOnly: true,
    // ... other fields
}
```

## Production Considerations

1. **Use HTTPS**: Always use TLS in production
2. **Recipient Address**: Use your actual wallet address for `PayTo`
3. **Network**: Switch to mainnet (`base`) for production
4. **Amount**: Set appropriate payment amounts in atomic units (6 decimals for USDC)
5. **Timeouts**: Adjust `MaxTimeoutSeconds` based on your requirements
6. **Monitoring**: Log payment verification and settlement for debugging

## Learn More

- [x402 Protocol Specification](https://github.com/mark3labs/x402-go)
- [Gin Framework Documentation](https://gin-gonic.com/)
- [Base Network Documentation](https://docs.base.org/)

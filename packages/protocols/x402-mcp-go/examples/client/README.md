# x402 Client Example

This directory contains an example implementation of an x402 MCP client with payment support.

## Files

- `main.go` - Client example with explicit payment configuration
- `main_test.go` - Test implementations
- `README.md` - This file

## Quick Start

```bash
# Build the client
go build -o client

# Run with testnet configuration (default)
./client -key YOUR_PRIVATE_KEY_HEX

# Or use environment variable for the key
export WALLET_PRIVATE_KEY="your-private-key-hex"
./client

# Connect to a different server
./client -server http://example.com:8080

# Use mainnet configuration
./client -network mainnet

# Enable verbose logging
./client -v
```

## Command-line Flags

```
Usage: ./client [flags]

Flags:
  -key string
        Private key hex (or set WALLET_PRIVATE_KEY env var)
  -server string
        MCP server URL (default "http://localhost:8080")
  -network string
        Network to use: testnet or mainnet (default "testnet")
  -v    Verbose output (shows payment attempts and results)
```

## Examples

### Basic Usage (Testnet)

```bash
# Run with testnet configuration
./client -key 0x1234...abcd
```

### Mainnet Configuration

```bash
# Use mainnet with verbose logging
./client -key 0x1234...abcd -network mainnet -v
```

### Custom Server

```bash
# Connect to remote server
./client -key 0x1234...abcd -server https://api.example.com
```

## Payment Options Configuration

The new x402 client requires explicit configuration of accepted payment methods. This gives you complete control over:

- Which networks you accept
- Which tokens you accept  
- Priority ordering of payment methods
- Per-option spending limits

### Single Payment Option (Simple)

```go
signer, err := x402.NewPrivateKeySigner(
    privateKey,
    x402.AcceptUSDCBaseSepolia(), // Accept USDC on Base Sepolia testnet
)
```

### Multiple Payment Options with Priorities

```go
signer, err := x402.NewPrivateKeySigner(
    privateKey,
    // Priority 1: Prefer Base mainnet (lower gas fees)
    x402.AcceptUSDCBase().
        WithPriority(1).
        WithMaxAmount("1000000").   // Max 1 USDC per payment
        WithMinBalance("500000"),   // Keep 0.5 USDC reserve
    
    // Priority 2: Fallback to testnet
    x402.AcceptUSDCBaseSepolia().
        WithPriority(2).
        WithMaxAmount("100000"),    // Max 0.1 USDC on testnet
)
```

## How Payment Selection Works

When a server requires payment and offers multiple options, the client:

1. **Filters** options to only those it supports (matching network, asset, and scheme)
2. **Sorts** by priority (lower number = higher priority)
3. **Selects** the cheapest option among those with the highest priority
4. **Respects** per-option limits (MaxAmount)

### Example Scenario

Server accepts:
- USDC on Base: 0.01 USDC
- USDC on Ethereum: 0.01 USDC (same price, higher gas)
- USDC on Base Sepolia: 0.005 USDC (cheaper, testnet)

Client configured with:
```go
x402.AcceptUSDCBase().WithPriority(1),        // Priority 1
x402.AcceptUSDCBaseSepolia().WithPriority(2), // Priority 2
// Note: Ethereum not configured, so not accepted
```

Result: Client selects Base mainnet (priority 1), even though Sepolia is cheaper.

## Environment Variables

- `WALLET_PRIVATE_KEY` - Your Ethereum private key (required)
- `MCP_SERVER_URL` - MCP server URL (default: `http://localhost:8080`)
- `NETWORK` - Network selection: `testnet` or `mainnet` (default: `testnet`)

## Troubleshooting

### "No acceptable payment method found"

This error means the client's configured payment options don't match what the server requires.

Check:
1. Network names match exactly (e.g., "base" vs "base-mainnet")
2. Asset addresses match
3. Payment scheme matches (usually "exact")

### "Payment declined by policy"

This means the payment was rejected by client-side rules:
- Amount exceeds `MaxPaymentAmount`
- Amount exceeds per-option `MaxAmount`
- Payment callback returned false

### Network Support

Currently supported networks with helpers:
- `base` - Base mainnet (`AcceptUSDCBase()`)
- `base-sepolia` - Base Sepolia testnet (`AcceptUSDCBaseSepolia()`)

For other networks, create a custom `ClientPaymentOption`:

```go
customOption := x402.ClientPaymentOption{
    PaymentRequirement: x402.PaymentRequirement{
        Scheme:  "exact",
        Network: "polygon",
        Asset:   "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC on Polygon
    },
    Priority: 1,
}
```
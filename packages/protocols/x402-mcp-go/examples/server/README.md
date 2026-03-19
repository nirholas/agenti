# X402 MCP Server Example

This example demonstrates how to create an MCP server that requires x402 payments for tool invocations.

## Features

- **Payment-Required Tools**: The server hosts a `search` tool that requires 0.01 USDC per query
- **Free Tools**: Includes an `echo` tool to demonstrate mixed free/paid tools
- **x402 Protocol Support**: Full implementation of the x402 HTTP micropayment protocol
- **Facilitator Integration**: Connects to an x402 facilitator service for payment verification
- **Testnet Support**: Optional testnet tools for development

## Quick Start

```bash
# Build the server
go build -o server

# Run with your wallet address (required)
./server -pay-to 0xYourWalletAddress

# Enable testnet tools
./server -pay-to 0xYourWallet -testnet

# Run in verify-only mode (for testing without settlement)
./server -pay-to 0xTestWallet -verify-only
```

## Command-line Flags

```
Usage: ./server [flags]

Flags:
  -port string
        Port to listen on (default "8080")
  -facilitator string
        x402 facilitator URL (default "https://facilitator.x402.rs")
  -pay-to string
        Payment recipient wallet address (required)
  -verify-only
        Only verify payments, don't settle on-chain
  -testnet
        Enable testnet payment options
```

The server will start on the specified port (default 8080).
The MCP endpoint is available at the root URL (e.g., `http://localhost:8080`)
The server internally handles `/mcp` and other MCP protocol routes.

## Available Tools

### Free Tools
- **echo** - Simple echo tool that returns the input message
  - Parameters: `message` (string, required)

### Paid Tools  
- **search** - Search for information on any topic
  - Cost: 0.01 USDC on Base mainnet
  - Parameters: `query` (string, required), `max_results` (number, optional)

### Testnet Tools (with `-testnet` flag)
- **test-feature** - Test feature for development
  - Cost: 0.001 USDC on Base Sepolia
  - Parameters: `input` (string, required)

## Examples

### Basic Usage

```bash
# Start server with payment recipient
./server -pay-to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1
```

### Development Setup

```bash
# Testnet with verify-only mode (no real settlement)
./server -pay-to 0xTestWallet -testnet -verify-only -port 3000
```

### Production Setup

```bash
# Production with real wallet
./server -pay-to 0xYourProductionWallet -facilitator https://facilitator.production.com
```

## Testing the Server

### 1. Without Payment (Returns 402)

```bash
# Note: The server internally routes to /mcp
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search",
      "arguments": {
        "query": "test",
        "max_results": 5
      }
    },
    "id": 1
  }'
```

This will return a 402 Payment Required response with payment requirements.

### 2. With x402 Client

Use the x402 MCP client to make paid requests:

```bash
# From the examples/client directory
./client -key YOUR_PRIVATE_KEY -server http://localhost:8080

# Or with environment variable
export WALLET_PRIVATE_KEY=your_private_key
./client -server http://localhost:8080

# With verbose output to see payment flow
./client -v -server http://localhost:8080
```

Note: The client should connect to the root URL (e.g., `http://localhost:8080`), not `/mcp`. 
The server handles MCP routing internally.

## How It Works

1. **Request Interception**: The x402 handler intercepts incoming MCP requests
2. **Payment Check**: For tools marked as payable, it checks for the `X-PAYMENT` header
3. **Payment Verification**: If payment is provided, it's verified with the facilitator
4. **Settlement**: The payment is settled on-chain (unless in verify-only mode)
5. **Tool Execution**: After successful payment, the tool is executed
6. **Response**: The response includes an `X-PAYMENT-RESPONSE` header confirming the transaction

## Customization

### Adding More Tools

```go
// Add a free tool
srv.AddTool(
    mcp.NewTool("free-tool", 
        mcp.WithDescription("A free tool")),
    freeToolHandler,
)

// Add a paid tool with multiple payment options
srv.AddPayableTool(
    mcp.NewTool("premium-tool",
        mcp.WithDescription("Premium feature")),
    premiumHandler,
    // Accept USDC on Base mainnet
    x402server.RequireUSDCBase(payTo, "50000", "Premium feature - 0.05 USDC"),
    // Also accept on Base Sepolia (discounted for testnet)
    x402server.RequireUSDCBaseSepolia(payTo, "10000", "Premium feature (testnet) - 0.01 USDC"),
)
```

## Architecture

The x402 server implementation uses a wrapper pattern:

```
HTTP Request
    ↓
X402Handler (payment verification)
    ↓
MCP StreamableHTTPServer
    ↓
MCP Server (tool execution)
    ↓
HTTP Response (with payment confirmation)
```

## Security Notes

- Always use HTTPS in production
- Keep your facilitator URL secure
- Validate payment amounts before processing
- Use environment variables for sensitive configuration
- Consider implementing rate limiting for payment requests

## Troubleshooting

### "Payment verification failed"
- Check facilitator is running and accessible
- Verify the payment signature is valid
- Ensure the payment amount matches requirements

### "Invalid session ID"
- Make sure MCP client properly initializes session
- Check that requests include proper session headers

### "Payment settlement failed"
- Verify blockchain network connectivity
- Check wallet has sufficient gas
- Ensure facilitator has settlement permissions
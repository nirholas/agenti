# MCP x402 Example

This example demonstrates both client and server implementations of MCP with x402 payment integration.

## Usage

### Server Mode

Start an MCP server with free and paid tools:

```bash
go run . -mode server -pay-to 0xYOUR_WALLET_ADDRESS
```

Options:
- `-port` - Server port (default: 8080)
- `-pay-to` - Payment recipient address (required for server mode)
- `-facilitator` - Facilitator URL (default: https://facilitator.x402.rs)
- `-verify-only` - Only verify payments, don't settle (useful for testing)
- `-testnet` - Use Base Sepolia testnet
- `-v` - Verbose logging

### Client Mode

Connect to an MCP server and call tools:

```bash
go run . -mode client -key YOUR_PRIVATE_KEY -server http://localhost:8080
```

Options:
- `-server` - MCP server URL (default: http://localhost:8080)
- `-key` - Private key for signing payments (required for client mode)
- `-network` - Network to use (default: base)
- `-testnet` - Use Base Sepolia testnet
- `-v` - Verbose logging

## Example Session

Terminal 1 (Server):
```bash
# Start server with payment address
go run . -mode server -pay-to 0x1234567890123456789012345678901234567890 -v
```

Terminal 2 (Client):
```bash
# Run client with private key
go run . -mode client -key 0xYOUR_PRIVATE_KEY -v
```

The client will:
1. Connect to the MCP server
2. List available tools (echo - free, search - paid)
3. Call the echo tool (no payment required)
4. Call the search tool (automatically handles payment)

## Tools

### Free Tool: echo
- Description: Echoes back the input message
- Arguments: `message` (string, required)
- Payment: None required

### Paid Tool: search
- Description: Premium search service
- Arguments: `query` (string, required), `max_results` (number, optional)
- Payment: 0.01 USDC on Base (or Base Sepolia if using -testnet)

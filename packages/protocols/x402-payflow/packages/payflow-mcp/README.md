# Payflow MCP Server
[![npm](https://img.shields.io/npm/v/@chainbound/payflow-mcp)](https://www.npmjs.com/package/@chainbound/payflow-mcp)

A Model Context Protocol (MCP) server that provides tools for creating x402 payment headers to use with paid MCP servers. This server acts as a payment client, allowing users to generate payment headers that can be submitted to paid MCP tools.

## Features

- **Payment Creation**: Generate x402 payment headers for USDC transactions on Base
- **MCP Compatible**: Works with any MCP client (Claude Desktop, etc.)

## Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payflow": {
      "command": "npx",
      "args": ["@chainbound/payflow-mcp"],
      "env": {
        "PRIVATE_KEY": "",
        // Set your max payment amount in USDC per tool call
        "MAX_PAYMENT_AMOUNT_USDC": "10",
      }
    }
  }
}
```

## Installation

```bash
npm install -g @chainbound/payflow-mcp
# or
pnpm add -g @chainbound/payflow-mcp
```

## Usage

Once connected, you can use the payment tool in Claude:

### Create Payment

Generate a payment header for a paid MCP tool:

```
Create a payment of 0.05 USDC to 0x742d35Cc6634C0532925a3b8D1d3e14C1C3E6FC8 for the weather_forecast tool
```

This will return an x402 payment header that you can then use with paid MCP servers.

## Tools

### `create_payment`

Creates an x402 payment header for use with paid MCP tools.

**Parameters:**
- `amount` (number, required): Payment amount in USDC
- `recipient` (string, required): Ethereum address to receive the payment
- `tool` (string, optional): Name of the MCP tool being paid for

**Returns:**
- x402 payment header string that can be submitted to paid MCP tools

## How It Works

1. **Generate Payment**: The tool creates a signed payment commitment using your private key
2. **x402 Protocol**: Uses the x402 micropayment protocol for blockchain payments
3. **USDC on Base**: All payments are in USDC on the Base network
4. **Submit to Paid Tools**: Use the generated header with paid MCP tools

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Your wallet private key (0x...) | ✅ |
| `MAX_PAYMENT_AMOUNT_USDC` | Maximum payment amount in USDC | ✅ |
| `DEBUG` | Set to `payflow` for debug logs | ❌ |

## Security Notes

⚠️ **Important Security Considerations:**

- Your `PRIVATE_KEY` is used to sign payment commitments
- Keep your private key secure and never share it
- The private key should have USDC balance for payments
- Consider using a dedicated wallet for MCP payments

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Link the package to a local binary
pnpm link

# Build
pnpm build

# Start production server
pnpm start
```

## Example Workflow

1. **Start Payflow MCP**: Run the server with your private key
2. **Create Payment**: Use the tool to generate payment headers
3. **Use Paid Tools**: Submit headers to paid MCP servers
4. **Payment Settlement**: Payments are automatically settled on Base

## Related

- [Payflow SDK](../payflow-sdk) - Build your own paid MCP servers
- [x402 Protocol](https://www.x402.org) - Micropayment standard
- [Model Context Protocol](https://github.com/modelcontextprotocol) - MCP specification

## License

MIT

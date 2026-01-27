# Sperax MCP Tools

This directory contains Model Context Protocol (MCP) tools for AI agents to interact with X402 payments using Sperax USDs.

## Available Tools

| Tool | Description |
|------|-------------|
| `x402_check_usds_balance` | Check USDs balance and yield for any address |
| `x402_pay_with_usds` | Make a payment (standard or gasless) |
| `x402_create_payment_authorization` | Create EIP-3009 gasless authorization |
| `x402_get_yield_stats` | Get current APY and yield statistics |
| `x402_estimate_payment_cost` | Estimate gas costs for payments |
| `x402_verify_payment` | Verify a payment transaction |

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sperax-x402": {
      "command": "npx",
      "args": ["@x402/sperax-mcp"],
      "env": {
        "PRIVATE_KEY": "your-private-key",
        "NETWORK": "sepolia"
      }
    }
  }
}
```

## Usage with Other AI Assistants

### Programmatic Integration

```typescript
import { SperaxX402Tools } from '@x402/sperax-mcp';

const tools = new SperaxX402Tools({
  privateKey: process.env.PRIVATE_KEY,
  network: 'arbitrum'
});

// Execute a tool
const balance = await tools.executeTool('x402_check_usds_balance', {
  address: '0x...'
});
```

### MCP Handler

```typescript
import { createMCPHandler } from '@x402/sperax-mcp';

const handler = createMCPHandler({
  privateKey: process.env.PRIVATE_KEY
});

// List available tools
console.log(handler.tools);

// Handle a tool call
const result = await handler.handleToolCall('x402_pay_with_usds', {
  recipient: '0x...',
  amount: '1.50',
  gasless: true
});
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Wallet private key (for payments) | For payments |
| `NETWORK` | `mainnet` or `sepolia` | No (default: sepolia) |
| `ARBITRUM_RPC_URL` | Custom RPC URL | No |
| `FACILITATOR_URL` | Facilitator server URL | No |

## Building

```bash
pnpm build
```

## Testing

```bash
pnpm test
```

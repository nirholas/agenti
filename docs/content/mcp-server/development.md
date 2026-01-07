# Development Guide

Set up local development for Universal Crypto MCP.

---

## Prerequisites

- [Bun](https://bun.sh/) v1.2.10+
- [Node.js](https://nodejs.org/) v17+

---

## Quick Start

```bash
# Clone
git clone https://github.com/nirholas/universal-crypto-mcp
cd universal-crypto-mcp

# Install dependencies
bun install

# Start development server
bun dev:sse
```

---

## Environment Variables

Create a `.env` file:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Wallet private key (optional, for write operations) |
| `LOG_LEVEL` | DEBUG, INFO, WARN, ERROR |
| `PORT` | Server port (default: 3001) |

---

## Project Structure

```
universal-crypto-mcp/
├── src/
│   ├── index.ts           # Entry point
│   ├── chains.ts          # Chain configurations
│   ├── modules/           # Feature modules
│   │   ├── blocks/
│   │   ├── bridge/
│   │   ├── contracts/
│   │   ├── events/
│   │   ├── gas/
│   │   ├── governance/
│   │   ├── lending/
│   │   ├── multicall/
│   │   ├── network/
│   │   ├── nft/
│   │   ├── portfolio/
│   │   ├── price-feeds/
│   │   ├── security/
│   │   ├── signatures/
│   │   ├── staking/
│   │   ├── swap/
│   │   ├── tokens/
│   │   ├── transactions/
│   │   └── wallet/
│   ├── server/            # MCP server
│   ├── services/          # Shared services
│   └── utils/             # Utilities
├── docs/                  # Documentation
└── package.json
```

---

## Adding a New Tool

Create a file in `src/modules/<module>/tools.ts`:

```typescript
import { z } from "zod"

export const exampleTools = {
  example_tool: {
    description: "Example tool description",
    schema: z.object({
      param: z.string().describe("Parameter description")
    }),
    handler: async ({ param }) => {
      // Implementation
      return { result: param }
    }
  }
}
```

Register in `src/modules/<module>/index.ts`:

```typescript
import { exampleTools } from "./tools"

export const registerModule = (server) => {
  Object.entries(exampleTools).forEach(([name, tool]) => {
    server.tool(name, tool.description, tool.schema, tool.handler)
  })
}
```

---

## Testing

```bash
# Run MCP Inspector
bun test

# Run E2E tests
bun e2e
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server (stdio) |
| `bun dev:sse` | Start dev server (SSE) |
| `bun build` | Build for production |
| `bun test` | Launch MCP Inspector |
| `bun format` | Format code |

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))

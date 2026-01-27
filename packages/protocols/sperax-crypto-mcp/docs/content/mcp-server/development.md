# Development Guide

Build, extend, and contribute to SperaxOS MCP.

---

## Prerequisites

- **Bun** v1.0+ or Node.js v18+
- **Git**
- **TypeScript** knowledge
- **Arbitrum RPC** (optional, uses public by default)

---

## Setup

```bash
# Clone repository
git clone https://github.com/sperax/speraxos
cd speraxos

# Install dependencies
bun install

# Build
bun run build

# Development mode
bun dev
```

---

## Project Structure

```
src/
├── server/
│   ├── base.ts          # MCP server initialization
│   ├── stdio.ts         # stdio transport
│   └── sse.ts           # SSE transport
├── sperax/
│   ├── index.ts         # Sperax module registration
│   ├── tools/           # Tool implementations
│   │   ├── usds.ts
│   │   ├── vault.ts
│   │   ├── spa.ts
│   │   ├── demeter.ts
│   │   ├── dripper.ts
│   │   ├── oracle.ts
│   │   ├── analytics.ts
│   │   └── governance.ts
│   ├── prompts/         # Prompt definitions
│   └── resources/       # Resource handlers
├── evm/
│   ├── index.ts         # EVM module
│   └── tools/           # General EVM tools
└── config.ts            # Configuration
```

---

## Adding a New Tool

### 1. Define the Tool

Create or edit a file in `src/sperax/tools/`:

```typescript
// src/sperax/tools/example.ts
import { z } from "zod";

export const exampleTools = {
  example_get_data: {
    description: "Get example data from the protocol",
    inputSchema: z.object({
      address: z.string().describe("Wallet address"),
      includeHistory: z.boolean().optional().describe("Include history"),
    }),
    handler: async (args: { address: string; includeHistory?: boolean }) => {
      // Implementation
      const data = await fetchData(args.address);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  },
};
```

### 2. Register the Tool

Add to `src/sperax/index.ts`:

```typescript
import { exampleTools } from "./tools/example";

export function registerSperaxTools(server: Server) {
  // ... existing registrations
  
  Object.entries(exampleTools).forEach(([name, tool]) => {
    server.tool(name, tool.description, tool.inputSchema, tool.handler);
  });
}
```

### 3. Test the Tool

```bash
# Run with MCP Inspector
npx @modelcontextprotocol/inspector bun dev

# Or test directly
bun run test
```

---

## Adding a Resource

```typescript
// src/sperax/resources/example.ts
export const exampleResources = {
  "sperax://example/guide": {
    name: "Example Guide",
    description: "Guide to using the example feature",
    mimeType: "text/markdown",
    handler: async () => ({
      contents: [
        {
          uri: "sperax://example/guide",
          mimeType: "text/markdown",
          text: `# Example Guide\n\nThis is the guide content...`,
        },
      ],
    }),
  },
};
```

---

## Adding a Prompt

```typescript
// src/sperax/prompts/example.ts
export const examplePrompts = {
  example_workflow: {
    name: "example_workflow",
    description: "Guide user through example workflow",
    arguments: [
      {
        name: "address",
        description: "User wallet address",
        required: true,
      },
    ],
    handler: async (args: { address?: string }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help me with the example workflow for ${args.address}...`,
          },
        },
      ],
    }),
  },
};
```

---

## Configuration

### Environment Variables

```bash
# .env
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
LOG_LEVEL=debug
PRIVATE_KEY=0x...  # Only for write operations
```

### Config File

```typescript
// src/config.ts
export const config = {
  chainId: 42161,
  rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  contracts: {
    usds: "0xD74f5255D557944cf7Dd0E45FF521520002D5748",
    vault: "0xF783DD830A4650D2A8594423F123250652340E3f",
    // ... more addresses
  },
};
```

---

## Testing

### Unit Tests

```typescript
// tests/tools/usds.test.ts
import { describe, test, expect } from "bun:test";
import { usdsTools } from "../../src/sperax/tools/usds";

describe("USDs Tools", () => {
  test("usds_get_info returns valid data", async () => {
    const result = await usdsTools.usds_get_info.handler({});
    expect(result.content[0].type).toBe("text");
    
    const data = JSON.parse(result.content[0].text);
    expect(data.totalSupply).toBeDefined();
  });
});
```

### Run Tests

```bash
bun test
bun test --watch
bun test tests/tools/usds.test.ts
```

---

## Debugging

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector bun dev
```

Opens a web UI to:
- Test tools interactively
- View tool responses
- Debug errors

### Logging

```typescript
import { logger } from "../utils/logger";

logger.debug("Detailed info", { data });
logger.info("General info");
logger.warn("Warning");
logger.error("Error", { error });
```

### VS Code Debugging

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug MCP",
      "runtimeExecutable": "bun",
      "args": ["dev"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

---

## Building for Production

```bash
# Build
bun run build

# Output in dist/
ls dist/

# Test production build
node dist/index.js
```

---

## Publishing

```bash
# Update version
bun version patch  # or minor, major

# Build
bun run build

# Publish
npm publish --access public
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/name`)
3. Make changes
4. Add tests
5. Run linter (`bun lint`)
6. Commit (`git commit -m "feat: description"`)
7. Push (`git push origin feature/name`)
8. Open PR

### Commit Convention

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/config changes

---

## What's Next?

<div class="grid cards" markdown>

-   :material-wrench:{ .lg .middle } **Tools Reference**

    ---

    See all available tools you can extend

    [:octicons-arrow-right-24: Tools](tools.md)

-   :material-file-document-outline:{ .lg .middle } **Resources & Prompts**

    ---

    Add custom resources and prompts

    [:octicons-arrow-right-24: Resources](resources-prompts.md)

-   :material-home:{ .lg .middle } **Home**

    ---

    Back to documentation overview

    [:octicons-arrow-right-24: Home](../index.md)

</div>

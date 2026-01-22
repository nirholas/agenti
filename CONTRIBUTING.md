# Contributing to Universal Crypto MCP

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/universal-crypto-mcp.git
   cd universal-crypto-mcp
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Workflow

### Running the Development Server

```bash
# stdio mode (for Claude Desktop)
npm run dev

# HTTP mode (for ChatGPT)
npm run dev:http

# SSE mode (legacy)
npm run dev:sse
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Type check
npm run lint

# Format code
npm run format

# Run all checks (CI simulation)
npm run ci
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(gas): add gas estimation for L2 chains
fix(tokens): handle edge case in ERC20 balance query
docs: update README with new tool examples
test(security): add tests for honeypot detection
```

## Pull Request Process

1. **Create an issue first** for significant changes
2. **Keep PRs focused** - one feature/fix per PR
3. **Write tests** for new functionality
4. **Update documentation** as needed
5. **Ensure CI passes** before requesting review

### PR Title Format

Follow the same format as commits:
```
feat(module): brief description of change
```

## Adding New MCP Tools

### Directory Structure

```
src/evm/modules/your-module/
├── index.ts       # Module registration
├── tools.ts       # Tool implementations
├── tools.test.ts  # Tool tests
├── prompts.ts     # Optional prompts
└── types.ts       # Optional types
```

### Tool Implementation Template

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam } from "../common/types"

export function registerYourTools(server: McpServer) {
  server.tool(
    "your_tool_name",
    "Clear description of what the tool does",
    {
      // Zod schema for parameters
      network: defaultNetworkParam,
      param1: z.string().describe("Description of param1"),
      param2: z.number().optional().describe("Optional param2")
    },
    async ({ network, param1, param2 }) => {
      try {
        // Implementation
        const result = await yourLogic(param1, param2)
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "performing your action")
      }
    }
  )
}
```

### Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerYourTools } from "./tools"

describe("Your Module Tools", () => {
  let server: McpServer
  let registeredTools: Map<string, { handler: Function }>

  beforeEach(() => {
    registeredTools = new Map()
    server = {
      tool: vi.fn((name, desc, schema, handler) => {
        registeredTools.set(name, { handler })
      })
    } as unknown as McpServer
    registerYourTools(server)
  })

  it("should register your_tool_name", () => {
    expect(registeredTools.has("your_tool_name")).toBe(true)
  })

  it("should return expected result", async () => {
    const tool = registeredTools.get("your_tool_name")
    const result = await tool!.handler({ network: "ethereum", param1: "test" })
    // Assert expected behavior
  })
})
```

## Security Considerations

### Private Key Handling

- Never log or expose private keys
- Use environment variables for sensitive data
- Validate all user input
- Don't hardcode addresses or keys in tests

### API Keys

- Use optional parameters for API keys
- Fall back to public endpoints when possible
- Document required API keys clearly

## Questions?

- Open a [GitHub Discussion](https://github.com/nirholas/universal-crypto-mcp/discussions)
- Create an [Issue](https://github.com/nirholas/universal-crypto-mcp/issues)

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

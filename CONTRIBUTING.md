# Contributing to Universal Crypto MCP

Thank you for your interest in contributing to Universal Crypto MCP! This document provides comprehensive guidelines and instructions for contributing to the project.

<p align="center">
  <a href="#getting-started">Getting Started</a> •
  <a href="#development-workflow">Development</a> •
  <a href="#testing">Testing</a> •
  <a href="#code-style">Code Style</a> •
  <a href="#pull-request-process">Pull Requests</a>
</p>

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and constructive in all interactions.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ or compatible package manager
- **Git** 2.30+
- A code editor (VS Code recommended with ESLint and Prettier extensions)

### Development Environment Setup

1. **Fork the repository**
   
   Click the "Fork" button on [GitHub](https://github.com/nirholas/universal-crypto-mcp)

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/universal-crypto-mcp.git
   cd universal-crypto-mcp
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/nirholas/universal-crypto-mcp.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Verify setup**
   ```bash
   npm run lint && npm test
   ```

6. **Create a branch for your changes**
   ```bash
   git checkout -b feat/your-feature-name
   ```

### Environment Variables (Optional)

Create a `.env` file for testing features that require API keys:

```bash
# Optional - for testing specific features
COINGECKO_API_KEY=your_key
PRIVATE_KEY=your_test_wallet_private_key  # Use a test wallet only!
```

---

## Development Workflow

### Running the Development Server

```bash
# stdio mode (for Claude Desktop testing)
npm run dev

# HTTP mode (for ChatGPT testing)
npm run dev:http

# SSE mode (legacy HTTP clients)
npm run dev:sse
```

### Project Structure

```
universal-crypto-mcp/
├── src/
│   ├── index.ts           # Entry point
│   ├── cli.ts             # CLI handling
│   ├── evm/               # EVM chain modules
│   │   ├── modules/       # Feature modules (swap, bridge, etc.)
│   │   └── services/      # Shared services
│   ├── modules/           # Non-EVM feature modules
│   ├── server/            # Server implementations (stdio, HTTP, SSE)
│   ├── utils/             # Utility functions
│   └── vendors/           # Third-party API integrations
├── tests/
│   ├── e2e/               # End-to-end tests
│   ├── integration/       # Integration tests
│   └── mocks/             # Test mocks and fixtures
└── docs/                  # Documentation
```

---

## Testing

We use [Vitest](https://vitest.dev/) for testing. All new features must include tests.

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run end-to-end tests
npm run test:e2e

# Open interactive test UI
npm run test:ui
```

### MCP Inspector

Test your tools interactively:

```bash
npm run test:inspector
```

This opens a browser UI where you can test tool execution with custom parameters.

### Writing Tests

- Place unit tests alongside source files: `module.ts` → `module.test.ts`
- Place integration tests in `tests/integration/`
- Place E2E tests in `tests/e2e/`

### Test Coverage Requirements

- Aim for **80%+ coverage** for new code
- Critical paths (security, transactions) require **90%+ coverage**
- Run `npm run test:coverage` to check coverage

---

## Code Style

We use **Prettier** for formatting and **ESLint** for linting with TypeScript strict mode.

### Code Quality Commands

```bash
# Check TypeScript types and run ESLint
npm run lint

# Run ESLint only
npm run lint:eslint

# Fix auto-fixable ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without making changes
npm run format:check

# Run all checks (simulates CI)
npm run ci
```

### Style Guidelines

1. **TypeScript**
   - Use strict TypeScript (`strict: true`)
   - Prefer explicit types over `any`
   - Use Zod schemas for runtime validation

2. **Naming Conventions**
   - Files: `kebab-case.ts`
   - Functions/variables: `camelCase`
   - Types/interfaces: `PascalCase`
   - Constants: `SCREAMING_SNAKE_CASE`

3. **Imports**
   - Use path aliases (`@/utils/helper` instead of relative paths)
   - Group imports: external → internal → types

4. **Comments**
   - Write JSDoc for public APIs
   - Use `// TODO:` for future improvements
   - Explain "why", not "what"

### Editor Setup

**VS Code** (recommended):
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

Install extensions:
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

---

## Pre-Submit Checklist

Before submitting a PR, ensure:

- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes all tests
- [ ] `npm run test:coverage` shows adequate coverage
- [ ] `npm run build` succeeds
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventions

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

---

## Types of Contributions

### 🐛 Bug Reports

Found a bug? Please [open an issue](https://github.com/nirholas/universal-crypto-mcp/issues/new?template=bug_report.yml) with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)

### 💡 Feature Requests

Have an idea? [Request a feature](https://github.com/nirholas/universal-crypto-mcp/issues/new?template=feature_request.yml) with:
- Clear description of the feature
- Use case and benefits
- Potential implementation approach

### 📖 Documentation

Documentation improvements are always welcome:
- Fix typos or clarify existing docs
- Add examples and tutorials
- Improve API documentation
- Translate documentation

### 🔧 Code Contributions

We welcome code contributions of all sizes:
- Bug fixes
- New MCP tools
- Performance improvements
- Test coverage improvements

---

## Getting Help

- 💬 [GitHub Discussions](https://github.com/nirholas/universal-crypto-mcp/discussions) - Questions and discussions
- 🐛 [GitHub Issues](https://github.com/nirholas/universal-crypto-mcp/issues) - Bug reports and feature requests
- 📖 [Documentation](https://universal-crypto-mcp.vercel.app) - Full documentation

---

## Recognition

Contributors are recognized in:
- The project's GitHub contributors page
- Release notes for significant contributions
- Our documentation (for major features)

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

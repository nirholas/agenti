# 🤖 Agenti - AI Agent Integration Guide

Instructions for AI coding agents (Cursor, Windsurf, Claude, Copilot) working with this repository.

## Project Overview

**Agenti** is a Universal Model Context Protocol (MCP) server for blockchain/DeFi operations. It provides 380+ tools for AI agents to interact with 20+ blockchain networks.

### Repository Structure

```
agenti/
├── src/                    # Core MCP server source
│   ├── cli.ts             # CLI entry point
│   ├── index.ts           # Main exports
│   ├── server/            # MCP server implementation
│   ├── modules/           # Tool modules (DeFi, security, etc.)
│   ├── evm/               # EVM chain handlers
│   ├── x402/              # x402 payment protocol
│   └── utils/             # Shared utilities
├── packages/              # Monorepo packages
│   ├── chains/            # Chain-specific implementations
│   ├── protocols/         # DeFi protocol integrations
│   ├── wallets/           # Wallet toolkits
│   ├── data/              # Market data providers
│   └── tools/             # Utility tools
├── tests/                 # Test suites
├── docs/                  # Documentation site
└── x402/                  # x402 protocol SDK
```

## Development Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start

# Run in development mode
npm run dev

# Run tests
npm test

# Run e2e tests
npm run test:e2e

# Lint
npm run lint

# Type check
npm run typecheck
```

## Key Technologies

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.0+
- **Build**: tsup
- **Testing**: Vitest
- **MCP SDK**: @modelcontextprotocol/sdk
- **Blockchain**: viem, ethers v6
- **Transport**: stdio, HTTP, SSE

## Code Conventions

### TypeScript

- Strict mode enabled
- Use `type` for type definitions, `interface` for extendable shapes
- Prefer `const` assertions for literal types
- Use `satisfies` for type checking without widening

### File Organization

- One tool per file in `src/modules/`
- Export through index files
- Co-locate tests with source (`*.test.ts`)

### Naming

- **Files**: kebab-case (`get-balance.ts`)
- **Classes**: PascalCase (`TokenHandler`)
- **Functions**: camelCase (`getBalance`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRIES`)
- **Types**: PascalCase (`TokenInfo`)

### Tool Implementation Pattern

```typescript
// src/modules/example/get-example.ts
import { z } from 'zod';
import { Tool } from '@/types';

const inputSchema = z.object({
  address: z.string().describe('Wallet address'),
  network: z.string().optional().default('ethereum'),
});

export const getExample: Tool = {
  name: 'get_example',
  description: 'Brief description of what this tool does',
  inputSchema,
  async execute(params) {
    const { address, network } = inputSchema.parse(params);
    // Implementation
    return { success: true, data: result };
  },
};
```

## Testing Guidelines

### Unit Tests

```typescript
// src/modules/example/get-example.test.ts
import { describe, it, expect } from 'vitest';
import { getExample } from './get-example';

describe('getExample', () => {
  it('should return data for valid address', async () => {
    const result = await getExample.execute({
      address: '0x...',
    });
    expect(result.success).toBe(true);
  });
});
```

### E2E Tests

- Located in `tests/e2e/`
- Use real network calls (on testnets when possible)
- Mock external APIs in CI

## Environment Variables

```bash
# Required for blockchain write operations
PRIVATE_KEY=0x...

# x402 payments (optional)
X402_PRIVATE_KEY=0x...
X402_NETWORK=base

# API keys for enhanced data (optional)
COINGECKO_API_KEY=...
DEFILLAMA_API_KEY=...
GOPLUS_API_KEY=...
```

## Common Tasks

### Adding a New Tool

1. Create file in appropriate module: `src/modules/<category>/<tool-name>.ts`
2. Implement using the Tool interface
3. Add to module's index.ts exports
4. Add tests
5. Update SKILLS.md if significant

### Adding a New Network

1. Add network config to `src/evm/networks.ts`
2. Add RPC endpoints
3. Test core operations (balance, transfer)
4. Update supported networks list

### Adding a New Protocol Integration

1. Create new package in `packages/protocols/<name>/`
2. Implement adapter interface
3. Add to main server if core feature
4. Document in protocol's README

## Security Considerations

### Never

- Log private keys or mnemonics
- Hardcode secrets
- Execute arbitrary user code
- Skip transaction simulation
- Auto-sign without confirmation for large amounts

### Always

- Validate all inputs with Zod schemas
- Use parameterized queries
- Check token security before interactions
- Simulate transactions before execution
- Rate limit API calls

## Pull Request Guidelines

1. **Branch naming**: `feat/description`, `fix/description`, `docs/description`
2. **Commit messages**: Follow conventional commits
3. **Tests**: Add tests for new features
4. **Documentation**: Update relevant docs
5. **Changelog**: Add entry if user-facing change

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [viem Documentation](https://viem.sh/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Contact

- GitHub Issues for bugs/features
- Twitter: [@nichxbt](https://x.com/nichxbt)

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

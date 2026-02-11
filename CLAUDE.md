# Claude Code Instructions for Agenti

## Project Context

Agenti is a Universal MCP (Model Context Protocol) server providing 380+ blockchain/DeFi tools for AI agents. It supports 20+ EVM chains and includes the x402 payment protocol for autonomous agent payments.

## Quick Reference

### Run Commands
```bash
npm install          # Install deps
npm run build        # Build TypeScript
npm start            # Run MCP server
npm run dev          # Development mode
npm test             # Run tests
```

### Key Directories
- `src/` - Core MCP server code
- `src/modules/` - Tool implementations
- `packages/` - Monorepo packages (chains, protocols, wallets)
- `tests/` - Test files
- `x402/` - Payment protocol SDK

### Code Style
- TypeScript strict mode
- Zod for input validation
- viem for blockchain interactions
- Conventional commits

## Common Tasks

### Adding a Tool
```typescript
// src/modules/<category>/<tool-name>.ts
import { z } from 'zod';

const inputSchema = z.object({
  param: z.string().describe('Description'),
});

export const toolName = {
  name: 'tool_name',
  description: 'What it does',
  inputSchema,
  async execute(params) {
    const validated = inputSchema.parse(params);
    return { success: true, data: result };
  },
};
```

### Testing
```bash
npm test                    # All tests
npm test -- --grep "name"   # Specific test
npm run test:e2e            # E2E tests
```

## Important Files

- `src/cli.ts` - CLI entry
- `src/server/index.ts` - MCP server setup
- `src/modules/index.ts` - Tool registry
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript config

## Don't

- Commit private keys or secrets
- Skip input validation
- Make breaking changes to tool schemas without versioning
- Ignore test failures

## Do

- Validate inputs with Zod
- Add tests for new tools
- Update docs for user-facing changes
- Use TypeScript strict mode
- Follow existing patterns in codebase

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

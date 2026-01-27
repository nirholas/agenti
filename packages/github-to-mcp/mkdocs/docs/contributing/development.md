# Development Setup

Set up your local development environment for contributing to GitHub to MCP.

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org)
- **pnpm** - [Install](https://pnpm.io/installation)
- **Git** - [Download](https://git-scm.com)

## Clone and Install

```bash
# Clone the repository
git clone https://github.com/nirholas/github-to-mcp
cd github-to-mcp

# Install dependencies
pnpm install
```

## Project Structure

```
github-to-mcp/
├── apps/
│   ├── web/            # Next.js web application
│   ├── docs/           # Documentation (Nextra)
│   └── vscode/         # VS Code extension
├── packages/
│   ├── core/           # Core conversion library
│   ├── openapi-parser/ # OpenAPI/GraphQL parser
│   └── mcp-server/     # MCP server implementation
├── mkdocs/             # MkDocs documentation
├── tests/              # Integration tests
└── templates/          # Code generation templates
```

## Development Commands

### Build All Packages

```bash
pnpm build
```

### Build Specific Package

```bash
pnpm --filter @nirholas/github-to-mcp build
pnpm --filter @github-to-mcp/openapi-parser build
```

### Run Development Server

```bash
pnpm dev
# Opens web app at http://localhost:3000
```

### Run Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

### Lint and Format

```bash
# Check
pnpm lint

# Fix
pnpm lint:fix

# Format
pnpm format
```

## Package Development

### Core Package

The main conversion library:

```bash
cd packages/core
pnpm build
pnpm test
```

Key files:
- `src/index.ts` - Public API
- `src/generator.ts` - Main generator
- `src/extractors/` - Tool extraction
- `src/github/` - GitHub API client

### OpenAPI Parser

Parse OpenAPI and GraphQL specs:

```bash
cd packages/openapi-parser
pnpm build
pnpm test
```

Key files:
- `src/openapi.ts` - OpenAPI parser
- `src/graphql.ts` - GraphQL parser
- `src/utils.ts` - Shared utilities

### MCP Server

MCP server implementation:

```bash
cd packages/mcp-server
pnpm build
pnpm test
```

Key files:
- `src/server.ts` - Server class
- `src/transport/` - Transport implementations
- `src/tools/` - Tool registration

## Web App Development

```bash
cd apps/web
pnpm dev
# http://localhost:3000
```

Key directories:
- `app/` - Next.js app router pages
- `components/` - React components
- `lib/` - Utilities and helpers

## Environment Setup

Create `.env.local` in the root:

```bash
# Optional: For testing with private repos
GITHUB_TOKEN=ghp_xxxxx

# Optional: For enhanced extraction
OPENAI_API_KEY=sk-xxxxx
```

## IDE Setup

### VS Code

Install recommended extensions:
- ESLint
- Prettier
- TypeScript

The project includes `.vscode/settings.json` for automatic formatting.

### Debugging

Launch configurations are provided in `.vscode/launch.json`:

1. Open VS Code
2. Go to Run and Debug (Cmd+Shift+D)
3. Select a configuration
4. Press F5

## Common Tasks

### Add a New Dependency

```bash
# Root workspace
pnpm add -w <package>

# Specific package
pnpm --filter @nirholas/github-to-mcp add <package>
```

### Create a Changeset

For version management:

```bash
pnpm changeset
```

### Link Local Packages

For testing locally:

```bash
pnpm link --global
```

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Test Failures

```bash
# Run specific test
pnpm test -- --grep "pattern"

# Update snapshots
pnpm test -- -u
```

### Type Errors

```bash
# Check types
pnpm typecheck

# Generate types
pnpm build
```

---

## Next Steps

- [Architecture](architecture.md) - Understand the codebase
- [Testing](testing.md) - Write tests
- [Contributing Guide](index.md) - Contribution guidelines

# CLI Reference

Command-line interface for GitHub to MCP.

## Installation

```bash
# Use directly with npx
npx @nirholas/github-to-mcp <command>

# Or install globally
npm install -g @nirholas/github-to-mcp
```

## Commands

| Command | Description |
|---------|-------------|
| [`generate`](generate.md) | Generate MCP server from a repository |
| [`inspect`](inspect.md) | Inspect a repository without generating |
| [`serve`](serve.md) | Start a generated MCP server |

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `-v, --version` | Show version number |
| `-h, --help` | Show help |
| `--verbose` | Enable verbose output |
| `--quiet` | Suppress non-error output |

## Quick Examples

```bash
# Generate MCP server
npx @nirholas/github-to-mcp generate https://github.com/stripe/stripe-node

# Inspect without generating
npx @nirholas/github-to-mcp inspect https://github.com/openai/openai-node

# Start a generated server
npx @nirholas/github-to-mcp serve ./my-mcp-server
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub authentication token |
| `LOG_LEVEL` | Logging verbosity (debug, info, warn, error) |

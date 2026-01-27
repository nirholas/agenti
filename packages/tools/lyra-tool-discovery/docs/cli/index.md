# CLI Overview

The Lyra Tool Discovery CLI provides commands for discovering, analyzing, and generating plugin configurations for MCP tools.

## Installation

::: code-group

```bash [pnpm]
pnpm add -g @nirholas/lyra-tool-discovery
```

```bash [npm]
npm install -g @nirholas/lyra-tool-discovery
```

```bash [yarn]
yarn global add @nirholas/lyra-tool-discovery
```

:::

## Basic Usage

```bash
# Show help
lyra-discover --help

# Show version
lyra-discover --version

# Discover tools
lyra-discover discover --sources github,npm --limit 10

# Analyze a specific repository
lyra-discover analyze-repo owner repo-name

# Analyze an npm package
lyra-discover analyze-npm @scope/package-name
```

## Command Structure

```
lyra-discover <command> [options]
```

### Available Commands

| Command | Description |
|---------|-------------|
| `discover` | Search for MCP tools across sources |
| `analyze-repo` | Analyze a specific GitHub repository |
| `analyze-npm` | Analyze a specific npm package |
| `providers` | Show available AI providers |
| `templates` | List available plugin templates |

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `-h, --help` | Display help for command |
| `-V, --version` | Output version number |

## Getting Help

```bash
# General help
lyra-discover --help

# Command-specific help
lyra-discover discover --help
lyra-discover analyze-repo --help
```

## Environment Variables

The CLI respects these environment variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `AI_PROVIDER` | Force specific provider |
| `AI_MODEL` | Override default model |
| `GITHUB_TOKEN` | GitHub API token |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |

## Next Steps

- [Commands](/cli/commands) - Detailed command reference
- [Configuration](/cli/configuration) - CLI configuration
- [Output Formats](/cli/output) - Working with output

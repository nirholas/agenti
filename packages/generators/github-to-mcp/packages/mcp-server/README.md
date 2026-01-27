# @github-to-mcp/mcp-server

MCP server that exposes github-to-mcp functionality for AI assistants like Claude Desktop and Cursor.

## Overview

This MCP server allows AI assistants to convert GitHub repositories into MCP servers on demand. It's the meta layer - using MCP to create MCP servers!

## Installation

```bash
# Install globally
npm install -g @github-to-mcp/mcp-server

# Or use npx
npx @github-to-mcp/mcp-server
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "github-to-mcp": {
      "command": "npx",
      "args": ["-y", "@github-to-mcp/mcp-server"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "github-to-mcp": {
      "command": "npx",
      "args": ["-y", "@github-to-mcp/mcp-server"]
    }
  }
}
```

## Available Tools

### `convert_repo`

Convert a GitHub repository into a complete MCP server implementation.

```
Arguments:
- github_url (required): The GitHub repository URL
- output_language: "typescript" or "python" (default: typescript)
- sources: Array of extraction sources to use
- github_token: GitHub token for private repos
```

### `list_extracted_tools`

Preview what tools would be extracted from a repository without generating the full server.

```
Arguments:
- github_url (required): The GitHub repository URL
- sources: Array of extraction sources
- github_token: GitHub token (optional)
```

### `validate_mcp_server`

Validate MCP server code for correctness and best practices.

```
Arguments:
- code (required): The MCP server code to validate
- language (required): "typescript" or "python"
```

### `generate_claude_config`

Generate Claude Desktop configuration for an MCP server.

```
Arguments:
- server_name (required): Name for the server
- server_path (required): Path to the server file
- language (required): "typescript" or "python"
- env_vars: Environment variables to pass
```

### `generate_cursor_config`

Generate Cursor IDE configuration for an MCP server.

```
Arguments:
- server_name (required): Name for the server
- server_path (required): Path to the server file
- language (required): "typescript" or "python"
```

### `analyze_repo_structure`

Analyze a repository to identify extraction sources and capabilities.

```
Arguments:
- github_url (required): The GitHub repository URL
- github_token: GitHub token (optional)
```

### `convert_openapi_to_mcp`

Convert an OpenAPI/Swagger specification directly to MCP tools.

```
Arguments:
- spec (required): The OpenAPI spec content (JSON or YAML)
- format: openapi, swagger, postman, insomnia, har, asyncapi, graphql
- base_url: Override base URL for API calls
```

### `get_tool_template`

Get a starter template for creating a new MCP tool.

```
Arguments:
- tool_name (required): Name for the tool
- description (required): What the tool does
- parameters: Array of parameter definitions
- language: "typescript" or "python"
```

### `generate_openapi_spec`

Generate OpenAPI 3.1 specification from source code (reverse engineering).

```
Arguments:
- files (required): Array of source files to analyze
  - path: File path
  - content: File content
- format: Output format ("json", "yaml", or "both")
- options: Generation options
  - title: API title
  - version: API version
  - baseUrl: Base URL for the API
  - servers: Array of server configurations
```

**Example:**
```json
{
  "files": [
    {
      "path": "routes/users.js",
      "content": "app.get('/users', (req, res) => { ... })"
    }
  ],
  "format": "both",
  "options": {
    "title": "My API",
    "version": "1.0.0"
  }
}
```

### `export_docker`

Generate Docker configuration files for deploying an MCP server.

```
Arguments:
- language (required): "typescript" or "python"
- server_name: Custom name for the server (default: "mcp-server")
- port: Port number for the server
- include_healthcheck: Include Docker healthcheck (default: false)
- env_vars: Environment variables as key-value pairs
```

**Example:**
```json
{
  "language": "typescript",
  "server_name": "my-mcp-server",
  "port": 3000,
  "include_healthcheck": true,
  "env_vars": {
    "API_KEY": "secret",
    "DEBUG": "true"
  }
}
```

Returns Dockerfile, docker-compose.yml, and .dockerignore files.

### `stream_convert`

Convert a GitHub repository with real-time progress updates (streaming).

```
Arguments:
- github_url (required): GitHub repository URL
- output_language: "typescript" or "python"
- sources: Array of extraction sources
- github_token: GitHub token for private repos
```

Returns a stream of progress events showing:
- Repository cloning
- File analysis
- Tool extraction
- Code generation

### `list_providers`

List all supported AI providers and their MCP configuration formats.

```
Arguments:
- include_examples: Include example configurations (default: true)
```

Returns information about:
- Claude Desktop
- Cursor
- VS Code Copilot
- Continue
- Cline
- Windsurf
- And more...

Each provider includes configuration path, format, and example setup.

## Available Resources

The server also provides documentation resources:

- `github-to-mcp://docs/quick-start` - Quick start guide
- `github-to-mcp://docs/extraction-sources` - Extraction source documentation
- `github-to-mcp://examples/typescript` - TypeScript MCP server example
- `github-to-mcp://examples/python` - Python MCP server example

## Example Usage

### With Claude Desktop

Once configured, you can ask Claude:

> "Convert the microsoft/playwright GitHub repo into an MCP server"

Claude will use the `convert_repo` tool to generate a complete MCP server implementation.

> "What tools can be extracted from the fastapi/fastapi repository?"

Claude will use `list_extracted_tools` to show you the available tools.

### Direct Execution

```bash
# Run the MCP server
github-to-mcp-server

# With environment variables
GITHUB_TOKEN=your-token github-to-mcp-server
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development
pnpm dev

# Run tests
pnpm test
```

## License

MIT - See [LICENSE](../../LICENSE) for details.

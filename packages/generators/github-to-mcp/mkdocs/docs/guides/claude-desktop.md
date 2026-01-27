# Claude Desktop Integration

Connect your generated MCP server to Claude Desktop for powerful AI conversations about any codebase.

## Prerequisites

- [Claude Desktop](https://claude.ai/download) installed
- A generated MCP server (see [Quick Start](../getting-started/quickstart.md))
- Node.js 18+ installed

## Step 1: Generate Your MCP Server

First, generate an MCP server for your target repository:

```bash
npx @nirholas/github-to-mcp https://github.com/owner/repo -o ~/mcp-servers/my-repo
```

## Step 2: Find Your Config File

Claude Desktop's configuration file location varies by operating system:

=== "macOS"

    ```
    ~/Library/Application Support/Claude/claude_desktop_config.json
    ```

=== "Windows"

    ```
    %APPDATA%\Claude\claude_desktop_config.json
    ```

=== "Linux"

    ```
    ~/.config/Claude/claude_desktop_config.json
    ```

!!! tip "Create if Missing"
    If the file doesn't exist, create it with an empty JSON object: `{}`

## Step 3: Add Your MCP Server

Edit the config file to add your MCP server:

```json
{
  "mcpServers": {
    "my-repo": {
      "command": "node",
      "args": ["/Users/yourname/mcp-servers/my-repo/server.mjs"]
    }
  }
}
```

### Multiple Servers

You can add multiple MCP servers:

```json
{
  "mcpServers": {
    "stripe-sdk": {
      "command": "node",
      "args": ["/Users/yourname/mcp-servers/stripe/server.mjs"]
    },
    "my-project": {
      "command": "node",
      "args": ["/Users/yourname/mcp-servers/my-project/server.mjs"]
    },
    "openai-docs": {
      "command": "node",
      "args": ["/Users/yourname/mcp-servers/openai/server.mjs"]
    }
  }
}
```

## Step 4: Restart Claude Desktop

After editing the config:

1. Quit Claude Desktop completely
2. Relaunch Claude Desktop
3. Look for the tools icon in the chat input

## Step 5: Verify Connection

You should see your MCP tools available in Claude. Click the tools icon (🔧) to see:

- `get_readme` - Get the repository README
- `list_files` - Browse files and directories
- `read_file` - Read file contents
- `search_code` - Search for code patterns
- Plus any extracted tools from the repo

## Using MCP Tools in Conversations

Once connected, Claude can use your tools automatically:

### Example: Explore a Codebase

> **You:** What does this repository do?
>
> **Claude:** *Uses `get_readme` tool* Based on the README, this is a...

### Example: Find Code

> **You:** Show me how authentication is implemented
>
> **Claude:** *Uses `search_code` tool* I found authentication in these files...
> *Uses `read_file` tool* Here's the implementation...

### Example: Navigate Structure

> **You:** What's in the src directory?
>
> **Claude:** *Uses `list_files` tool* The src directory contains...

## Troubleshooting

### Tools Not Appearing

1. **Check the config path** - Make sure you edited the correct file
2. **Validate JSON** - Use a JSON validator to check syntax
3. **Check absolute paths** - Paths must be absolute, not relative
4. **Restart Claude** - Fully quit and relaunch

### Server Errors

Check the server works standalone:

```bash
cd ~/mcp-servers/my-repo
npm install
node server.mjs
```

### Permission Issues

Ensure the server file is executable:

```bash
chmod +x ~/mcp-servers/my-repo/server.mjs
```

### View Logs

Enable MCP logging in Claude Desktop:

1. Open Claude Desktop
2. Go to Settings → Developer
3. Enable "Show MCP Logs"

---

## Advanced Configuration

### Environment Variables

Pass environment variables to your server:

```json
{
  "mcpServers": {
    "my-repo": {
      "command": "node",
      "args": ["/path/to/server.mjs"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxx",
        "DEBUG": "true"
      }
    }
  }
}
```

### Working Directory

Set the working directory:

```json
{
  "mcpServers": {
    "my-repo": {
      "command": "node",
      "args": ["server.mjs"],
      "cwd": "/path/to/my-repo"
    }
  }
}
```

### Using Python Servers

For Python-generated servers:

```json
{
  "mcpServers": {
    "my-repo": {
      "command": "python",
      "args": ["/path/to/server.py"]
    }
  }
}
```

---

## Best Practices

1. **Use descriptive names** - Name servers after their repositories
2. **Keep servers updated** - Regenerate when the source repo updates
3. **Organize servers** - Keep all servers in a dedicated directory
4. **Document your setup** - Note which servers you've added

---

## Next Steps

- [Cursor Integration](cursor.md) - Use MCP with Cursor IDE
- [Custom Tools](custom-tools.md) - Extend your generated tools
- [API Reference](../api/index.md) - Programmatic server generation

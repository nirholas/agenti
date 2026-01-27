# Cursor Integration

Use GitHub to MCP with Cursor IDE for AI-assisted coding with full codebase context.

## Prerequisites

- [Cursor](https://cursor.sh) installed
- A generated MCP server (see [Quick Start](../getting-started/quickstart.md))
- Node.js 18+ installed

## Step 1: Generate Your MCP Server

```bash
npx @nirholas/github-to-mcp https://github.com/owner/repo -o ~/mcp-servers/my-repo
```

## Step 2: Configure Cursor

Cursor's MCP configuration is in your settings. Open Cursor and:

1. Press `Cmd/Ctrl + ,` to open Settings
2. Search for "MCP"
3. Click "Edit in settings.json"

Or edit directly:

=== "macOS"

    ```
    ~/Library/Application Support/Cursor/User/settings.json
    ```

=== "Windows"

    ```
    %APPDATA%\Cursor\User\settings.json
    ```

=== "Linux"

    ```
    ~/.config/Cursor/User/settings.json
    ```

## Step 3: Add MCP Server

Add your MCP server configuration:

```json
{
  "mcp.servers": {
    "my-repo": {
      "command": "node",
      "args": ["/Users/yourname/mcp-servers/my-repo/server.mjs"]
    }
  }
}
```

## Step 4: Restart Cursor

1. Close all Cursor windows
2. Relaunch Cursor
3. The MCP tools should now be available

## Using MCP with Cursor

### In Chat (Cmd+L)

Ask questions about the connected repository:

> **You:** How does the authentication middleware work?
>
> **Cursor:** *Uses MCP tools to search and read files* The authentication middleware in this repo...

### In Composer (Cmd+K)

Reference MCP tools when generating code:

> **You:** Create a new endpoint similar to the existing /users endpoint
>
> **Cursor:** *Uses `search_code` to find the users endpoint, `read_file` to understand the pattern*

### Context Awareness

With MCP connected, Cursor can:

- Search the entire repository for relevant code
- Understand API patterns and conventions
- Find related implementations
- Reference documentation

## Multiple Repositories

Configure multiple repos for cross-codebase AI assistance:

```json
{
  "mcp.servers": {
    "frontend": {
      "command": "node",
      "args": ["/path/to/frontend-mcp/server.mjs"]
    },
    "backend": {
      "command": "node",
      "args": ["/path/to/backend-mcp/server.mjs"]
    },
    "shared-lib": {
      "command": "node",
      "args": ["/path/to/shared-mcp/server.mjs"]
    }
  }
}
```

## Workflow Tips

### 1. Connect External Dependencies

Generate MCP servers for libraries you use:

```bash
# Your project's main dependency
npx @nirholas/github-to-mcp https://github.com/prisma/prisma -o ~/mcp-servers/prisma
```

Then ask Cursor about Prisma patterns while coding.

### 2. Reference Documentation Repos

```bash
npx @nirholas/github-to-mcp https://github.com/vercel/next.js -o ~/mcp-servers/nextjs
```

Ask about Next.js best practices with real code context.

### 3. Keep Servers Updated

When dependencies update, regenerate:

```bash
npx @nirholas/github-to-mcp https://github.com/prisma/prisma -o ~/mcp-servers/prisma --force
```

## Troubleshooting

### MCP Not Working

1. Check Cursor version (MCP requires recent versions)
2. Verify the config file location
3. Test the server standalone:
   ```bash
   node ~/mcp-servers/my-repo/server.mjs
   ```

### Slow Responses

For large repos, optimize your MCP server:

```bash
npx @nirholas/github-to-mcp <url> \
  --exclude-tools get_readme \
  -o ~/mcp-servers/my-repo
```

### Permission Errors

On macOS, you may need to allow Node.js:

1. System Preferences → Security & Privacy
2. Allow `node` to run

---

## Best Practices

1. **Local repos first** - For your active project, use Cursor's built-in context
2. **MCP for external** - Use MCP for dependencies and reference repos
3. **Selective tools** - Exclude unused tools for faster responses
4. **Keep servers lean** - Don't generate servers for massive repos unless needed

---

## Next Steps

- [VS Code Integration](vscode.md)
- [Custom Tools](custom-tools.md)
- [Batch Conversion](batch.md) - Generate multiple servers at once

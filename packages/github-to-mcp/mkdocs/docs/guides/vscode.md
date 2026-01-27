# VS Code Integration

Use GitHub to MCP with Visual Studio Code for enhanced AI-assisted development.

## Overview

VS Code can use MCP servers through several methods:

1. **GitHub Copilot Chat** - Native MCP support (coming soon)
2. **Continue Extension** - MCP-enabled coding assistant
3. **Custom Extensions** - Build your own integration

## Method 1: Continue Extension

[Continue](https://continue.dev) is an open-source coding assistant that supports MCP.

### Installation

1. Install the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue)
2. Open VS Code command palette: `Cmd/Ctrl + Shift + P`
3. Search "Continue: Open Configuration"

### Configuration

Edit `~/.continue/config.json`:

```json
{
  "models": [...],
  "mcpServers": [
    {
      "name": "my-repo",
      "command": "node",
      "args": ["/path/to/my-repo-mcp/server.mjs"]
    }
  ]
}
```

### Usage

1. Open Continue panel (`Cmd/Ctrl + L`)
2. Ask questions referencing your MCP server
3. Continue will use MCP tools automatically

## Method 2: MCP Inspector

For testing and debugging MCP servers in VS Code:

### Install MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
```

### Use with VS Code Terminal

```bash
# Start your MCP server
cd ~/mcp-servers/my-repo
node server.mjs

# In another terminal, inspect
mcp-inspector ws://localhost:3000
```

## Method 3: Custom Task

Create a VS Code task to manage MCP servers:

### .vscode/tasks.json

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start MCP Server",
      "type": "shell",
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/server.mjs"],
      "isBackground": true,
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      }
    },
    {
      "label": "Generate MCP Server",
      "type": "shell",
      "command": "npx",
      "args": [
        "@nirholas/github-to-mcp",
        "${input:repoUrl}",
        "-o",
        "${workspaceFolder}/mcp-server"
      ]
    }
  ],
  "inputs": [
    {
      "id": "repoUrl",
      "type": "promptString",
      "description": "GitHub repository URL"
    }
  ]
}
```

### Usage

1. `Cmd/Ctrl + Shift + P` → "Tasks: Run Task"
2. Select "Generate MCP Server" or "Start MCP Server"

## Workspace Setup

### Project Structure

Recommended structure for projects using MCP:

```
my-project/
├── src/
├── .vscode/
│   ├── tasks.json      # MCP server tasks
│   └── settings.json   # Continue/MCP config
├── mcp-server/         # Generated MCP server
│   ├── server.mjs
│   └── package.json
└── package.json
```

### Generate on Clone

Add a setup script to package.json:

```json
{
  "scripts": {
    "setup:mcp": "npx @nirholas/github-to-mcp https://github.com/owner/repo -o ./mcp-server",
    "mcp:start": "node ./mcp-server/server.mjs"
  }
}
```

## GitHub Copilot Integration

!!! note "Coming Soon"
    Native MCP support in GitHub Copilot Chat is planned. Until then, use Continue or custom integrations.

### Current Workaround

Use MCP-generated code as context for Copilot:

1. Generate server for a reference repo
2. Keep the `tools/` directory open in VS Code
3. Copilot will use it as context when generating code

## Tips for VS Code Users

### 1. Use Multi-Root Workspaces

Add MCP servers as workspace folders:

```json
// my-project.code-workspace
{
  "folders": [
    { "path": "." },
    { "path": "../mcp-servers/stripe", "name": "Stripe MCP" },
    { "path": "../mcp-servers/openai", "name": "OpenAI MCP" }
  ]
}
```

### 2. Create Snippets

Add snippets for MCP generation:

```json
// .vscode/snippets/mcp.code-snippets
{
  "Generate MCP": {
    "prefix": "genmcp",
    "body": [
      "npx @nirholas/github-to-mcp $1 -o ./$2-mcp"
    ],
    "description": "Generate MCP server command"
  }
}
```

### 3. Terminal Profiles

Add a profile for MCP development:

```json
// settings.json
{
  "terminal.integrated.profiles.osx": {
    "MCP Dev": {
      "path": "bash",
      "args": ["-l"],
      "env": {
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## Troubleshooting

### Extension Not Finding Server

Ensure the path is absolute and the server is executable:

```bash
chmod +x /path/to/server.mjs
```

### Node Version Issues

Specify Node version in your launch config:

```json
{
  "mcpServers": [
    {
      "name": "my-repo",
      "command": "/usr/local/bin/node",
      "args": ["/path/to/server.mjs"]
    }
  ]
}
```

---

## Next Steps

- [Private Repos](private-repos.md) - Work with authentication
- [Custom Tools](custom-tools.md) - Extend your MCP server
- [CLI Reference](../cli/index.md) - Command-line options

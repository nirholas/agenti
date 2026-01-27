# GitHub to MCP VS Code Extension

Convert GitHub repositories to MCP (Model Context Protocol) servers directly from VS Code. Generate ready-to-use MCP tools from any GitHub repository's APIs, documentation, and code.

![GitHub to MCP](https://img.shields.io/badge/VS%20Code-Extension-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 🔄 Multiple Conversion Methods

#### Convert from URL
Enter any GitHub repository URL to convert:
- Press `Ctrl+Shift+M` (or `Cmd+Shift+M` on Mac)
- Or use Command Palette: "GitHub to MCP: Convert from URL"

![Convert from URL Screenshot](resources/screenshots/convert-url.png)

#### Convert Current Workspace
Convert the currently open GitHub repository:
- Press `Ctrl+Shift+Alt+M` (or `Cmd+Shift+Alt+M` on Mac)
- Or use Command Palette: "GitHub to MCP: Convert Current Workspace"

#### Convert from Clipboard
Quickly convert a GitHub URL from your clipboard:
- Run "GitHub to MCP: Convert from Clipboard"

### 📚 Server Registry
Browse and convert from a curated list of popular repositories:
- Run "GitHub to MCP: Browse Server Registry"
- Filter by category (AI Tools, Frameworks, APIs, etc.)
- Search by name or description

![Registry Screenshot](resources/screenshots/registry.png)

### 🖥️ Activity Bar Views

#### MCP Servers View
See all your converted MCP servers at a glance:
- Expandable tree showing servers and their tools
- Click to view details
- Right-click for quick actions

#### Tools Explorer
Explore all extracted tools across servers:
- Grouped by category
- Filter/search capability
- View tool parameters and descriptions

#### Conversion History
Track your conversion history:
- See recent conversions
- Quick access to results
- Remove or clear history

![Sidebar Screenshot](resources/screenshots/sidebar.png)

### 🎨 Webview Panels

#### Results Panel
Beautiful webview showing conversion results:
- Overview with statistics
- List of extracted tools with details
- Generated MCP server code
- Ready-to-use configuration snippets

#### Tool Details Panel
Inspect individual tools:
- Full description and parameters
- Parameter input fields for testing
- Copy tool definition

### ⚙️ Claude Desktop Integration

#### Auto-Configure Claude Desktop
Automatically add converted servers to your Claude Desktop config:
- Run "GitHub to MCP: Configure Claude Desktop"
- Select servers to add
- Choose output directory
- Config file updated automatically

#### Open Claude Config
Quickly access your Claude Desktop configuration file:
- Run "GitHub to MCP: Open Claude Desktop Config"

### 📊 Status Bar
- Shows when you're in a GitHub repository
- Click for quick actions menu
- Progress indicator during conversion

### 🔍 Auto-Detection
When you open a GitHub repository folder:
- The extension detects it automatically
- Offers to convert it to an MCP server
- Can be disabled in settings

## Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| Convert from URL | `Ctrl+Shift+M` | Enter a GitHub URL to convert |
| Convert Current Workspace | `Ctrl+Shift+Alt+M` | Convert the open repository |
| Convert from Clipboard | - | Convert URL from clipboard |
| Browse Server Registry | - | Browse popular repositories |
| Configure Claude Desktop | - | Auto-configure Claude Desktop |
| Open Claude Desktop Config | - | Open config file in editor |
| Copy MCP Config | - | Copy config for Claude/Cursor |
| Validate MCP Server | - | Validate a generated server file |
| Show Output | - | Show extension logs |
| Open Conversion Panel | `Ctrl+K Ctrl+M` | Open the conversion webview |

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `github-to-mcp.defaultPlatform` | string | `"claude"` | Default platform for config output |
| `github-to-mcp.autoDetect` | boolean | `true` | Auto-detect GitHub repos when opening |
| `github-to-mcp.historyLimit` | number | `20` | Maximum items in history |
| `github-to-mcp.alwaysShowStatusBar` | boolean | `false` | Always show status bar item |
| `github-to-mcp.githubToken` | string | `""` | GitHub token for higher API limits |
| `github-to-mcp.defaultOutputDirectory` | string | `""` | Default directory for server files |
| `github-to-mcp.defaultRuntime` | string | `"node"` | Default runtime (node/typescript/python) |
| `github-to-mcp.autoConfigureClaude` | boolean | `false` | Auto-add servers to Claude config |
| `github-to-mcp.showToolParameters` | boolean | `true` | Show parameters in Tools Explorer |
| `github-to-mcp.logLevel` | string | `"info"` | Logging level (debug/info/warn/error) |

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "GitHub to MCP"
4. Click Install

### From VSIX File
1. Download the `.vsix` file from [Releases](https://github.com/nirholas/github-to-mcp/releases)
2. In VS Code, run "Extensions: Install from VSIX..."
3. Select the downloaded file

### From Source
1. Clone the repository:
   ```bash
   git clone https://github.com/nirholas/github-to-mcp.git
   cd github-to-mcp
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the extension:
   ```bash
   cd apps/vscode
   pnpm run build
   ```
4. Press `F5` to launch in debug mode

## Usage Guide

### Quick Start

1. **Install the extension** from the VS Code Marketplace

2. **Convert a repository:**
   - Press `Ctrl+Shift+M`
   - Enter a GitHub URL like `https://github.com/stripe/stripe-node`
   - Wait for analysis to complete

3. **View results:**
   - Results panel opens automatically
   - See extracted tools and generated code
   - Copy configuration for your AI assistant

4. **Configure Claude Desktop:**
   - Run "GitHub to MCP: Configure Claude Desktop"
   - Select servers to add
   - Restart Claude Desktop

### Example Workflow

```
1. Find an interesting GitHub repo (e.g., an API client library)
2. Copy the URL: https://github.com/openai/openai-node
3. In VS Code, press Ctrl+Shift+M
4. Paste the URL and press Enter
5. View the extracted tools in the results panel
6. Click "Configure Claude Desktop" to add to your config
7. Restart Claude Desktop
8. Start using the new tools in Claude!
```

### Working with Generated Servers

The extension generates MCP server code that you can:
- **Export** to a directory for customization
- **Copy** the configuration snippet
- **Run** directly with Node.js or Python

Generated files include:
- `index.js` - Main server file
- `package.json` - Dependencies
- `README.md` - Documentation

## API Reference

The extension uses the `@nirholas/github-to-mcp` core library which:
- Analyzes GitHub repositories
- Extracts OpenAPI/Swagger specs
- Parses README documentation
- Identifies code patterns
- Generates MCP-compatible tool definitions

## Troubleshooting

### GitHub API Rate Limiting
If you see rate limit errors:
1. Go to Settings > GitHub to MCP
2. Add your GitHub Personal Access Token
3. This increases your rate limit from 60 to 5000 requests/hour

### Claude Desktop Not Detecting Servers
1. Ensure the config file path is correct for your OS
2. Check that the server file path in config is absolute
3. Restart Claude Desktop after config changes
4. Check the MCP server logs for errors

### Extension Not Activating
1. Ensure you have VS Code 1.85.0 or higher
2. Check the Output panel for error messages
3. Try reloading the window (`Ctrl+Shift+P` > "Reload Window")

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18 or higher (for running generated servers)

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [GitHub Repository](https://github.com/nirholas/github-to-mcp)
- [Issue Tracker](https://github.com/nirholas/github-to-mcp/issues)
- [Documentation](https://github-to-mcp.dev/docs)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

# Lyra Intel VS Code Extension

AI-powered code analysis directly in VS Code.

## Features

- **Real-time Code Analysis** - Analyze files as you type
- **Security Scanning** - Detect vulnerabilities instantly
- **Code Quality Insights** - Get complexity metrics and suggestions
- **Inline Hints** - See suggestions right in your code
- **Workspace Analysis** - Analyze entire projects

## Installation

1. Install from VS Code Marketplace (coming soon)
2. Or build from source:
   ```bash
   cd extensions/vscode
   npm install
   npm run compile
   vsce package
   code --install-extension lyra-intel-vscode-1.0.0.vsix
   ```

## Configuration

Configure Lyra Intel in VS Code settings:

```json
{
  "lyraIntel.serverUrl": "http://localhost:8080",
  "lyraIntel.apiKey": "your-api-key",
  "lyraIntel.autoAnalyze": false,
  "lyraIntel.showInlineHints": true,
  "lyraIntel.securityScanOnSave": true
}
```

## Usage

### Commands

- `Lyra Intel: Analyze Workspace` - Analyze entire workspace
- `Lyra Intel: Analyze Current File` - Analyze active file
- `Lyra Intel: Security Scan` - Run security scan
- `Lyra Intel: Show Code Insights` - Show insights panel

### Shortcuts

- `Ctrl+Shift+A` (Windows/Linux) or `Cmd+Shift+A` (Mac) - Analyze current file
- `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac) - Security scan

## Requirements

- VS Code 1.85.0 or higher
- Lyra Intel server running (local or remote)

## Development

```bash
npm install
npm run compile
npm run watch  # Watch mode for development
```

## License

MIT License

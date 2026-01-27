# Quick Start: Lyra Intel MCP Server

Get the MCP server running in 5 minutes.

## 1. Install Dependencies

```bash
cd /workspaces/lyra-intel/mcp-server
npm install
```

Expected output: `added 90 packages...` ✅

## 2. Build

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## 3. Start Server

```bash
npm start
```

Expected output:
```
Lyra Intel MCP server is running...
```

## 4. Test the Server (In Another Terminal)

```bash
# List available tools
curl http://localhost:3000/tools

# Run an analysis
curl -X POST http://localhost:3000/tool/analyze-codebase \
  -H "Content-Type: application/json" \
  -d '{"path": "/workspaces/lyra-intel", "depth": "quick"}'
```

## Integration with Claude

### Option A: Claude Desktop (Recommended)

1. Copy the full path to the MCP server:
```bash
echo "$(pwd)/dist/index.js"
```

2. Edit Claude's config file:

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Linux:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

3. Add this configuration:
```json
{
  "mcpServers": {
    "lyra-intel": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

4. Restart Claude

### Option B: Command Line

```bash
# Connect to server via stdin/stdout
npm start
```

Then interact with server by sending JSON-RPC messages via stdin.

## Available Tools

Once connected, you can use these tools:

### 1. Analyze Codebase
```
Tool: analyze-codebase
Input:
- path: string (required) - Path to analyze
- depth: "quick" | "standard" | "deep" (default: "standard")
- focusAreas: string[] (optional) - "security", "complexity", "dependencies", etc.

Example: "Analyze the security of /workspaces/lyra-intel at deep depth"
```

### 2. Search Code
```
Tool: search-code
Input:
- query: string (required) - What to search for
- filePattern: string (optional) - Glob pattern (e.g., "*.ts")
- limit: number (default: 10) - Max results

Example: "Search for database queries in TypeScript files"
```

### 3. Get Complexity
```
Tool: get-complexity
Input:
- path: string (required) - File or directory
- threshold: number (optional) - Only report above this complexity

Example: "Find all functions with complexity > 15 in src/"
```

### 4. Get Security Issues
```
Tool: get-security-issues
Input:
- path: string (required) - Path to scan
- severity: "critical" | "high" | "medium" | "low" (optional)

Example: "Show all critical security issues in the API code"
```

## Natural Language Examples

Once integrated with Claude, try:

```
"Analyze /workspaces/lyra-intel for security issues"

"Find all functions with high complexity in the api directory"

"Search for database queries throughout the codebase"

"What are the critical security vulnerabilities in src/api?"

"Show me the most complex functions in the project"
```

## Troubleshooting

### "npm: command not found"
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### "port already in use"
```bash
# Kill the process on port 3000
lsof -i :3000
kill -9 <PID>
```

### "Module not found"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "TypeScript compilation error"
```bash
# Check TypeScript version
npx tsc --version

# Rebuild from scratch
rm -rf dist
npm run build
```

### Claude doesn't see the tools
1. Restart Claude completely
2. Check config file path (use `echo ~` to verify home directory)
3. Verify JSON syntax (use https://jsonlint.com/)
4. Check server logs for startup errors: `npm start 2>&1`

## Next Steps

1. **Connect to Backend API**
   - See `mcp-server/API_INTEGRATION.md` for detailed guide
   - Configure environment variables in `.env.local`
   - Update tool implementations to call real API

2. **Add More Tools**
   - Create new tool in `src/tools/analysis.ts`
   - Add Zod schema for validation
   - Register in tool registry
   - Automatically exposed via MCP

3. **Use Workflows**
   - See `.lyra-intel/workflows/` for example workflows
   - Use as templates for your team's analysis procedures

4. **Deploy**
   - Build Docker image for containerized deployment
   - Set up GitHub Actions for CI/CD
   - Publish to npm registry for easy installation

## Development Mode

For active development with auto-rebuild:

```bash
npm run dev
```

This watches for changes and rebuilds TypeScript automatically.

## Architecture

```
Your LLM (Claude)
    ↓
MCP Protocol (STDIO transport)
    ↓
Lyra Intel MCP Server (Node.js)
    ├─ Tool Registry (validates arguments)
    └─ Analysis Tools
       ├─ analyze-codebase
       ├─ search-code
       ├─ get-complexity
       └─ get-security-issues
    ↓
Lyra Intel REST API (when configured)
    ↓
Analysis Engine & Results
```

## Performance Tips

1. **Use quick depth for large codebases**
   - `depth: "quick"` for initial analysis
   - `depth: "standard"` for normal use
   - `depth: "deep"` only when needed (slower)

2. **Filter by file pattern**
   - Use `filePattern` to reduce scope
   - Example: `"src/**/*.ts"` to analyze only TypeScript

3. **Set complexity threshold**
   - Only report violations above threshold
   - Reduces noise from large codebases

4. **Enable caching** (once API integrated)
   - Set `LYRA_ENABLE_CACHING=true`
   - Speeds up repeated queries

## Support

- **Installation issues?** → See mcp-server/README.md
- **API integration?** → See mcp-server/API_INTEGRATION.md
- **Project workflows?** → See .lyra-intel/workflows/
- **Team policies?** → See .lyra-intel/instructions.md

## Summary

You now have:
- ✅ MCP server running locally
- ✅ 4 powerful analysis tools available
- ✅ Ready to integrate with Claude
- ✅ Project-wide analysis guidelines
- ✅ Reusable workflows for common tasks

Start by running `npm start` and then configure Claude to connect!

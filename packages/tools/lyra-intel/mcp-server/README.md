# Lyra Intel MCP Server

The Lyra Intel MCP (Model Context Protocol) server enables large language models like Claude to interact with Lyra Intel analysis capabilities directly.

## Features

- **🔍 Codebase Analysis** - Run comprehensive analysis including AST parsing, dependency mapping, and complexity metrics
- **🔎 Semantic Search** - ML-powered code search to find relevant implementations
- **📊 Complexity Metrics** - Get cyclomatic, cognitive, and Halstead complexity scores
- **🛡️ Security Scanning** - Detect vulnerabilities, secrets, and compliance issues
- **🔬 Auto-Discovery** - Scan GitHub for new MCP crypto tools and submit to registry
- **⏳ Streaming Progress** - Long-running operations stream progress updates to Claude

## Installation

### Quick Start with Claude Code

```bash
# Install globally for one-line setup
npm install -g lyra-intel-mcp

# Add to Claude Code
claude mcp add lyra-intel -- lyra-intel-mcp
```

### Claude Desktop

Add to your Claude Desktop config file:

**macOS/Linux**: `~/.config/claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lyra-intel": {
      "command": "npx",
      "args": ["-y", "lyra-intel-mcp"]
    }
  }
}
```

Then restart Claude Desktop completely.

### Local Development

```bash
cd mcp-server
npm install
npm run build
npm start
```

## Usage with Claude

### Natural Language

```
"Analyze my project at /path/to/project for security issues"
"Search for authentication patterns in the codebase"
"Check complexity of the auth module"
"Scan GitHub for new MCP crypto tools from the last 7 days"
"Analyze the repo at github.com/owner/project for MCP tools"
```

## Tools Available

### Analysis Tools

#### analyze-codebase
Comprehensive codebase analysis with AST parsing, dependency graphs, and metrics.

```
Analyze /path/to/project at deep level focusing on security and complexity
```

#### search-code
Semantic search using ML embeddings.

```
Search for "database connection handling" in src/
```

#### get-complexity
Get complexity metrics for code.

```
Show complexity metrics for src/auth/
```

#### get-security-issues
Scan for security vulnerabilities.

```
Find security issues in critical severity or higher
```

### Enhanced Tools

#### diff-analyze
Analyze git diffs between commits/branches to understand changes, impact, and risk.

```
Analyze the diff between main and feature-branch in my project
Show me what changed in the last commit and its risk level
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | required | Path to the git repository |
| `sourceRef` | string | HEAD~1 | Source git reference (commit, branch, tag) |
| `targetRef` | string | HEAD | Target git reference (commit, branch, tag) |
| `includeImpact` | boolean | true | Include impact analysis (affected tests, risk score) |
| `maxDepth` | number | 3 | Maximum depth for impact propagation analysis |
| `focusFiles` | string[] | - | Specific files/patterns to focus on |

**Returns:**
- Files changed with additions/deletions
- Semantic changes (functions, classes added/removed)
- Risk score and risk level (low/medium/high/critical)
- Impacted areas (Security, API, Data Layer, etc.)
- Actionable recommendations

#### generate-docs
Auto-generate documentation from code analysis.

```
Generate API documentation for my project in markdown format
Create a README for /path/to/codebase
Generate architecture docs for my Python project
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | required | Path to the codebase to document |
| `outputFormat` | enum | markdown | Output format: markdown, html, json |
| `docType` | enum | api | Type: api, readme, architecture, all |
| `includeExamples` | boolean | true | Include code examples |
| `includeToc` | boolean | true | Include table of contents |
| `projectName` | string | - | Project name for header |

**Returns:**
- Generated documentation in requested format
- Sections breakdown
- Statistics (files scanned, word count)

#### forensic-scan
Deep analysis to find dead code, tech debt, and orphaned documentation.

```
Scan my project for dead code and unused functions
Find technical debt in the codebase
Run a full forensic analysis with git history
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | required | Path to the repository |
| `scanType` | enum | full | Type: dead-code, tech-debt, orphans, full |
| `includeGitHistory` | boolean | true | Include git history analysis |
| `minConfidence` | number | 0.7 | Minimum confidence threshold (0.0-1.0) |
| `excludePatterns` | string[] | - | Patterns to exclude from scan |
| `maxFileSize` | number | 10 | Maximum file size in MB |

**Returns:**
- Dead code items with confidence scores
- Technical debt (TODOs, FIXMEs, large files, deep nesting)
- Orphaned documentation
- Git stale file analysis
- Overall health score (0-100)
- Prioritized recommendations

### Discovery Tools

#### discovery-scan-github
Scan GitHub for new MCP crypto tool repositories.

```
Scan GitHub for MCP crypto repositories from the last 7 days with minimum 5 stars
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `daysBack` | number | 7 | How many days back to search |
| `minStars` | number | 0 | Minimum stars required |
| `queries` | string[] | - | Custom search queries |
| `maxResults` | number | 50 | Maximum repos to return |

#### discovery-analyze-repo
Analyze a GitHub repository to extract MCP tool definitions.

```
Analyze https://github.com/owner/mcp-crypto-tools for MCP tools
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `repoUrl` | string | required | GitHub repository URL |
| `checkSecurity` | boolean | true | Run security analysis |

#### discovery-submit-tool
Submit validated tools to the Lyra Registry.

```
Submit tools from github.com/owner/repo to the registry (dry run)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `repoUrl` | string | required | GitHub repository URL |
| `dryRun` | boolean | true | Simulate without submitting |
| `minQualityScore` | number | 50 | Minimum quality threshold |
| `minSecurityScore` | number | 70 | Minimum security threshold |

#### discovery-run-pipeline
Run the complete discovery pipeline.

```
Run the full discovery pipeline for the last 3 days and submit approved tools
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `daysBack` | number | 7 | Days to search back |
| `submit` | boolean | false | Submit to registry |
| `dryRun` | boolean | true | Simulate submission |
| `maxRepos` | number | 20 | Max repos to process |

#### discovery-get-stats
Get discovery module statistics.

```
Show discovery statistics and recent runs
```

## Integration with API

The MCP server currently streams output and basic information. For full integration with the Lyra Intel REST API:

1. Set your Lyra Intel API endpoint:
```bash
export LYRA_INTEL_API_URL=http://localhost:8000
export LYRA_INTEL_API_KEY=your_api_key
```

2. Tools will automatically forward requests to the backend API

## Architecture

```
Claude/LLM Client
        ↓
    MCP Protocol
        ↓
Lyra Intel MCP Server
        ↓
Lyra Intel REST API
        ↓
Analysis Engine (Python)
```

## Troubleshooting

### "MCP server not responding"

1. Verify Node.js 16+ is installed: `node --version`
2. Check configuration file syntax (valid JSON)
3. Restart your MCP client completely
4. Enable debug logging:
   ```bash
   DEBUG=lyra-intel-mcp npm start
   ```

### Large codebase timeouts

The MCP server streams progress to prevent timeouts. If you still experience timeouts:

1. Start with "quick" analysis depth
2. Use file pattern filters to narrow scope
3. Increase MCP client timeout (check client docs)

### No results returned

Ensure:
1. Lyra Intel API is running and accessible
2. API credentials are set correctly
3. The provided path exists and is readable

## Development

### Adding New Tools

1. Create tool schema and implementation in `src/tools/analysis.ts`:

```typescript
export const myNewTool: UnifiedTool = {
  name: "tool-name",
  description: "What it does",
  zodSchema: z.object({
    param: z.string().describe("Parameter description"),
  }),
  category: 'category',
  execute: async (args, onProgress) => {
    onProgress?.("Starting...");
    return "Result";
  }
};
```

2. Add to `toolRegistry` in `src/tools/registry.ts`

3. Rebuild and restart

### Testing

```bash
npm run test
```

## Documentation

For more information about Model Context Protocol, see:
- [MCP Documentation](https://modelcontextprotocol.io/)
- [Lyra Intel API Docs](/docs/API.md)
- [Lyra Intel Architecture](/docs/ARCHITECTURE.md)

## License

MIT - See [LICENSE](../LICENSE) for details.

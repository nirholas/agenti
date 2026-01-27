# Discovery Sources

Lyra Tool Discovery searches multiple sources to find MCP servers and tools. Currently supported sources are GitHub and npm, with more planned.

## Supported Sources

| Source | Status | Description |
|--------|--------|-------------|
| `github` | ✅ Stable | GitHub repository search |
| `npm` | ✅ Stable | npm registry search |
| `smithery` | 🔜 Planned | Smithery MCP registry |
| `mcp-directory` | 🔜 Planned | Official MCP directory |
| `openapi-directory` | 🔜 Planned | OpenAPI spec collection |

## GitHub Source

Searches GitHub repositories using the GitHub Search API.

### Default Search Queries

```typescript
const queries = [
  'mcp server in:name,description,readme',
  'modelcontextprotocol in:name,description',
  '@modelcontextprotocol in:readme',
  'mcp-server in:name'
];
```

### Configuration

```bash
# Increase rate limit with GitHub token
export GITHUB_TOKEN="ghp_..."
```

### Usage

```bash
# Search GitHub only
lyra-discover discover --sources github --limit 10
```

### What It Fetches

For each repository, the GitHub source:

1. **Basic Info** - Name, description, stars, license, owner
2. **README.md** - Full content for AI analysis
3. **package.json** - Dependencies, bin entries, scripts
4. **Topics** - GitHub repository topics

### MCP Detection

A repository is marked as MCP-compatible if:

```typescript
hasMCPSupport: 
  item.topics.includes('mcp') || 
  item.name.includes('mcp') ||
  item.description?.toLowerCase().includes('mcp')
```

### Rate Limits

| Auth | Rate Limit | Reset |
|------|------------|-------|
| No token | 10 requests/min | Per minute |
| With token | 30 requests/min | Per minute |
| With token | 5000 requests/hr | Per hour |

::: warning
Without a `GITHUB_TOKEN`, you'll quickly hit rate limits. Always set a token for production use.
:::

### Custom Queries

Configure custom search queries in `discovery.config.json`:

```json
{
  "github": {
    "queries": [
      "langchain mcp in:name,readme",
      "anthropic tools in:name,description",
      "ai agent server in:topics"
    ],
    "sort": "stars",
    "order": "desc"
  }
}
```

## npm Source

Searches the npm registry for MCP-related packages.

### Default Search Queries

```typescript
const queries = [
  'mcp server',
  '@modelcontextprotocol',
  'mcp-server'
];
```

### Usage

```bash
# Search npm only
lyra-discover discover --sources npm --limit 10
```

### What It Fetches

For each package:

1. **Package Info** - Name, version, description, keywords
2. **README** - From npm registry
3. **Full package.json** - Dependencies, bin, scripts
4. **Links** - Homepage, repository, npm page

### MCP Detection

A package is marked as MCP-compatible if:

```typescript
hasMCPSupport: 
  pkg.keywords?.includes('mcp') || 
  pkg.name.includes('mcp') ||
  pkg.description?.toLowerCase().includes('mcp') ||
  pkg.dependencies?.['@modelcontextprotocol/sdk']
```

### STDIO Config Generation

If a package has a `bin` entry, Lyra automatically generates an MCP STDIO config:

```typescript
if (fullPkg.bin) {
  tool.mcpConfig = {
    type: 'stdio',
    command: 'npx',
    args: ['-y', fullPkg.name],
    env: {}
  };
}
```

### Custom Queries

```json
{
  "npm": {
    "queries": [
      "@langchain",
      "mcp-tool",
      "model-context"
    ]
  }
}
```

## Using Multiple Sources

By default, Lyra searches all available sources:

```bash
# Default: searches github and npm
lyra-discover discover --limit 10

# Explicit multiple sources
lyra-discover discover --sources github,npm --limit 10
```

Results are deduplicated by ID:

```typescript
const seen = new Set<string>();
for (const tool of results) {
  if (!seen.has(tool.id)) {
    seen.add(tool.id);
    tools.push(tool);
  }
}
```

## Search Query Optimization

### GitHub Query Syntax

| Operator | Example | Description |
|----------|---------|-------------|
| `in:name` | `mcp in:name` | Search in repo name |
| `in:description` | `server in:description` | Search in description |
| `in:readme` | `@anthropic in:readme` | Search in README |
| `in:topics` | `mcp in:topics` | Search in topics |
| `stars:>N` | `stars:>100` | Minimum stars |
| `language:` | `language:typescript` | Language filter |

Example queries:
```
mcp server in:name,readme stars:>50 language:typescript
@modelcontextprotocol in:readme language:javascript
```

### npm Query Tips

- Use scoped packages: `@modelcontextprotocol`
- Combine terms: `mcp server typescript`
- Use exact names: `mcp-server-filesystem`

## Filtering Results

### By MCP Support

```bash
# Only show MCP-compatible tools (default for analysis)
lyra-discover discover --sources github,npm
```

The discovery filters to MCP-compatible tools before AI analysis:

```typescript
const mcpTools = tools.filter(t => t.hasMCPSupport);
```

### By Stars (Coming Soon)

```json
{
  "discovery": {
    "filters": {
      "minStars": 50
    }
  }
}
```

## Future Sources

### Smithery

The [Smithery MCP Registry](https://smithery.com) will be supported:

```bash
lyra-discover discover --sources smithery
```

### MCP Directory

The official MCP directory at `modelcontextprotocol.io`:

```bash
lyra-discover discover --sources mcp-directory
```

### OpenAPI Directory

Discover APIs with OpenAPI specifications:

```bash
lyra-discover discover --sources openapi-directory
```

## Source Interface

All sources implement this interface:

```typescript
interface DiscoverySource {
  searchMCPServers(limit: number): Promise<DiscoveredTool[]>;
}
```

See [Custom Sources](/guide/custom-sources) to implement your own.

## Next Steps

- [Custom Sources](/guide/custom-sources) - Create your own source
- [Configuration](/guide/configuration) - Full config reference
- [CLI Reference](/cli/commands) - Command documentation

# How It Works

A deep dive into the GitHub to MCP conversion process.

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input (GitHub URL)                   │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. FETCH       │  Download repo metadata, README, file tree    │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. CLASSIFY    │  Determine repo type (API, CLI, Library...)   │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. EXTRACT     │  Find tools from OpenAPI, GraphQL, code, etc. │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. GENERATE    │  Create MCP server code and tool impls        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. PACKAGE     │  Bundle with dependencies and config          │
└─────────────────────────────────────────────────────────────────┘
```

## Step 1: Fetch Repository

The process starts by fetching information from GitHub:

```typescript
// Pseudocode
const repoInfo = await githubClient.getRepository(url);
const readme = await githubClient.getReadme(url);
const fileTree = await githubClient.getFileTree(url, { depth: 3 });
```

### What's Fetched

| Data | Purpose |
|------|---------|
| Repository metadata | Name, description, stars, language |
| README content | Context for classification |
| File tree | Find specs, source files |
| Package files | package.json, pyproject.toml |
| Spec files | openapi.json, schema.graphql |

### Rate Limiting

GitHub API limits are handled automatically:

- **Anonymous**: 60 requests/hour (very limited)
- **Authenticated**: 5,000 requests/hour (recommended)

## Step 2: Classify Repository

The repo is analyzed to determine its type:

```typescript
function classifyRepository(repoInfo): RepositoryType {
  // Check for MCP server indicators
  if (hasMcpDependency(repoInfo) || hasMcpServerFile(repoInfo)) {
    return 'mcp-server';
  }
  
  // Check for API patterns
  if (hasOpenApiSpec(repoInfo) || hasGraphqlSchema(repoInfo)) {
    return 'api-sdk';
  }
  
  // Check for CLI patterns
  if (hasCliPackage(repoInfo) || hasBinEntry(repoInfo)) {
    return 'cli-tool';
  }
  
  // ... more checks
}
```

### Classification Types

| Type | Indicators | Tool Extraction |
|------|------------|-----------------|
| `mcp-server` | `@modelcontextprotocol/sdk` dependency | Parse existing tools |
| `api-sdk` | OpenAPI spec, REST client patterns | Extract API endpoints |
| `cli-tool` | `bin` in package.json, argparse | Extract CLI commands |
| `library` | Generic npm/pip package | Universal tools only |
| `documentation` | Mostly markdown files | Universal tools only |

## Step 3: Extract Tools

Tools are extracted from multiple sources:

### Universal Tools

Always included (unless disabled):

```typescript
const universalTools = [
  { name: 'get_readme', source: 'universal' },
  { name: 'list_files', source: 'universal' },
  { name: 'read_file', source: 'universal' },
  { name: 'search_code', source: 'universal' },
];
```

### OpenAPI Extraction

```typescript
// Find and parse OpenAPI specs
const specs = findOpenApiSpecs(fileTree);

for (const spec of specs) {
  const parsed = await parseOpenApi(spec.content);
  
  for (const path of Object.keys(parsed.paths)) {
    for (const method of ['get', 'post', 'put', 'delete']) {
      const operation = parsed.paths[path][method];
      if (operation) {
        tools.push(createToolFromOperation(operation, path, method));
      }
    }
  }
}
```

### GraphQL Extraction

```typescript
// Parse GraphQL schema
const schema = parseGraphqlSchema(schemaContent);

// Extract queries as tools
for (const query of schema.queries) {
  tools.push({
    name: query.name,
    description: query.description,
    inputSchema: convertGraphqlArgsToJsonSchema(query.args),
    source: 'graphql',
  });
}

// Extract mutations as tools
for (const mutation of schema.mutations) {
  tools.push({
    name: mutation.name,
    // ...
  });
}
```

### Code Analysis

For MCP servers and Python packages:

```typescript
// Find @mcp.tool decorators
const mcpTools = findMcpDecorators(sourceFiles);

// Find FastAPI/Flask routes
const apiRoutes = findApiRoutes(sourceFiles);

// Find CLI commands
const cliCommands = findCliCommands(sourceFiles);
```

## Step 4: Generate Code

The extracted tools are converted to working MCP server code:

### Server Template

```typescript
const serverCode = `
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: '${repoName}-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Register tools
${tools.map(tool => generateToolRegistration(tool)).join('\n')}

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
`;
```

### Tool Implementation

Each tool gets an implementation:

```typescript
function generateToolImplementation(tool: Tool): string {
  if (tool.source === 'universal') {
    return universalImplementations[tool.name];
  }
  
  if (tool.source === 'openapi') {
    return `
async function ${tool.name}(params) {
  const response = await fetch('${tool.endpoint}', {
    method: '${tool.method}',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return response.json();
}`;
  }
  
  // ... other sources
}
```

## Step 5: Package Output

Finally, everything is bundled:

### Output Structure

```
output/
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── server.ts             # Main server (source)
├── server.mjs            # Compiled server
├── tools/
│   ├── index.ts
│   ├── universal/
│   │   ├── read_file.ts
│   │   └── ...
│   └── extracted/
│       ├── create_customer.ts
│       └── ...
└── README.md             # Usage instructions
```

### Generated package.json

```json
{
  "name": "repo-name-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "server.mjs",
  "scripts": {
    "start": "node server.mjs",
    "build": "tsc"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

---

## Performance Considerations

### Caching

- Repository metadata is cached for 5 minutes
- File contents are cached per session
- OpenAPI parsing results are memoized

### Parallel Processing

- Multiple files are fetched in parallel
- Tool extraction runs concurrently
- Limited by GitHub API rate limits

### Size Limits

| Limit | Default | Purpose |
|-------|---------|---------|
| Max depth | 3 | Prevent scanning huge repos |
| Max file size | 100KB | Skip large binary files |
| Max files | 1000 | Reasonable processing time |

---

## See Also

- [Tool Types](tool-types.md) - Understanding extracted tools
- [Classification](classification.md) - Repository classification
- [Architecture](../contributing/architecture.md) - Code architecture

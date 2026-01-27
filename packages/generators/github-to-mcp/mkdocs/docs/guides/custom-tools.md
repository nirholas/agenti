# Custom Tools

Extend and customize the generated MCP tools to fit your needs.

## Understanding Generated Tools

Each generated MCP server includes tool implementations that you can modify:

```
my-mcp-server/
├── server.mjs        # Main server (registers tools)
├── tools/
│   ├── index.mjs     # Tool exports
│   ├── read_file.mjs
│   ├── list_files.mjs
│   ├── search_code.mjs
│   └── get_readme.mjs
└── package.json
```

## Modifying Existing Tools

### Example: Add Caching to read_file

Edit `tools/read_file.mjs`:

```javascript
import { LRUCache } from 'lru-cache';

// Add a cache
const cache = new LRUCache({ max: 100, ttl: 1000 * 60 * 5 });

export const readFileTool = {
  name: 'read_file',
  description: 'Read the contents of a file from the repository',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read'
      }
    },
    required: ['path']
  },
  async execute({ path }) {
    // Check cache first
    const cached = cache.get(path);
    if (cached) {
      return { content: cached, cached: true };
    }
    
    // Fetch if not cached
    const content = await fetchFileFromGithub(path);
    cache.set(path, content);
    
    return { content, cached: false };
  }
};
```

### Example: Add Filtering to list_files

```javascript
export const listFilesTool = {
  name: 'list_files',
  description: 'List files in a directory with optional filtering',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path'
      },
      pattern: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts")'
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth to traverse'
      }
    },
    required: ['path']
  },
  async execute({ path, pattern, maxDepth = 3 }) {
    let files = await fetchDirectoryListing(path, maxDepth);
    
    if (pattern) {
      const minimatch = await import('minimatch');
      files = files.filter(f => minimatch.default(f.name, pattern));
    }
    
    return { files };
  }
};
```

## Adding New Tools

### Step 1: Create the Tool File

Create `tools/my_custom_tool.mjs`:

```javascript
export const myCustomTool = {
  name: 'analyze_dependencies',
  description: 'Analyze package.json dependencies and find outdated packages',
  inputSchema: {
    type: 'object',
    properties: {
      checkUpdates: {
        type: 'boolean',
        description: 'Check npm for newer versions'
      }
    }
  },
  async execute({ checkUpdates = false }) {
    // Read package.json
    const packageJson = await this.tools.read_file.execute({ 
      path: 'package.json' 
    });
    
    const pkg = JSON.parse(packageJson.content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const result = {
      total: Object.keys(deps).length,
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies
    };
    
    if (checkUpdates) {
      // Check for updates (simplified example)
      result.outdated = await checkForUpdates(deps);
    }
    
    return result;
  }
};
```

### Step 2: Register the Tool

Edit `tools/index.mjs`:

```javascript
export { readFileTool } from './read_file.mjs';
export { listFilesTool } from './list_files.mjs';
export { searchCodeTool } from './search_code.mjs';
export { getReadmeTool } from './get_readme.mjs';
// Add your custom tool
export { myCustomTool } from './my_custom_tool.mjs';
```

### Step 3: Add to Server

Edit `server.mjs`:

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import * as tools from './tools/index.mjs';

const server = new Server({
  name: 'my-repo-mcp',
  version: '1.0.0'
});

// Register all tools
Object.values(tools).forEach(tool => {
  server.setRequestHandler('tools/call', tool.name, tool.execute);
});
```

## Tool Patterns

### Composite Tools

Create tools that combine multiple operations:

```javascript
export const explainCodeTool = {
  name: 'explain_code',
  description: 'Read a file and provide structured information about it',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' }
    },
    required: ['path']
  },
  async execute({ path }, { tools }) {
    // Use other tools
    const content = await tools.read_file.execute({ path });
    const related = await tools.search_code.execute({ 
      query: path.split('/').pop().replace('.', '') 
    });
    
    return {
      content: content.content,
      relatedFiles: related.results.slice(0, 5),
      lineCount: content.content.split('\n').length,
      language: detectLanguage(path)
    };
  }
};
```

### Tools with Side Effects

For tools that modify state (use cautiously):

```javascript
export const createIssueTool = {
  name: 'create_issue',
  description: 'Create a GitHub issue (requires write access)',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      labels: { type: 'array', items: { type: 'string' } }
    },
    required: ['title', 'body']
  },
  async execute({ title, body, labels = [] }, { config }) {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, body, labels })
      }
    );
    
    return await response.json();
  }
};
```

### Paginated Tools

Handle large result sets:

```javascript
export const searchCodeTool = {
  name: 'search_code',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      page: { type: 'number', default: 1 },
      perPage: { type: 'number', default: 30 }
    },
    required: ['query']
  },
  async execute({ query, page = 1, perPage = 30 }) {
    const results = await searchGithubCode(query, page, perPage);
    
    return {
      results: results.items,
      total: results.total_count,
      page,
      perPage,
      hasMore: results.total_count > page * perPage
    };
  }
};
```

## TypeScript Tools

For TypeScript servers, use proper types:

```typescript
import { Tool, ToolResult } from '@modelcontextprotocol/sdk';

interface ReadFileInput {
  path: string;
}

interface ReadFileOutput {
  content: string;
  encoding: string;
}

export const readFileTool: Tool<ReadFileInput, ReadFileOutput> = {
  name: 'read_file',
  description: 'Read file contents',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' }
    },
    required: ['path']
  },
  async execute(input: ReadFileInput): Promise<ToolResult<ReadFileOutput>> {
    const content = await fetchFile(input.path);
    return {
      content,
      encoding: 'utf-8'
    };
  }
};
```

## Testing Custom Tools

### Unit Testing

```javascript
import { describe, it, expect } from 'vitest';
import { myCustomTool } from './my_custom_tool.mjs';

describe('myCustomTool', () => {
  it('should analyze dependencies', async () => {
    const mockTools = {
      read_file: {
        execute: async () => ({
          content: JSON.stringify({
            dependencies: { 'lodash': '^4.0.0' }
          })
        })
      }
    };
    
    const result = await myCustomTool.execute(
      { checkUpdates: false },
      { tools: mockTools }
    );
    
    expect(result.total).toBe(1);
    expect(result.dependencies.lodash).toBe('^4.0.0');
  });
});
```

### Integration Testing

```bash
# Start the server
node server.mjs &

# Test with MCP inspector
mcp-inspector ws://localhost:3000 --call analyze_dependencies
```

---

## Best Practices

1. **Keep tools focused** - One tool, one purpose
2. **Validate inputs** - Check required fields and types
3. **Handle errors gracefully** - Return meaningful error messages
4. **Document well** - Clear descriptions help AI use tools correctly
5. **Test thoroughly** - Both unit and integration tests

---

## Next Steps

- [Batch Conversion](batch.md) - Convert multiple repos
- [API Reference](../api/index.md) - Full programmatic API
- [Architecture](../contributing/architecture.md) - How it all works

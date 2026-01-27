# API Reference

Programmatic API for GitHub to MCP.

## Installation

```bash
npm install @nirholas/github-to-mcp
```

## Packages

| Package | Description |
|---------|-------------|
| [`@nirholas/github-to-mcp`](core.md) | Core conversion library |
| [`@github-to-mcp/openapi-parser`](openapi-parser.md) | OpenAPI/GraphQL parser |
| [`@github-to-mcp/mcp-server`](mcp-server.md) | MCP server implementation |

## Quick Start

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';

// Generate from a GitHub URL
const result = await generateFromGithub('https://github.com/stripe/stripe-node');

// Access generated tools
console.log(`Generated ${result.tools.length} tools`);
result.tools.forEach(tool => {
  console.log(`- ${tool.name}: ${tool.description}`);
});

// Save to disk
await result.save('./my-mcp-server');

// Or get the code directly
const code = result.toTypeScript();
```

## Core Functions

### generateFromGithub

Main function to generate MCP server from a repository.

```typescript
import { generateFromGithub, type GeneratorOptions } from '@nirholas/github-to-mcp';

const options: GeneratorOptions = {
  token: process.env.GITHUB_TOKEN,
  language: 'typescript',
  includeUniversalTools: true,
};

const result = await generateFromGithub(
  'https://github.com/owner/repo',
  options
);
```

### parseRepository

Parse a repository without generating code.

```typescript
import { parseRepository } from '@nirholas/github-to-mcp';

const info = await parseRepository('https://github.com/owner/repo');
console.log(info.type);        // 'api-sdk' | 'mcp-server' | etc.
console.log(info.tools);       // Extracted tool definitions
console.log(info.metadata);    // Repo metadata
```

### createMcpServer

Create an MCP server instance from tools.

```typescript
import { createMcpServer } from '@nirholas/github-to-mcp';

const server = createMcpServer({
  name: 'my-server',
  tools: [...],
  transport: 'stdio',  // or 'http'
});

await server.start();
```

## Type Definitions

```typescript
interface GeneratorOptions {
  token?: string;
  language?: 'typescript' | 'python';
  includeTools?: string[];
  excludeTools?: string[];
  includeUniversalTools?: boolean;
  extractFromOpenAPI?: boolean;
  extractFromGraphQL?: boolean;
  extractFromCode?: boolean;
  extractFromReadme?: boolean;
  maxDepth?: number;
  maxFileSize?: number;
  timeout?: number;
}

interface GeneratorResult {
  tools: Tool[];
  metadata: RepositoryMetadata;
  save(path: string): Promise<void>;
  toTypeScript(): string;
  toPython(): string;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  source: 'universal' | 'openapi' | 'graphql' | 'code' | 'readme';
}
```

## See Also

- [Core API](core.md) - Full core library reference
- [OpenAPI Parser](openapi-parser.md) - Parser module
- [Configuration](../getting-started/configuration.md) - Options reference

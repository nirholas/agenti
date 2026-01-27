# Core API

The `@nirholas/github-to-mcp` package provides the core conversion functionality.

## Installation

```bash
npm install @nirholas/github-to-mcp
```

## Functions

### generateFromGithub

Generate an MCP server from a GitHub repository URL.

```typescript
function generateFromGithub(
  url: string,
  options?: GeneratorOptions
): Promise<GeneratorResult>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | GitHub repository URL |
| `options` | `GeneratorOptions` | Optional configuration |

#### Returns

`Promise<GeneratorResult>` - The generation result with tools and save methods.

#### Example

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';

const result = await generateFromGithub(
  'https://github.com/stripe/stripe-node',
  {
    token: process.env.GITHUB_TOKEN,
    language: 'typescript',
    includeUniversalTools: true,
  }
);

console.log(`Generated ${result.tools.length} tools`);
await result.save('./stripe-mcp');
```

---

### parseRepository

Parse a repository and extract tool information without generating code.

```typescript
function parseRepository(
  url: string,
  options?: ParseOptions
): Promise<RepositoryInfo>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | GitHub repository URL |
| `options` | `ParseOptions` | Optional configuration |

#### Returns

`Promise<RepositoryInfo>` - Parsed repository information.

#### Example

```typescript
import { parseRepository } from '@nirholas/github-to-mcp';

const info = await parseRepository('https://github.com/openai/openai-node');

console.log(`Type: ${info.type}`);           // 'api-sdk'
console.log(`Language: ${info.language}`);   // 'TypeScript'
console.log(`Tools found: ${info.tools.length}`);
```

---

### classifyRepository

Classify a repository by analyzing its contents.

```typescript
function classifyRepository(
  repoInfo: RepositoryInfo
): RepositoryType
```

#### Returns

One of: `'mcp-server'` | `'api-sdk'` | `'cli-tool'` | `'library'` | `'documentation'` | `'data'` | `'unknown'`

---

### extractTools

Extract tools from various sources in a repository.

```typescript
function extractTools(
  repoInfo: RepositoryInfo,
  options?: ExtractionOptions
): Promise<Tool[]>
```

#### Example

```typescript
import { parseRepository, extractTools } from '@nirholas/github-to-mcp';

const info = await parseRepository('https://github.com/owner/repo');
const tools = await extractTools(info, {
  fromOpenAPI: true,
  fromGraphQL: true,
  fromCode: true,
});

console.log(`Extracted ${tools.length} tools`);
```

---

## Types

### GeneratorOptions

```typescript
interface GeneratorOptions {
  /** GitHub personal access token */
  token?: string;
  
  /** Output language */
  language?: 'typescript' | 'python';
  
  /** Only include these tools */
  includeTools?: string[];
  
  /** Exclude these tools */
  excludeTools?: string[];
  
  /** Include universal tools (read_file, etc.) */
  includeUniversalTools?: boolean;
  
  /** Extract tools from OpenAPI specs */
  extractFromOpenAPI?: boolean;
  
  /** Extract tools from GraphQL schemas */
  extractFromGraphQL?: boolean;
  
  /** Extract tools from source code */
  extractFromCode?: boolean;
  
  /** Extract tools from README */
  extractFromReadme?: boolean;
  
  /** Maximum directory depth to scan */
  maxDepth?: number;
  
  /** Maximum file size to read (bytes) */
  maxFileSize?: number;
  
  /** Request timeout (ms) */
  timeout?: number;
}
```

### GeneratorResult

```typescript
interface GeneratorResult {
  /** List of generated tools */
  tools: Tool[];
  
  /** Repository metadata */
  metadata: RepositoryMetadata;
  
  /** Repository classification */
  type: RepositoryType;
  
  /** Save to a directory */
  save(path: string): Promise<void>;
  
  /** Get TypeScript code */
  toTypeScript(): string;
  
  /** Get Python code */
  toPython(): string;
  
  /** Get as zip buffer */
  toZip(): Promise<Buffer>;
}
```

### Tool

```typescript
interface Tool {
  /** Tool name (snake_case) */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** JSON Schema for input parameters */
  inputSchema: JSONSchema;
  
  /** Where the tool was extracted from */
  source: 'universal' | 'openapi' | 'graphql' | 'code' | 'readme';
  
  /** Tool implementation (generated code) */
  implementation?: string;
}
```

### RepositoryInfo

```typescript
interface RepositoryInfo {
  /** Repository owner */
  owner: string;
  
  /** Repository name */
  name: string;
  
  /** Full URL */
  url: string;
  
  /** Default branch */
  defaultBranch: string;
  
  /** Repository description */
  description: string;
  
  /** Star count */
  stars: number;
  
  /** Primary language */
  language: string;
  
  /** Repository classification */
  type: RepositoryType;
  
  /** README content */
  readme: string;
  
  /** File tree */
  files: FileTree;
}
```

### RepositoryType

```typescript
type RepositoryType = 
  | 'mcp-server'      // Existing MCP server
  | 'api-sdk'         // API client library
  | 'cli-tool'        // Command-line tool
  | 'library'         // General library
  | 'documentation'   // Documentation only
  | 'data'            // Data/config repo
  | 'unknown';        // Unclassified
```

---

## Error Handling

### GithubApiError

Thrown when GitHub API requests fail.

```typescript
import { generateFromGithub, GithubApiError } from '@nirholas/github-to-mcp';

try {
  await generateFromGithub('https://github.com/owner/private-repo');
} catch (error) {
  if (error instanceof GithubApiError) {
    console.log(`GitHub API error: ${error.status} - ${error.message}`);
  }
}
```

### ExtractionError

Thrown when tool extraction fails.

```typescript
import { ExtractionError } from '@nirholas/github-to-mcp';

try {
  // ...
} catch (error) {
  if (error instanceof ExtractionError) {
    console.log(`Extraction failed: ${error.source} - ${error.message}`);
  }
}
```

---

## See Also

- [OpenAPI Parser](openapi-parser.md) - Parser module
- [MCP Server](mcp-server.md) - Server implementation
- [Configuration](../getting-started/configuration.md) - Options guide

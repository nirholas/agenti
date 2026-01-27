# Configuration Options

Complete reference for all configuration options.

## CLI Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-o, --output` | `string` | `./output` | Output directory |
| `-l, --language` | `'typescript' \| 'python'` | `'typescript'` | Output language |
| `-t, --token` | `string` | `$GITHUB_TOKEN` | GitHub token |
| `--include-tools` | `string` | All | Comma-separated tools to include |
| `--exclude-tools` | `string` | None | Comma-separated tools to exclude |
| `--no-universal` | `boolean` | `false` | Skip universal tools |
| `--force` | `boolean` | `false` | Overwrite existing output |
| `--dry-run` | `boolean` | `false` | Preview without writing |
| `--verbose` | `boolean` | `false` | Verbose output |
| `--quiet` | `boolean` | `false` | Suppress non-error output |

## Programmatic Options

### GeneratorOptions

```typescript
interface GeneratorOptions {
  // Authentication
  token?: string;
  
  // Output
  language?: 'typescript' | 'python';
  
  // Tool filtering
  includeTools?: string[];
  excludeTools?: string[];
  includeUniversalTools?: boolean;
  
  // Extraction sources
  extractFromOpenAPI?: boolean;
  extractFromGraphQL?: boolean;
  extractFromCode?: boolean;
  extractFromReadme?: boolean;
  
  // Performance
  maxDepth?: number;
  maxFileSize?: number;
  maxFiles?: number;
  timeout?: number;
  
  // Advanced
  forceType?: RepositoryType;
  baseUrl?: string;
  userAgent?: string;
}
```

### Option Details

#### token

GitHub personal access token for authentication.

- Increases rate limit from 60 to 5000 requests/hour
- Required for private repositories
- Can be set via `GITHUB_TOKEN` environment variable

#### language

Output language for the generated server.

| Value | Description |
|-------|-------------|
| `'typescript'` | Generate TypeScript server (default) |
| `'python'` | Generate Python server |

#### includeTools

Array of tool names to include. If specified, only these tools are generated.

```typescript
{
  includeTools: ['read_file', 'search_code', 'create_customer']
}
```

#### excludeTools

Array of tool names to exclude from generation.

```typescript
{
  excludeTools: ['get_readme']  // Skip README tool
}
```

#### includeUniversalTools

Whether to include universal tools (`read_file`, `list_files`, etc.).

| Value | Description |
|-------|-------------|
| `true` | Include universal tools (default) |
| `false` | Only include extracted tools |

#### extractFromOpenAPI

Enable extraction from OpenAPI/Swagger specifications.

| Value | Description |
|-------|-------------|
| `true` | Parse OpenAPI specs (default) |
| `false` | Skip OpenAPI extraction |

#### extractFromGraphQL

Enable extraction from GraphQL schemas.

| Value | Description |
|-------|-------------|
| `true` | Parse GraphQL schemas (default) |
| `false` | Skip GraphQL extraction |

#### extractFromCode

Enable extraction from source code analysis.

| Value | Description |
|-------|-------------|
| `true` | Analyze source code (default) |
| `false` | Skip code analysis |

#### extractFromReadme

Enable extraction from README documentation.

| Value | Description |
|-------|-------------|
| `true` | Parse README (default) |
| `false` | Skip README parsing |

#### maxDepth

Maximum directory depth to scan.

| Value | Description |
|-------|-------------|
| `3` | Default depth |
| `1` | Only root directory |
| `10` | Deep scanning (slower) |

#### maxFileSize

Maximum file size to read (in bytes).

| Value | Description |
|-------|-------------|
| `100000` | 100KB (default) |
| `50000` | 50KB (for faster processing) |
| `500000` | 500KB (for larger files) |

#### maxFiles

Maximum number of files to process.

| Value | Description |
|-------|-------------|
| `1000` | Default limit |
| `100` | Faster processing |
| `5000` | Large repos |

#### timeout

Request timeout in milliseconds.

| Value | Description |
|-------|-------------|
| `30000` | 30 seconds (default) |
| `60000` | 60 seconds (for slow connections) |

#### forceType

Override automatic repository classification.

```typescript
{
  forceType: 'api-sdk'  // Force API SDK classification
}
```

Values: `'mcp-server'`, `'api-sdk'`, `'cli-tool'`, `'library'`, `'documentation'`, `'data'`

---

## Configuration File

You can create a configuration file for repeated use:

### github-to-mcp.config.js

```javascript
module.exports = {
  token: process.env.GITHUB_TOKEN,
  language: 'typescript',
  includeUniversalTools: true,
  extractFromOpenAPI: true,
  extractFromGraphQL: true,
  maxDepth: 3,
  maxFileSize: 100000,
};
```

### Usage

```bash
github-to-mcp <url> --config ./github-to-mcp.config.js
```

---

## See Also

- [Environment Variables](env.md) - Environment configuration
- [CLI Reference](../cli/index.md) - Command-line usage
- [API Reference](../api/core.md) - Programmatic API

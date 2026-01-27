# Configuration

Customize how GitHub to MCP generates your MCP servers.

## CLI Options

```bash
github-to-mcp <url> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./output` |
| `-l, --language <lang>` | Output language (`typescript` or `python`) | `typescript` |
| `-t, --token <token>` | GitHub personal access token | `$GITHUB_TOKEN` |
| `--include-tools <tools>` | Comma-separated list of tools to include | All |
| `--exclude-tools <tools>` | Comma-separated list of tools to exclude | None |
| `--no-universal` | Skip universal tools (read_file, etc.) | `false` |
| `-v, --verbose` | Enable verbose output | `false` |
| `-h, --help` | Show help | |

### Examples

Generate with specific output directory:

```bash
github-to-mcp https://github.com/owner/repo -o ./my-mcp-server
```

Generate Python server instead of TypeScript:

```bash
github-to-mcp https://github.com/owner/repo -l python
```

Only include specific tools:

```bash
github-to-mcp https://github.com/owner/repo --include-tools read_file,search_code
```

---

## Programmatic Options

When using the JavaScript API:

```typescript
import { generateFromGithub, type GeneratorOptions } from '@nirholas/github-to-mcp';

const options: GeneratorOptions = {
  // GitHub authentication
  token: process.env.GITHUB_TOKEN,
  
  // Output configuration
  language: 'typescript',  // or 'python'
  
  // Tool filtering
  includeTools: ['read_file', 'search_code'],
  excludeTools: [],
  includeUniversalTools: true,
  
  // Extraction options
  extractFromOpenAPI: true,
  extractFromGraphQL: true,
  extractFromCode: true,
  extractFromReadme: true,
  
  // Advanced
  maxDepth: 3,           // Max directory depth to scan
  maxFileSize: 100000,   // Max file size in bytes
  timeout: 30000,        // Request timeout in ms
};

const result = await generateFromGithub(
  'https://github.com/owner/repo',
  options
);
```

### GeneratorOptions Reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `token` | `string` | `undefined` | GitHub personal access token |
| `language` | `'typescript' \| 'python'` | `'typescript'` | Output language |
| `includeTools` | `string[]` | `[]` | Only include these tools |
| `excludeTools` | `string[]` | `[]` | Exclude these tools |
| `includeUniversalTools` | `boolean` | `true` | Include base tools |
| `extractFromOpenAPI` | `boolean` | `true` | Extract from OpenAPI specs |
| `extractFromGraphQL` | `boolean` | `true` | Extract from GraphQL schemas |
| `extractFromCode` | `boolean` | `true` | Extract from code analysis |
| `extractFromReadme` | `boolean` | `true` | Extract from README |
| `maxDepth` | `number` | `3` | Max directory depth |
| `maxFileSize` | `number` | `100000` | Max file size (bytes) |
| `timeout` | `number` | `30000` | Request timeout (ms) |

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub personal access token | No (but recommended) |
| `OPENAI_API_KEY` | OpenAI API key for enhanced extraction | No |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | No |

### Setting Environment Variables

=== "macOS/Linux"

    ```bash
    # Add to ~/.bashrc or ~/.zshrc
    export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
    export LOG_LEVEL=debug
    ```

=== "Windows"

    ```powershell
    # PowerShell
    $env:GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"
    $env:LOG_LEVEL="debug"
    ```

=== ".env file"

    ```bash
    # Create .env file in your project
    GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
    LOG_LEVEL=debug
    ```

---

## Output Configuration

### TypeScript Output

When `language: 'typescript'`:

```
output/
├── package.json
├── tsconfig.json
├── server.ts
├── server.mjs      # Compiled output
└── tools/
    ├── index.ts
    └── *.ts
```

### Python Output

When `language: 'python'`:

```
output/
├── pyproject.toml
├── requirements.txt
├── server.py
└── tools/
    ├── __init__.py
    └── *.py
```

---

## Tool Filtering

### Include Specific Tools

Only generate certain tools:

```typescript
const result = await generateFromGithub(url, {
  includeTools: ['read_file', 'search_code', 'create_customer']
});
```

### Exclude Tools

Generate all tools except specific ones:

```typescript
const result = await generateFromGithub(url, {
  excludeTools: ['get_readme']  // Skip README tool
});
```

### Skip Universal Tools

Only generate extracted tools:

```typescript
const result = await generateFromGithub(url, {
  includeUniversalTools: false
});
```

---

## Advanced Configuration

### Custom Extraction

Control what sources are scanned:

```typescript
const result = await generateFromGithub(url, {
  extractFromOpenAPI: true,   // Check for openapi.json, swagger.yaml
  extractFromGraphQL: true,   // Check for schema.graphql
  extractFromCode: true,      // Analyze source code
  extractFromReadme: false,   // Skip README parsing
});
```

### Performance Tuning

For large repositories:

```typescript
const result = await generateFromGithub(url, {
  maxDepth: 2,           // Limit directory depth
  maxFileSize: 50000,    // Skip files > 50KB
  timeout: 60000,        // Increase timeout to 60s
});
```

---

## Next Steps

- [CLI Reference](../cli/index.md) — Full command-line documentation
- [API Reference](../api/index.md) — Detailed programmatic API

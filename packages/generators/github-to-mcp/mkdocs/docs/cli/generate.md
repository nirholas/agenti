# generate

Generate an MCP server from a GitHub repository.

## Usage

```bash
github-to-mcp generate <url> [options]
# or shorthand
github-to-mcp <url> [options]
```

## Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `url` | GitHub repository URL | Yes |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./output` |
| `-l, --language <lang>` | Output language (`typescript` \| `python`) | `typescript` |
| `-t, --token <token>` | GitHub personal access token | `$GITHUB_TOKEN` |
| `--include-tools <tools>` | Comma-separated tools to include | All |
| `--exclude-tools <tools>` | Comma-separated tools to exclude | None |
| `--no-universal` | Skip universal tools | `false` |
| `--force` | Overwrite existing output | `false` |
| `--dry-run` | Preview without writing files | `false` |

## Examples

### Basic Generation

```bash
github-to-mcp https://github.com/stripe/stripe-node
```

### Specify Output Directory

```bash
github-to-mcp https://github.com/stripe/stripe-node -o ./stripe-mcp
```

### Generate Python Server

```bash
github-to-mcp https://github.com/openai/openai-python -l python -o ./openai-mcp
```

### Private Repository

```bash
github-to-mcp https://github.com/my-org/private-repo -t ghp_xxxxx
```

Or using environment variable:

```bash
export GITHUB_TOKEN=ghp_xxxxx
github-to-mcp https://github.com/my-org/private-repo
```

### Filter Tools

Only include specific tools:

```bash
github-to-mcp https://github.com/stripe/stripe-node \
  --include-tools read_file,search_code,create_customer
```

Exclude specific tools:

```bash
github-to-mcp https://github.com/stripe/stripe-node \
  --exclude-tools get_readme
```

### Dry Run

Preview what would be generated:

```bash
github-to-mcp https://github.com/stripe/stripe-node --dry-run
```

Output:

```
Dry run - would generate:
  Output: ./output
  Language: typescript
  Tools: 12
    - get_readme
    - list_files
    - read_file
    - search_code
    - create_customer
    - list_customers
    ...
```

## Output Structure

### TypeScript Output

```
output/
├── package.json
├── tsconfig.json
├── server.ts
├── server.mjs          # Compiled
└── tools/
    ├── index.ts
    ├── read_file.ts
    ├── list_files.ts
    └── ...
```

### Python Output

```
output/
├── pyproject.toml
├── requirements.txt
├── server.py
└── tools/
    ├── __init__.py
    ├── read_file.py
    └── ...
```

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
| `3` | GitHub API error |
| `4` | File system error |

## See Also

- [`inspect`](inspect.md) - Preview tools without generating
- [`serve`](serve.md) - Run a generated server

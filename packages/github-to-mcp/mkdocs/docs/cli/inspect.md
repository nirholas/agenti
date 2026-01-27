# inspect

Inspect a repository and preview extracted tools without generating a server.

## Usage

```bash
github-to-mcp inspect <url> [options]
```

## Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `url` | GitHub repository URL | Yes |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --token <token>` | GitHub personal access token | `$GITHUB_TOKEN` |
| `--format <format>` | Output format (`table` \| `json` \| `yaml`) | `table` |
| `--verbose` | Show detailed extraction info | `false` |

## Examples

### Basic Inspection

```bash
github-to-mcp inspect https://github.com/stripe/stripe-node
```

Output:

```
Repository: stripe/stripe-node
Type: api-sdk
Stars: 3,456
Language: TypeScript

Extracted Tools (15):
┌─────────────────────┬─────────────────────────────────────┬──────────┐
│ Name                │ Description                          │ Source   │
├─────────────────────┼─────────────────────────────────────┼──────────┤
│ get_readme          │ Get the repository README            │ universal│
│ list_files          │ List files in a directory            │ universal│
│ read_file           │ Read file contents                   │ universal│
│ search_code         │ Search for code patterns             │ universal│
│ create_customer     │ Create a new Stripe customer         │ openapi  │
│ list_charges        │ List all charges                     │ openapi  │
│ create_payment_int… │ Create a payment intent              │ openapi  │
└─────────────────────┴─────────────────────────────────────┴──────────┘
```

### JSON Output

```bash
github-to-mcp inspect https://github.com/stripe/stripe-node --format json
```

```json
{
  "repository": {
    "owner": "stripe",
    "name": "stripe-node",
    "url": "https://github.com/stripe/stripe-node",
    "type": "api-sdk",
    "stars": 3456,
    "language": "TypeScript"
  },
  "tools": [
    {
      "name": "get_readme",
      "description": "Get the repository README",
      "source": "universal",
      "inputSchema": {...}
    },
    ...
  ],
  "sources": {
    "universal": 4,
    "openapi": 11
  }
}
```

### Verbose Mode

```bash
github-to-mcp inspect https://github.com/stripe/stripe-node --verbose
```

Shows additional details:

- Files scanned
- OpenAPI specs found
- GraphQL schemas detected
- Extraction time per source

## Use Cases

### Preview Before Generating

Check what tools will be created:

```bash
# Inspect first
github-to-mcp inspect https://github.com/owner/repo

# If satisfied, generate
github-to-mcp generate https://github.com/owner/repo
```

### Compare Repositories

```bash
# Inspect multiple repos
github-to-mcp inspect https://github.com/stripe/stripe-node --format json > stripe.json
github-to-mcp inspect https://github.com/openai/openai-node --format json > openai.json

# Compare tool counts
jq '.tools | length' stripe.json openai.json
```

### CI/CD Validation

```bash
# Ensure a repo has expected tools
tools=$(github-to-mcp inspect $REPO_URL --format json | jq '.tools | length')
if [ "$tools" -lt 4 ]; then
  echo "Error: Expected at least 4 tools"
  exit 1
fi
```

## Output Formats

### Table (Default)

Human-readable tabular format for terminal viewing.

### JSON

Machine-readable JSON for scripting and automation.

### YAML

YAML format for configuration files:

```yaml
repository:
  owner: stripe
  name: stripe-node
  type: api-sdk
tools:
  - name: get_readme
    description: Get the repository README
    source: universal
```

## See Also

- [`generate`](generate.md) - Generate MCP server
- [Repository Classification](../concepts/classification.md) - How repos are classified

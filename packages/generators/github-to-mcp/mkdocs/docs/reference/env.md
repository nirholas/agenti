# Environment Variables

Configure GitHub to MCP using environment variables.

## Required Variables

None! All environment variables are optional, but some are highly recommended.

## Recommended Variables

### GITHUB_TOKEN

GitHub personal access token for API authentication.

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

| Without Token | With Token |
|---------------|------------|
| 60 requests/hour | 5,000 requests/hour |
| Public repos only | Private repos accessible |
| Basic metadata | Full repository access |

**Creating a Token:**

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Generate new token (classic)
3. Select scopes: `repo` (private) or `public_repo` (public only)
4. Copy the token

---

## Optional Variables

### LOG_LEVEL

Control logging verbosity.

```bash
export LOG_LEVEL=debug
```

| Value | Description |
|-------|-------------|
| `debug` | All messages including debug |
| `info` | Informational messages (default) |
| `warn` | Warnings and errors only |
| `error` | Errors only |
| `silent` | No output |

---

### OPENAI_API_KEY

OpenAI API key for enhanced extraction (experimental).

```bash
export OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

Used for:
- Improved tool descriptions
- Better README parsing
- Code understanding

---

### GITHUB_API_URL

Custom GitHub API URL for GitHub Enterprise.

```bash
export GITHUB_API_URL=https://github.mycompany.com/api/v3
```

Default: `https://api.github.com`

---

### HTTP_PROXY / HTTPS_PROXY

Proxy server for HTTP requests.

```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
```

---

### NO_COLOR

Disable colored output.

```bash
export NO_COLOR=1
```

---

## Setting Environment Variables

### Temporary (Current Session)

=== "macOS/Linux"

    ```bash
    export GITHUB_TOKEN=ghp_xxxxx
    ```

=== "Windows PowerShell"

    ```powershell
    $env:GITHUB_TOKEN="ghp_xxxxx"
    ```

=== "Windows CMD"

    ```cmd
    set GITHUB_TOKEN=ghp_xxxxx
    ```

### Permanent

=== "macOS/Linux"

    Add to `~/.bashrc` or `~/.zshrc`:
    ```bash
    export GITHUB_TOKEN=ghp_xxxxx
    export LOG_LEVEL=info
    ```

=== "Windows"

    Use System Properties → Environment Variables

### Per-Project

Create a `.env` file:

```bash title=".env"
GITHUB_TOKEN=ghp_xxxxx
LOG_LEVEL=debug
```

!!! warning "Security"
    Add `.env` to `.gitignore` to avoid committing secrets.

---

## Using with Claude Desktop

Pass environment variables to MCP servers:

```json title="claude_desktop_config.json"
{
  "mcpServers": {
    "my-repo": {
      "command": "node",
      "args": ["/path/to/server.mjs"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxx",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

---

## Variable Precedence

1. CLI flags (highest priority)
2. Environment variables
3. Config file
4. Defaults (lowest priority)

```bash
# CLI flag overrides environment variable
export LOG_LEVEL=error
github-to-mcp <url> --verbose  # Uses verbose, not error
```

---

## See Also

- [Configuration Options](config.md) - All options
- [Private Repos](../guides/private-repos.md) - Token setup
- [CLI Reference](../cli/index.md) - Command-line usage

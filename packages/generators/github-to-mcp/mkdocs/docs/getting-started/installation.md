# Installation

There are multiple ways to install and use GitHub to MCP depending on your needs.

## Web UI (No Installation)

The easiest way to get started — no installation required:

👉 **[github-to-mcp.vercel.app](https://github-to-mcp.vercel.app)**

Simply paste a GitHub URL, configure options, and download your generated MCP server.

---

## CLI Installation

### Using npx (Recommended)

Run directly without installing:

```bash
npx @nirholas/github-to-mcp https://github.com/owner/repo
```

### Global Installation

Install globally for repeated use:

=== "npm"

    ```bash
    npm install -g @nirholas/github-to-mcp
    ```

=== "pnpm"

    ```bash
    pnpm add -g @nirholas/github-to-mcp
    ```

=== "yarn"

    ```bash
    yarn global add @nirholas/github-to-mcp
    ```

Then use the `github-to-mcp` command:

```bash
github-to-mcp https://github.com/stripe/stripe-node
```

---

## Programmatic Installation

Add as a dependency to your project:

=== "npm"

    ```bash
    npm install @nirholas/github-to-mcp
    ```

=== "pnpm"

    ```bash
    pnpm add @nirholas/github-to-mcp
    ```

=== "yarn"

    ```bash
    yarn add @nirholas/github-to-mcp
    ```

Then import in your code:

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';
```

---

## Verify Installation

Check that the CLI is installed correctly:

```bash
github-to-mcp --version
```

You should see the version number printed:

```
@nirholas/github-to-mcp v1.0.0
```

---

## System Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 18.0.0 or higher |
| npm | 9.0.0 or higher |
| Operating System | macOS, Linux, Windows |

---

## Environment Setup

### GitHub Token (Optional)

For private repositories or to increase API rate limits (60/hr → 5000/hr), set a GitHub token:

=== "macOS/Linux"

    ```bash
    export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
    ```

=== "Windows (PowerShell)"

    ```powershell
    $env:GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"
    ```

=== "Windows (CMD)"

    ```cmd
    set GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
    ```

!!! tip "Creating a GitHub Token"
    1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
    2. Click "Generate new token (classic)"
    3. Select scopes: `repo` (for private repos) or `public_repo` (for public only)
    4. Copy and save the token

---

## Next Steps

Now that you have GitHub to MCP installed, continue to the [Quick Start](quickstart.md) guide to generate your first MCP server!

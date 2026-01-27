# Working with Private Repositories

Use GitHub to MCP with private repositories using authentication.

## GitHub Token Setup

To access private repositories, you need a GitHub Personal Access Token (PAT).

### Creating a Token

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Give it a descriptive name (e.g., "GitHub to MCP")
4. Select scopes:
   - `repo` - Full control of private repositories
   - Or `read:packages` for read-only access
5. Click **"Generate token"**
6. **Copy the token immediately** (you won't see it again!)

### Token Scopes

| Scope | Description | Use Case |
|-------|-------------|----------|
| `repo` | Full access to private repos | Read/write operations |
| `public_repo` | Access to public repos only | Higher rate limits |
| `read:packages` | Read packages | Package registries |

## Using Your Token

### Environment Variable (Recommended)

Set the `GITHUB_TOKEN` environment variable:

=== "macOS/Linux"

    ```bash
    # Add to ~/.bashrc or ~/.zshrc
    export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
    ```

=== "Windows PowerShell"

    ```powershell
    $env:GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"
    ```

=== "Windows CMD"

    ```cmd
    set GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
    ```

Then use normally:

```bash
npx @nirholas/github-to-mcp https://github.com/your-org/private-repo
```

### CLI Flag

Pass the token directly:

```bash
npx @nirholas/github-to-mcp https://github.com/your-org/private-repo \
  --token ghp_xxxxxxxxxxxxx
```

!!! warning "Security Warning"
    Don't commit tokens to version control or share them in logs.

### Programmatic

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';

const result = await generateFromGithub(
  'https://github.com/your-org/private-repo',
  { token: process.env.GITHUB_TOKEN }
);
```

## Web UI Authentication

On the [web interface](https://github-to-mcp.vercel.app):

1. Click the **"Settings"** gear icon
2. Enter your GitHub token in the **"GitHub Token"** field
3. The token is stored locally in your browser (not sent to servers)
4. Generate private repos normally

## GitHub Enterprise

For GitHub Enterprise Server, use the full URL:

```bash
npx @nirholas/github-to-mcp https://github.your-company.com/org/repo \
  --token ghp_xxxxxxxxxxxxx
```

## Rate Limits

| Authentication | Rate Limit |
|---------------|------------|
| Anonymous | 60 requests/hour |
| With Token | 5,000 requests/hour |
| GitHub Enterprise | Varies by instance |

!!! tip "Always Use a Token"
    Even for public repos, using a token gives you 83x more API calls.

## Organization Repositories

### SSO-Enabled Organizations

If your organization uses SAML SSO:

1. Create your token normally
2. Go to [Token Settings](https://github.com/settings/tokens)
3. Find your token and click **"Enable SSO"**
4. Authorize for your organization

### Fine-Grained Tokens

For better security, use fine-grained tokens:

1. Go to [Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **"Generate new token"**
3. Select specific repositories
4. Choose minimal permissions:
   - `Contents: Read-only`
   - `Metadata: Read-only`

## Security Best Practices

### 1. Rotate Tokens Regularly

Set a reminder to regenerate tokens every 90 days.

### 2. Use Minimum Scopes

Only request the permissions you need.

### 3. Never Commit Tokens

Add to `.gitignore`:

```gitignore
.env
.env.local
*.token
```

### 4. Use Environment Variables

Never hardcode tokens in your code.

### 5. Audit Token Usage

Check [Security Log](https://github.com/settings/security-log) for token activity.

## Troubleshooting

### "Bad credentials" Error

- Token may be expired
- Token may lack required scopes
- SSO may not be authorized

### "Not Found" Error

- Repo doesn't exist or is private
- Token lacks `repo` scope
- Token not authorized for organization

### Rate Limit Exceeded

- Wait for the limit to reset (usually 1 hour)
- Use a token if not already
- Check for API-heavy operations

### Check Token Validity

```bash
curl -H "Authorization: token ghp_xxxxx" \
  https://api.github.com/user
```

Should return your user information.

---

## Example: Private Repo Workflow

Complete workflow for a private repository:

```bash
# 1. Set token
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# 2. Generate MCP server
npx @nirholas/github-to-mcp https://github.com/my-company/internal-api \
  -o ~/mcp-servers/internal-api

# 3. Install dependencies
cd ~/mcp-servers/internal-api
npm install

# 4. Test the server
npm start

# 5. Add to Claude Desktop
# Edit claude_desktop_config.json
```

---

## Next Steps

- [Custom Tools](custom-tools.md) - Extend your MCP server
- [Claude Desktop](claude-desktop.md) - Connect your server
- [Configuration](../getting-started/configuration.md) - More options

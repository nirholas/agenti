# Reference

Quick reference documentation for GitHub to MCP.

## Quick Links

- [Generated Tools](tools.md) - All tool definitions
- [Configuration Options](config.md) - Full options reference
- [Environment Variables](env.md) - Environment configuration

## FAQ

### General

<details>
<summary><strong>What is GitHub to MCP?</strong></summary>

GitHub to MCP is a tool that converts any GitHub repository into a Model Context Protocol (MCP) server, enabling AI assistants to interact with the codebase.
</details>

<details>
<summary><strong>What AI assistants support MCP?</strong></summary>

- Claude Desktop
- Cursor
- Cline
- Continue
- Windsurf
- Any tool implementing the MCP specification
</details>

<details>
<summary><strong>Is this free to use?</strong></summary>

Yes! GitHub to MCP is open source under the MIT license. The web app is free, and you can self-host.
</details>

### Technical

<details>
<summary><strong>Does this work with private repositories?</strong></summary>

Yes! Set the `GITHUB_TOKEN` environment variable with a token that has access to your private repos. See [Private Repos Guide](../guides/private-repos.md).
</details>

<details>
<summary><strong>What languages can the generated server be?</strong></summary>

TypeScript (default) or Python. Use the `-l python` flag for Python output.
</details>

<details>
<summary><strong>Can I customize the generated tools?</strong></summary>

Yes! The generated code is plain TypeScript/Python — edit it however you want. See [Custom Tools Guide](../guides/custom-tools.md).
</details>

<details>
<summary><strong>What's the difference between tools and resources?</strong></summary>

**Tools** are callable functions with parameters (like `read_file`). **Resources** are static data the AI can access. GitHub to MCP generates tools, not resources.
</details>

### Troubleshooting

<details>
<summary><strong>I'm getting rate limit errors</strong></summary>

Set a GitHub token for 5000 requests/hour instead of 60:

```bash
export GITHUB_TOKEN=ghp_xxxxx
```
</details>

<details>
<summary><strong>The server won't start</strong></summary>

1. Make sure you ran `npm install` in the output directory
2. Check Node.js version (18+ required)
3. Verify the path to `server.mjs` is correct
</details>

<details>
<summary><strong>Claude doesn't see my tools</strong></summary>

1. Check config file location and JSON syntax
2. Use absolute paths, not relative
3. Restart Claude Desktop completely
4. Enable MCP logs in Claude settings
</details>

<details>
<summary><strong>No tools were extracted</strong></summary>

The repo may not have detectable patterns. Check:
- Is there an OpenAPI spec?
- Is there a GraphQL schema?
- For MCP servers, are tools registered correctly?

Use `--verbose` to see what was analyzed.
</details>

---
hide:
  - navigation
  - toc
---

<style>
.md-content__button {
  display: none;
}
</style>

<div class="hero" markdown>

# GitHub to MCP 🚀

**Convert any GitHub repository into an MCP server in seconds**

Give Claude, ChatGPT, Cursor, Windsurf, Cline, and any AI assistant instant access to any codebase.

[Get Started](getting-started/index.md){ .md-button .md-button--primary }
[Try Web App](https://github-to-mcp.vercel.app){ .md-button }

</div>

---

## What is GitHub to MCP?

**GitHub to MCP** converts any GitHub repository into a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server. MCP is the open standard that lets AI assistants like **Claude**, **ChatGPT**, **Cursor**, **Windsurf**, and **Cline** interact with external tools and data.

**In plain English:** Paste a GitHub URL → Get an MCP server → Your AI can now read files, search code, and use the repo's APIs.

---

## Why use this?

<div class="feature-grid" markdown>

<div class="feature-card" markdown>

### 🚀 Instant Setup

No manual configuration required. Just paste a URL and you're ready to go.

</div>

<div class="feature-card" markdown>

### 🤖 Works with Any AI

Claude Desktop, ChatGPT, Cursor, VS Code Copilot, Cline, Continue, and more.

</div>

<div class="feature-card" markdown>

### 📦 Zero Config

Generates a complete, runnable MCP server with all dependencies included.

</div>

<div class="feature-card" markdown>

### 🔍 Smart Extraction

Automatically finds APIs, tools, and functions from OpenAPI specs, code, and docs.

</div>

</div>

---

## Quick Start

### Web UI (Easiest)

Visit **[github-to-mcp.vercel.app](https://github-to-mcp.vercel.app)** — Paste any GitHub URL, click Generate, download your MCP server.

### CLI (One Command)

```bash
npx @nirholas/github-to-mcp https://github.com/stripe/stripe-node
```

### Programmatic (For Automation)

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';

const result = await generateFromGithub('https://github.com/stripe/stripe-node');
console.log(`Generated ${result.tools.length} tools`);
await result.save('./my-mcp-server');
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  1. Fetch & Classify  →  Detect repo type (API/CLI/Lib)     │
│  2. Extract Tools     →  OpenAPI, GraphQL, Code, README     │
│  3. Generate Server   →  TypeScript or Python MCP server    │
│  4. Bundle Output     →  Complete package with dependencies │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Ready-to-use MCP Server + Config               │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| 🔄 **Universal Conversion** | Every repo gets 4 base tools: `read_file`, `list_files`, `search_code`, `get_readme` |
| 🔍 **Smart Detection** | Extracts tools from OpenAPI/Swagger specs, GraphQL schemas, Python decorators, and README docs |
| 🏷️ **Auto Classification** | Identifies repo type (API, MCP server, CLI, library, docs) to optimize extraction |
| 🐍 **Multi-language Output** | Generate TypeScript or Python MCP servers |
| ⚡ **Instant Deploy** | One-click Vercel deployment for hosted MCP servers |

---

## Use Cases

- **"I want Claude to understand my codebase"** → Generate an MCP server, add to Claude Desktop
- **"I want to query the Stripe API from ChatGPT"** → Convert stripe/stripe-node, get typed tools
- **"I want Cursor to use my internal SDK"** → Point at your private repo (with token)
- **"I want to wrap any REST API for AI"** → Convert any repo with an OpenAPI spec

---

<div class="quick-links" markdown>

[:fontawesome-solid-rocket: **Getting Started**](getting-started/index.md)
Learn how to install and use GitHub to MCP

[:fontawesome-solid-book: **Guides**](guides/index.md)
Integration tutorials for Claude, Cursor, VS Code

[:fontawesome-solid-terminal: **CLI Reference**](cli/index.md)
Command-line tool documentation

[:fontawesome-solid-code: **API Reference**](api/index.md)
Programmatic API for automation

</div>

---

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io) — The protocol specification
- [MCP Servers](https://github.com/modelcontextprotocol/servers) — Official MCP server examples
- [Claude Desktop](https://claude.ai/download) — AI assistant with MCP support

---

<div style="text-align: center; margin-top: 3rem;" markdown>

**Built by [nirholas](https://github.com/nirholas)** • MIT License

[:fontawesome-brands-github: GitHub](https://github.com/nirholas/github-to-mcp){ .md-button }
[:fontawesome-brands-npm: npm](https://www.npmjs.com/package/@nirholas/github-to-mcp){ .md-button }

</div>

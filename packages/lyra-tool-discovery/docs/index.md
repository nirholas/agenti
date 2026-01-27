---
layout: home

hero:
  name: "Lyra Tool Discovery"
  text: "AI-powered tool discovery for the MCP ecosystem"
  tagline: Discover, analyze, and integrate tools from GitHub and npm using OpenAI or Anthropic
  image:
    src: /logo.svg
    alt: Lyra Tool Discovery
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/nirholas/lyra-tool-discovery

features:
  - icon: 🤖
    title: Multi-Provider AI
    details: Choose between OpenAI (GPT-4o) or Anthropic (Claude) for intelligent analysis. Auto-detects from environment variables.
  - icon: 📦
    title: 8 Plugin Templates
    details: Supports all plugin.delivery templates including MCP-HTTP, MCP-STDIO, OpenAPI, standalone, and more.
  - icon: 🔍
    title: Smart Discovery
    details: Crawls GitHub repositories and npm packages to find MCP servers, APIs, and tools automatically.
  - icon: ⚡
    title: CLI & API
    details: Use the powerful CLI for quick discovery or integrate programmatically into your own tools.
  - icon: 🔗
    title: Pipeline Ready
    details: Designed to feed into github-to-mcp and plugin.delivery for end-to-end automation.
  - icon: 🎯
    title: Accurate Matching
    details: AI analyzes README, package.json, and code structure to pick the perfect template.
---

## Quick Example

```bash
# Install globally
pnpm add -g @nirholas/lyra-tool-discovery

# Set up AI provider
export ANTHROPIC_API_KEY="sk-ant-..."

# Discover MCP servers
lyra-discover discover --sources github --limit 10
```

## How It Works

```mermaid
graph LR
    A[Discovery] --> B[AI Analysis]
    B --> C[Template Selection]
    C --> D[Config Generation]
    D --> E[Plugin Registry]
```

1. **Discovery** - Searches GitHub and npm for MCP servers and tools
2. **Analysis** - AI reads README, package.json, and code structure
3. **Selection** - Determines the best of 8 plugin templates
4. **Generation** - Creates ready-to-use plugin configuration
5. **Integration** - Feeds into plugin.delivery for deployment

## Part of the Plugin Ecosystem

<div class="ecosystem-grid">
  <a href="https://github.com/nirholas/github-to-mcp" class="ecosystem-card">
    <h3>🔄 github-to-mcp</h3>
    <p>Transform GitHub repositories into MCP servers automatically</p>
  </a>
  
  <a href="https://plugin.delivery" class="ecosystem-card">
    <h3>📦 plugin.delivery</h3>
    <p>Plugin registry and delivery platform for SperaxOS</p>
  </a>
  
  <a href="https://github.com/nirholas/SperaxOS" class="ecosystem-card">
    <h3>🖥️ SperaxOS</h3>
    <p>The AI-powered operating system that consumes these plugins</p>
  </a>
</div>

## Supported Templates

| Template | Type | Use Case |
|----------|------|----------|
| `mcp-http` | MCP | Remote MCP servers with HTTP endpoints |
| `mcp-stdio` | MCP | Local npm packages via npx |
| `openapi` | OpenAPI | Existing APIs with OpenAPI specs |
| `standalone` | React | Interactive dashboards and UIs |
| `markdown` | Markdown | Rich formatted output |
| `basic` | Default | Simple API endpoints |
| `default` | Default | Configurable plugins with settings |
| `settings` | Default | User preference storage |

---

<div style="text-align: center; margin-top: 2rem;">
  <a href="/guide/getting-started" style="display: inline-block; padding: 0.75rem 1.5rem; background: var(--vp-c-brand-1); color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">
    Get Started →
  </a>
</div>

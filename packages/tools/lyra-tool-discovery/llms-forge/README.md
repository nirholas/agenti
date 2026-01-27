# llm.energy

Extract llms.txt documentation from any website for AI agents, LLMs, and automation workflows.

## Overview

llm.energy is a web application and MCP server that fetches, parses, and organizes documentation from websites implementing the llms.txt standard. It transforms raw documentation into structured, agent-ready formats optimized for large language models, AI assistants, and developer tooling.

The llms.txt standard (llmstxt.org) provides a standardized way for websites to expose their documentation in a format that AI systems can easily consume. llm.energy makes it simple to extract, process, and use this documentation.

## Key Features

- Automatic detection of llms.txt and llms-full.txt endpoints
- Content parsing and sectioning into organized markdown files
- MCP (Model Context Protocol) server for programmatic access
- REST API with built-in caching and rate limiting
- Batch processing for multiple URLs simultaneously
- Export formats: Markdown, JSON, YAML
- Site directory with curated llms.txt-enabled websites
- llms.txt generator wizard for creating your own
- ZIP download with all extracted documentation
- Agent-ready output with AGENT-GUIDE.md included

## Use Cases

- Feed documentation to AI coding assistants (Cursor, Windsurf, Claude, GPT)
- Build context-aware AI agents with up-to-date docs
- Create documentation pipelines for RAG systems
- Automate documentation aggregation across multiple sources
- Generate llms.txt files for your own projects

## Installation

### Web Application

Visit https://llm.energy to use the hosted version.

### Local Development

```bash
git clone https://github.com/nirholas/extract-llms-docs.git
cd extract-llms-docs
pnpm install
pnpm dev
```

The application runs on http://localhost:3001

### MCP Server

Add to your MCP client configuration (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "llm-energy": {
      "command": "npx",
      "args": ["-y", "@llm-energy/mcp-server"]
    }
  }
}
```

## API Reference

### Extract Documentation

```bash
POST /api/extract
Content-Type: application/json

{
  "url": "https://docs.example.com"
}
```

Response includes parsed sections, metadata, and download URLs.

### Validate URL

```bash
POST /api/validate
Content-Type: application/json

{
  "url": "https://docs.example.com"
}
```

Checks if a URL has llms.txt support before extraction.

### Batch Processing

```bash
POST /api/batch
Content-Type: application/json

{
  "urls": [
    "https://docs.anthropic.com",
    "https://docs.stripe.com",
    "https://vercel.com"
  ]
}
```

Process multiple documentation sources in a single request.

### Download Formats

```bash
GET /api/download?url={url}&format={format}
```

Formats: markdown, json, yaml, zip

## MCP Server Tools

The MCP server exposes the following tools for AI agents:

| Tool | Description |
|------|-------------|
| extract_docs | Extract documentation from a URL with llms.txt support |
| validate_url | Check if a URL has llms.txt available |
| list_sites | Get directory of known llms.txt-enabled sites |
| search_sites | Search the site directory by category or keyword |

## Project Structure

```
extract-llms-docs/
  src/
    app/              Next.js pages and API routes
      api/            REST API endpoints
      extract/        Extraction interface
      batch/          Batch processing page
      directory/      Site directory browser
      generator/      llms.txt generator wizard
    components/       React UI components
    lib/              Core utilities
      parser.ts       llms.txt parser
      extractor.ts    Content extraction
      cache.ts        Response caching
      rate-limiter.ts
    hooks/            React hooks
    types/            TypeScript definitions
    data/             Site directory data
  packages/
    core/             Shared parser and types
  mcp-server/         MCP server package
  public/
    docs/             Documentation site
  docs-site/          MkDocs source
```

## Technology Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- Model Context Protocol SDK
- Vitest for testing

## Configuration

Environment variables (optional):

```bash
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
CACHE_TTL=3600
```

## Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm start        # Start production server
pnpm test         # Run tests
pnpm test:coverage # Tests with coverage report
pnpm typecheck    # TypeScript validation
pnpm lint         # ESLint check
```

## Related Standards and Projects

- llms.txt Standard: https://llmstxt.org
- Model Context Protocol: https://modelcontextprotocol.io
- MCP Servers Directory: https://github.com/modelcontextprotocol/servers

## Sites with llms.txt Support

The application includes a directory of websites known to support llms.txt:

- Anthropic Documentation
- Vercel Documentation
- Stripe API Reference
- Supabase Docs
- Mintlify Documentation

Browse the full directory at https://llm.energy/directory

## Contributing

Contributions welcome. Please open an issue to discuss changes before submitting a pull request.

To add a site to the directory, edit src/data/sites.ts and submit a PR.

## License

MIT License

## Links

- Website: https://llm.energy
- Documentation: https://llm.energy/docs
- GitHub: https://github.com/nirholas/extract-llms-docs
- MCP Server: https://www.npmjs.com/package/@llm-energy/mcp-server

## Author

Built by nich - https://x.com/nichxbt

---

Keywords: llms.txt, llms-full.txt, documentation extraction, AI documentation, LLM context, Model Context Protocol, MCP server, AI agents, documentation parser, markdown extraction, API documentation, developer tools, AI coding assistant, RAG, retrieval augmented generation, context injection, AI-friendly documentation, vibe coding, cursor, windsurf, claude, chatgpt, copilot


# Concepts

Understand how GitHub to MCP works under the hood.

## Core Concepts

<div class="feature-grid" markdown>

<div class="feature-card" markdown>

### [How It Works](how-it-works.md)

The end-to-end flow from GitHub URL to MCP server.

</div>

<div class="feature-card" markdown>

### [Tool Types](tool-types.md)

Understanding universal and extracted tools.

</div>

<div class="feature-card" markdown>

### [Repository Classification](classification.md)

How repos are analyzed and categorized.

</div>

<div class="feature-card" markdown>

### [MCP Protocol](mcp-protocol.md)

Understanding the Model Context Protocol.

</div>

</div>

## Quick Overview

### What is MCP?

The **Model Context Protocol (MCP)** is an open standard that enables AI assistants to interact with external tools and data sources. It provides a standardized way for AI models to:

- Call external functions (tools)
- Access external data (resources)
- Use predefined conversation templates (prompts)

### What GitHub to MCP Does

1. **Fetches** a GitHub repository
2. **Analyzes** its structure and contents
3. **Extracts** tool definitions from various sources
4. **Generates** a complete MCP server
5. **Packages** everything for easy deployment

### Why This Matters

Without MCP, AI assistants are limited to their training data. With MCP:

- **Claude** can read your actual codebase
- **Cursor** can call real API endpoints
- **ChatGPT** can search your documentation

## Key Terms

| Term | Definition |
|------|------------|
| **MCP Server** | A program that exposes tools via the MCP protocol |
| **Tool** | A function that an AI can call with parameters |
| **Resource** | Static data that an AI can read |
| **Transport** | How the AI communicates with the server (stdio, HTTP) |
| **Schema** | JSON Schema describing a tool's input/output |

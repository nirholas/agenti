# llm.energy

Extract documentation for AI agents from any site with llms.txt support.

---

## What is llm.energy?

llm.energy fetches documentation from websites that support the [llms.txt standard](https://llmstxt.org/) and organizes it into downloadable markdown files optimized for AI assistants.

<div class="grid cards" markdown>

-   :material-file-download:{ .lg .middle } **Extract**

    ---

    Fetch `llms.txt` or `llms-full.txt` from any documentation site

-   :material-file-document-multiple:{ .lg .middle } **Organize**

    ---

    Split content into individual markdown files by section

-   :material-robot:{ .lg .middle } **Agent-Ready**

    ---

    Includes `AGENT-GUIDE.md` with instructions for AI assistants

-   :material-folder-zip:{ .lg .middle } **Download**

    ---

    Get individual files or everything as a ZIP archive

</div>

---

## Quick Start

**Web App**

1. Visit [llm.energy](https://llm.energy)
2. Enter a documentation URL
3. Download the extracted files

**MCP Server**

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

---

## Links

- [GitHub Repository](https://github.com/nirholas/lyra-tool-discovery)
- [MCP Server](mcp-server/installation.md)
- [API Reference](api-reference.md)

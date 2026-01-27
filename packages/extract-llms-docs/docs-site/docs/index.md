# llm.energy

Extract documentation for AI agents. Fetch llms.txt and install.md from any documentation site, organized into downloadable markdown ready for Claude, ChatGPT, and other AI assistants.

[:octicons-rocket-24: Get Started](https://llm.energy){ .md-button .md-button--primary }
[:octicons-mark-github-16: View on GitHub](https://github.com/nirholas/extract-llms-docs){ .md-button }

---

## Features

<div class="grid cards" markdown>

-   :material-file-download:{ .lg .middle } **Smart Extraction**

    ---

    Automatically fetches `llms.txt`, `llms-full.txt`, and `install.md` from any documentation site

-   :material-file-document-multiple:{ .lg .middle } **Organized Output**

    ---

    Splits content into individual markdown files by section for easy navigation

-   :material-robot:{ .lg .middle } **Agent-Ready Format**

    ---

    Includes `AGENT-GUIDE.md` with instructions optimized for AI assistants

-   :material-folder-zip:{ .lg .middle } **One-Click Download**

    ---

    Get individual files or everything bundled as a convenient ZIP archive

-   :material-terminal:{ .lg .middle } **install.md Support**

    ---

    Detect and extract LLM-executable installation instructions automatically

-   :material-api:{ .lg .middle } **MCP Server**

    ---

    Integrate with Claude Desktop, Cursor, and other MCP-compatible tools

</div>

---

## Quick Start

=== "Web App"

    1. Visit [llm.energy](https://llm.energy)
    2. Enter a documentation URL
    3. Download the extracted files

=== "MCP Server"

    Add to your MCP client configuration:

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

    See [MCP Server Installation](mcp-server/installation.md) for detailed setup.

=== "API"

    ```bash
    curl -X POST https://llm.energy/api/extract \
      -H "Content-Type: application/json" \
      -d '{"url": "docs.anthropic.com"}'
    ```

    See [API Reference](api-reference.md) for all endpoints.

---

## Supported Standards

llm.energy supports two complementary standards for LLM-friendly documentation:

| Standard | Description | Learn More |
|----------|-------------|------------|
| **llms.txt** | Machine-readable documentation at `/llms.txt` | [llms.txt Standard](llms-txt-standard.md) |
| **install.md** | LLM-executable installation instructions | [install.md Standard](install-md-standard.md) |

---

## Links

<div class="grid cards" markdown>

-   :material-book-open-variant:{ .lg .middle } **Documentation**

    ---

    [Overview](overview.md) · [Examples](examples.md) · [API Reference](api-reference.md)

-   :material-server:{ .lg .middle } **MCP Server**

    ---

    [Installation](mcp-server/installation.md) · [Available Tools](mcp-server/tools.md)

-   :material-github:{ .lg .middle } **Open Source**

    ---

    [GitHub Repository](https://github.com/nirholas/extract-llms-docs)

</div>

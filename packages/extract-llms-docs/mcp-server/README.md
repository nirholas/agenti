# llm.energy MCP Server

An MCP (Model Context Protocol) server that extracts documentation from websites with llms.txt support, making it easy for AI assistants to access and understand any documentation.

## Features

- Extract Documentation: Fetch and parse llms.txt/llms-full.txt from any compatible website
- Structured Output: Get organized markdown documents split by sections
- Agent Guide: Automatically generates an AGENT-GUIDE.md with usage instructions
- Full Documentation: Consolidated llms-full.md with table of contents
- Caching: Extracted documentation is cached for quick subsequent access
- Resources: Access extracted documents as MCP resources
- Prompts: Pre-built prompts for common documentation tasks

## Installation

```bash
npm install @llm-energy/mcp-server
```

Or install globally:

```bash
npm install -g @llm-energy/mcp-server
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration file:

macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
Windows: %APPDATA%\Claude\claude_desktop_config.json

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

Or if installed globally:

```json
{
  "mcpServers": {
    "llm-energy": {
      "command": "llm-energy-mcp"
    }
  }
}
```

## Available Tools

### extract_documentation

Extract and parse documentation from a website.

```
Input: { "url": "docs.anthropic.com" }
Output: Extraction summary with document list and statistics
```

### fetch_llms_txt

Fetch raw llms.txt content without parsing.

```
Input: { "url": "stripe.com" }
Output: Raw llms.txt or llms-full.txt content
```

### get_document_section

Get a specific document section by filename.

```
Input: { "url": "docs.anthropic.com", "filename": "getting-started.md" }
Output: Markdown content of that section
```

### list_extracted_documents

List all document sections from a previously extracted URL.

```
Input: { "url": "docs.anthropic.com" }
Output: List of all available documents with token counts
```

### get_full_documentation

Get the complete consolidated documentation.

```
Input: { "url": "docs.anthropic.com" }
Output: Full llms-full.md content with table of contents
```

### get_agent_guide

Get the AI agent usage guide.

```
Input: { "url": "docs.anthropic.com" }
Output: AGENT-GUIDE.md with instructions for AI assistants
```

## Available Prompts

### extract_and_summarize

Extract documentation and get a comprehensive summary.

Arguments:
- url (required): The documentation URL to extract

### find_api_reference

Extract documentation and locate API reference sections.

Arguments:
- url (required): The documentation URL to extract
- topic (optional): Specific API topic to find

### getting_started_guide

Extract documentation and create a getting started guide.

Arguments:
- url (required): The documentation URL to extract

## Resources

After extraction, documents are available as MCP resources:

- llms-forge://{domain}/full - Full consolidated documentation
- llms-forge://{domain}/guide - Agent usage guide
- llms-forge://{domain}/{filename} - Individual document sections

## Example Workflow

1. **Extract documentation** from a website:
   ```
   extract_documentation({ "url": "docs.anthropic.com" })
   ```

2. **View available sections**:
   ```
   list_extracted_documents({ "url": "docs.anthropic.com" })
   ```

3. **Read specific section**:
   ```
   get_document_section({ "url": "docs.anthropic.com", "filename": "api-reference.md" })
   ```

4. **Or get everything at once**:
   ```
   get_full_documentation({ "url": "docs.anthropic.com" })
   ```

## Supported Websites

This server works with any website that implements the llms.txt standard:

- Anthropic (docs.anthropic.com)
- Stripe (stripe.com)
- Model Context Protocol (modelcontextprotocol.io)
- And many more...

## Development

```bash
# Clone the repository
git clone https://github.com/nirholas/extract-llms-docs.git
cd extract-llms-docs/mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev
```

## How It Works

The server fetches `/llms-full.txt` (or `/llms.txt` as fallback) from the target website, then:

1. **Parses** the markdown content by headers (##, ###, etc.)
2. **Splits** into individual document sections
3. **Generates** clean filenames from section titles
4. **Creates** a consolidated llms-full.md with table of contents
5. **Creates** an AGENT-GUIDE.md with usage instructions for AI assistants
6. **Caches** results for quick subsequent access

## License

MIT

## Author

Created by nich ([x.com/nichxbt](https://x.com/nichxbt) | [github.com/nirholas](https://github.com/nirholas))

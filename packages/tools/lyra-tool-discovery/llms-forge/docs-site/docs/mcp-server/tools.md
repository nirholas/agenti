# Tools Reference

Available MCP tools for llm.energy.

---

## extract_documentation

Extract and parse documentation from a website with llms.txt support.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes | Documentation site URL |

**Example**

```json
{
  "url": "docs.anthropic.com"
}
```

**Output**

- Extraction summary
- List of parsed documents with token counts
- Statistics (processing time, document count, total tokens)

!!! info "Caching"
    After extraction, documentation is cached for quick access via other tools.

---

## fetch_llms_txt

Fetch raw llms.txt content without parsing.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes | Documentation site URL |
| `full` | boolean | No | Fetch llms-full.txt instead (default: true) |

**Example**

```json
{
  "url": "modelcontextprotocol.io",
  "full": true
}
```

---

## get_document

Retrieve a specific document from the cache.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Document filename |

**Example**

```json
{
  "name": "getting-started.md"
}
```

---

## list_documents

List all cached documents.

**Output**

Array of document names with metadata:

- Filename
- Token count
- Section title

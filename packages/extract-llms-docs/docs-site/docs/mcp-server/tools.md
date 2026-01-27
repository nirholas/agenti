# Tools Reference

Available MCP tools for llm.energy.

!!! success "New Tools"
    Two new verification tools added: `verify_llms_txt` and `discover_documentation_urls`

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

## verify_llms_txt

Verify if a URL has llms.txt and retrieve file information.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes | Website URL to verify |

**Example**

```json
{
  "url": "docs.stripe.com"
}
```

**Output**

- Verification status (online/offline/error)
- File size and last modified date
- Content type and server information
- llms.txt URL location

!!! tip "Real-time Verification"
    This tool performs live HTTP checks - perfect for validating sites before extraction.

---

## discover_documentation_urls

Intelligently discover documentation URLs for a domain.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domain` | string | Yes | Base domain to scan |

**Example**

```json
{
  "domain": "anthropic.com"
}
```

**Output**

- Discovered documentation URLs
- Subdomain patterns (docs.*, api.*, developers.*)
- Confidence scores for each URL
- Platform detection (GitBook, ReadMe, etc.)

!!! note "Smart Discovery"
    Checks 50+ common documentation patterns, subdomains, and platform-specific locations.

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

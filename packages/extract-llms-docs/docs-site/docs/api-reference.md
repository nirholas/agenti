# API Reference

REST API for llm.energy.

!!! info "Authentication"
    All endpoints are public. Rate limiting applies: 100 requests per minute.

---

## Base URL

```
https://llm.energy/api
```

---

## Endpoints

### Extract Documentation

```
POST /extract
```

**Request Body**

```json
{
  "url": "docs.anthropic.com"
}
```

**Response**

```json
{
  "success": true,
  "source": "llms-full.txt",
  "documents": [
    {
      "name": "getting-started.md",
      "title": "Getting Started",
      "tokens": 1250
    }
  ],
  "stats": {
    "totalDocuments": 12,
    "totalTokens": 45000,
    "processingTimeMs": 234
  }
}
```

---

### Fetch Raw Content

```
GET /fetch?url={url}&full={boolean}
```

**Parameters**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `url` | string | required | Documentation site URL |
| `full` | boolean | `true` | Fetch llms-full.txt |

**Response**

```json
{
  "success": true,
  "content": "# Documentation\n\n...",
  "source": "llms-full.txt"
}
```

---

## Error Responses

!!! warning "Error Handling"
    All errors return a JSON response with `success: false` and an `error` message.

```json
{
  "success": false,
  "error": "No llms.txt found at the specified URL"
}
```

| Status | Description |
|--------|-------------|
| 400 | Invalid request parameters |
| 404 | No llms.txt found |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

### Validate install.md

```
POST /validate-install
```

**Request Body**

```json
{
  "content": "# my-tool\n\nOBJECTIVE: Install the tool..."
}
```

Or validate from URL:

```json
{
  "url": "https://example.com/install.md"
}
```

**Response**

```json
{
  "valid": true,
  "parsed": {
    "productName": "my-tool",
    "objective": "Install the tool",
    "doneWhen": "Tool is working",
    "todoItems": [...],
    "steps": [...]
  }
}
```

---

### Check install.md Existence

```
GET /validate-install?url={url}
```

**Response**

```json
{
  "exists": true,
  "url": "https://example.com/install.md",
  "valid": true,
  "productName": "my-tool"
}
```

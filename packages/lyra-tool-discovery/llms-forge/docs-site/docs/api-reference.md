# API Reference

REST API for llm.energy.

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
| 500 | Server error |

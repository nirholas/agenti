---
title: RSS/Atom Feeds
description: Subscribe to MCP Registry changes via RSS or Atom feeds
icon: material/rss
tags:
  - channels
  - rss
---

# RSS/Atom Feeds

Subscribe to registry changes using any feed reader.

## Available Feeds

| Feed | URL | Format |
|------|-----|--------|
| All Changes | `/api/v1/feeds/rss` | RSS 2.0 |
| All Changes | `/api/v1/feeds/atom` | Atom 1.0 |
| All Changes | `/api/v1/feeds/json` | JSON Feed |

## Feed URLs

```
# RSS
http://localhost:8080/api/v1/feeds/rss

# Atom
http://localhost:8080/api/v1/feeds/atom

# JSON Feed
http://localhost:8080/api/v1/feeds/json
```

## Filtering

Add query parameters to filter the feed:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `type` | Filter by change type | `?type=new` |
| `server` | Filter by server name | `?server=awesome-tool` |
| `limit` | Number of items | `?limit=50` |

### Examples

```
# Only new servers
/api/v1/feeds/rss?type=new

# Specific server
/api/v1/feeds/atom?server=awesome-tool

# Last 10 changes
/api/v1/feeds/json?limit=10

# Combined
/api/v1/feeds/rss?type=new&limit=20
```

## Feed Readers

Popular RSS readers that work great with MCP Notify:

### Desktop

- [NetNewsWire](https://netnewswire.com/) (macOS, iOS)
- [Thunderbird](https://www.thunderbird.net/) (Cross-platform)
- [Fluent Reader](https://hyliu.me/fluent-reader/) (Cross-platform)

### Web

- [Feedly](https://feedly.com/)
- [Inoreader](https://www.inoreader.com/)
- [Feedbin](https://feedbin.com/)

### Self-Hosted

- [FreshRSS](https://freshrss.org/)
- [Miniflux](https://miniflux.app/)
- [Tiny Tiny RSS](https://tt-rss.org/)

## RSS Format Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MCP Registry Changes</title>
    <link>https://registry.modelcontextprotocol.io</link>
    <description>Recent changes in the MCP Registry</description>
    <lastBuildDate>Sun, 05 Jan 2026 10:30:00 GMT</lastBuildDate>
    
    <item>
      <title>🆕 New: awesome-database-tool</title>
      <link>https://registry.modelcontextprotocol.io/servers/awesome-database-tool</link>
      <description>A new MCP server has been added: awesome-database-tool (v1.2.0)</description>
      <pubDate>Sun, 05 Jan 2026 10:30:00 GMT</pubDate>
      <guid>chg_xyz789</guid>
    </item>
  </channel>
</rss>
```

## JSON Feed Example

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "MCP Registry Changes",
  "home_page_url": "https://registry.modelcontextprotocol.io",
  "feed_url": "http://localhost:8080/api/v1/feeds/json",
  "items": [
    {
      "id": "chg_xyz789",
      "title": "🆕 New: awesome-database-tool",
      "url": "https://registry.modelcontextprotocol.io/servers/awesome-database-tool",
      "content_text": "A new MCP server has been added: awesome-database-tool (v1.2.0)",
      "date_published": "2026-01-05T10:30:00Z"
    }
  ]
}
```

## Advantages of RSS

- **No server required** - Works with the API directly
- **Privacy** - No webhook URLs to expose
- **Aggregation** - Combine with other feeds
- **Offline** - Many readers cache content
- **Universal** - Works with any RSS reader

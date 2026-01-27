# Extended Tools Reference

Additional Sperax tools for agents, news, plugins, and portfolio.

!!! info "Looking for something else?"
    - **USDs, SPA, veSPA, Demeter tools?** → [Core Tools](tools.md)
    - **General blockchain operations?** → [EVM Module](evm-module.md)
    - **AI prompts and resources?** → [Resources & Prompts](resources-prompts.md)

---

## Portfolio Tools

Aggregate view of user's complete Sperax protocol position.

### portfolio_get_summary

Get complete portfolio summary including all Sperax positions.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address (0x...) |

**Returns:**
```json
{
  "usds": {
    "balance": "10000.00",
    "isRebasing": true,
    "estimatedApr": "5.25"
  },
  "spa": {
    "balance": "50000.00"
  },
  "vespa": {
    "locked": "25000.00",
    "votingPower": "80000.00",
    "unlockDate": "2027-01-01"
  },
  "xspa": {
    "balance": "10000.00",
    "pendingRedemption": "5000.00"
  },
  "totalValueUsd": "95250.00"
}
```

---

### portfolio_get_yield_summary

Get all yield sources for a user.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |

**Returns:**
```json
{
  "usdsRebase": {
    "apr": "5.25",
    "dailyYield": "1.44"
  },
  "farmRewards": [
    {
      "farm": "USDs-USDC LP",
      "pendingRewards": "150.00",
      "apr": "25.5"
    }
  ],
  "totalDailyYield": "5.50"
}
```

---

### portfolio_get_health

Assess portfolio health and risk.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |

**Returns:**
```json
{
  "healthScore": 85,
  "diversification": "good",
  "risks": [
    "High concentration in veSPA lock"
  ],
  "recommendations": [
    "Consider diversifying into Demeter farms"
  ]
}
```

---

## DeFi Agents Tools

Access 58+ production-ready AI agent definitions for DeFi workflows.

**API:** https://sperax.click

### agents_list

List all available DeFi agents.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| category | string | No | Filter by category |
| locale | string | No | Language (default: en-US) |

**Categories:**
- `sperax` - Sperax protocol agents
- `defi` - General DeFi
- `trading` - Trading strategies
- `portfolio` - Portfolio management
- `security` - Security analysis
- `analytics` - Data analytics
- `education` - Learning guides
- `research` - Market research
- `governance` - DAO governance
- `yield` - Yield optimization
- `nft` - NFT operations

**Returns:**
```json
{
  "agents": [
    {
      "identifier": "usds-yield-optimizer",
      "title": "USDs Yield Optimizer",
      "description": "Maximize your USDs yield",
      "category": "sperax",
      "tags": ["yield", "usds", "optimization"]
    }
  ],
  "totalCount": 58
}
```

---

### agents_get

Get full agent definition and configuration.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| identifier | string | Yes | Agent identifier |
| locale | string | No | Language (default: en-US) |

**Returns:**
```json
{
  "identifier": "usds-yield-optimizer",
  "meta": {
    "title": "USDs Yield Optimizer",
    "description": "Maximize your USDs yield through smart allocation",
    "avatar": "https://...",
    "tags": ["yield", "usds"]
  },
  "config": {
    "systemRole": "You are a yield optimization expert...",
    "openingMessage": "Hi! I can help you maximize your USDs yield.",
    "openingQuestions": [
      "What's my current yield?",
      "How can I earn more?"
    ]
  }
}
```

---

### agents_search

Search agents by keyword.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | Search query |
| limit | number | No | Max results (default: 10) |

---

### agents_get_categories

List all agent categories with counts.

---

## Crypto News Tools

Real-time crypto news from 7 major sources.

**API:** https://free-crypto-news.vercel.app

**Sources:**
| Source | Category | Emoji |
|--------|----------|-------|
| CoinDesk | General | 🟠 |
| The Block | General | 🔵 |
| Decrypt | General | 🟢 |
| CoinTelegraph | General | 🟡 |
| Bitcoin Magazine | Bitcoin | 🟤 |
| Blockworks | General | 🟣 |
| The Defiant | DeFi | 🔴 |

---

### news_get_latest

Get latest crypto news.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | number | No | Max articles (default: 10) |
| source | string | No | Filter by source |

**Returns:**
```json
{
  "articles": [
    {
      "title": "Bitcoin Hits New All-Time High",
      "source": "CoinDesk",
      "link": "https://...",
      "pubDate": "2026-01-06T12:00:00Z",
      "timeAgo": "2 hours ago"
    }
  ],
  "totalCount": 50
}
```

---

### news_get_by_source

Get news from a specific source.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| source | string | Yes | Source key (coindesk, theblock, etc.) |
| limit | number | No | Max articles |

---

### news_search

Search news by keyword.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | Search query |
| limit | number | No | Max results |

---

### news_get_sources

List all available news sources.

---

### news_get_defi

Get DeFi-specific news (from The Defiant + filtered).

---

## Plugin Tools

Access AI function call plugins from SperaxOS marketplace.

**API:** https://plugin.delivery

---

### plugins_list

List all available plugins.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| category | string | No | Filter by category |

**Categories:**
- `stocks-finance` - Financial tools
- `developer` - Dev tools
- `information` - Info retrieval
- `media-generate` - Media creation
- `science-education` - Educational
- `gaming` - Gaming tools
- `lifestyle` - Lifestyle apps

**Returns:**
```json
{
  "plugins": [
    {
      "identifier": "token-price-checker",
      "meta": {
        "title": "Token Price Checker",
        "description": "Check real-time token prices",
        "category": "stocks-finance"
      },
      "api": [
        {
          "name": "getPrice",
          "description": "Get token price"
        }
      ]
    }
  ]
}
```

---

### plugins_get

Get plugin manifest and API details.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| identifier | string | Yes | Plugin identifier |

---

### plugins_execute

Execute a plugin API function.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| identifier | string | Yes | Plugin identifier |
| apiName | string | Yes | API function name |
| params | object | No | Function parameters |

**Returns:**
```json
{
  "success": true,
  "data": {
    "price": "42000.00",
    "currency": "USD"
  }
}
```

---

### plugins_search

Search plugins by keyword.

---

### plugins_get_categories

List plugin categories with counts.

---

## What's Next?

<div class="grid cards" markdown>

-   :material-wrench:{ .lg .middle } **Core Tools**

    ---

    USDs, SPA, veSPA, Demeter, and Vault tools

    [:octicons-arrow-right-24: Tools Reference](tools.md)

-   :material-file-document-outline:{ .lg .middle } **Resources & Prompts**

    ---

    Built-in AI resources and prompt templates

    [:octicons-arrow-right-24: Resources](resources-prompts.md)

-   :material-code-braces:{ .lg .middle } **Development**

    ---

    Add your own tools and contribute

    [:octicons-arrow-right-24: Dev Guide](development.md)

</div>

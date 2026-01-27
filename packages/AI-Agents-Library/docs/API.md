# API Documentation

Programmatic access to the AI Agents Library agent marketplace index.

---

## Base URL

```
https://nirholas.github.io/AI-Agents-Library/
```

## Endpoints

### Main Index

```
GET /index.json
```

Returns the complete agent index with all 505+ agents.

**Response Format:**

```json
{
  "agents": [
    {
      "author": "string",
      "identifier": "string",
      "meta": {
        "title": "string",
        "description": "string",
        "avatar": "string",
        "tags": ["string"],
        "systemRole": "string"
      },
      "schemaVersion": 1,
      "createAt": "ISO date string"
    }
  ]
}
```

**Example:**

```bash
curl https://nirholas.github.io/AI-Agents-Library/index.json
```

---

### Individual Agent (English)

```
GET /{agent-identifier}.json
```

Returns single agent data in English.

**Example:**

```bash
curl https://nirholas.github.io/AI-Agents-Library/defi-yield-optimizer.json
```

**Response:**

```json
{
  "author": "username",
  "config": {
    "systemRole": "You are a DeFi yield optimization specialist..."
  },
  "createAt": "2024-01-15",
  "identifier": "defi-yield-optimizer",
  "meta": {
    "title": "DeFi Yield Optimizer",
    "description": "Analyzes yield farming opportunities...",
    "avatar": "🌾",
    "tags": ["defi", "yield", "analytics"],
    "systemRole": "agent"
  },
  "schemaVersion": 1
}
```

---

### Localized Agent

```
GET /{agent-identifier}.{locale}.json
```

Returns agent in specific language.

**Supported Locales:**

- `en-US` - English
- `zh-CN` - Simplified Chinese
- `zh-TW` - Traditional Chinese
- `ja-JP` - Japanese
- `ko-KR` - Korean
- `de-DE` - German
- `fr-FR` - French
- `es-ES` - Spanish
- `ru-RU` - Russian
- `ar` - Arabic
- `pt-BR` - Portuguese (Brazil)
- `it-IT` - Italian
- `nl-NL` - Dutch
- `pl-PL` - Polish
- `tr-TR` - Turkish
- `vi-VN` - Vietnamese
- `fa-IR` - Persian
- `bg-BG` - Bulgarian

**Example:**

```bash
curl https://nirholas.github.io/AI-Agents-Library/defi-yield-optimizer.zh-CN.json
```

---

## Use Cases

### 1. Build Custom Marketplace

```javascript
// Fetch all agents
const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
const data = await response.json();

// Filter by category
const defiAgents = data.agents.filter((agent) => agent.meta.tags.includes('defi'));

// Display in your UI
defiAgents.forEach((agent) => {
  console.log(`${agent.meta.avatar} ${agent.meta.title}`);
  console.log(agent.meta.description);
});
```

### 2. Search Agents

```javascript
function searchAgents(query) {
  return fetch('https://nirholas.github.io/AI-Agents-Library/index.json')
    .then((r) => r.json())
    .then((data) =>
      data.agents.filter(
        (agent) =>
          agent.meta.title.toLowerCase().includes(query.toLowerCase()) ||
          agent.meta.description.toLowerCase().includes(query.toLowerCase()) ||
          agent.meta.tags.some((tag) => tag.includes(query.toLowerCase())),
      ),
    );
}

// Usage
searchAgents('yield').then((results) => console.log(results));
```

### 3. Load Agent by ID

```javascript
async function loadAgent(identifier, locale = 'en-US') {
  const filename = locale === 'en-US' ? `${identifier}.json` : `${identifier}.${locale}.json`;

  const response = await fetch(`https://nirholas.github.io/AI-Agents-Library/${filename}`);
  return response.json();
}

// Usage
const agent = await loadAgent('defi-yield-optimizer', 'zh-CN');
console.log(agent.config.systemRole);
```

### 4. Filter by Tags

```javascript
async function getAgentsByTag(tag) {
  const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
  const data = await response.json();

  return data.agents.filter((agent) => agent.meta.tags.includes(tag));
}

// Get all trading agents
const tradingAgents = await getAgentsByTag('trading');
```

### 5. Get Random Agent

```javascript
async function getRandomAgent() {
  const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
  const data = await response.json();

  const random = Math.floor(Math.random() * data.agents.length);
  return data.agents[random];
}
```

### 6. Analytics

```javascript
async function getMarketplaceStats() {
  const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
  const data = await response.json();

  const stats = {
    totalAgents: data.agents.length,
    tags: {},
    authors: new Set(),
    recentAgents: [],
  };

  data.agents.forEach((agent) => {
    // Count tags
    agent.meta.tags.forEach((tag) => {
      stats.tags[tag] = (stats.tags[tag] || 0) + 1;
    });

    // Unique authors
    stats.authors.add(agent.author);
  });

  // Sort agents by creation date
  stats.recentAgents = data.agents
    .sort((a, b) => new Date(b.createAt) - new Date(a.createAt))
    .slice(0, 10);

  stats.authors = stats.authors.size;

  return stats;
}
```

---

## Data Schema

### Agent Object

```typescript
interface Agent {
  author: string; // GitHub username
  identifier: string; // Unique ID (URL-safe)
  meta: {
    title: string; // Display name
    description: string; // Brief description
    avatar: string; // Single emoji
    tags: string[]; // 3-8 keywords
    systemRole?: string; // Optional role type
  };
  schemaVersion: 1; // Always 1
  config: {
    systemRole: string; // Full system prompt
  };
  createAt: string; // ISO date
}
```

### Index Response

```typescript
interface IndexResponse {
  agents: Agent[];
}
```

---

## Rate Limits

**GitHub Pages:**

- No authentication required
- Generous rate limits (soft limit \~10 requests/second)
- Cached via CDN
- Free for all use cases

**Best Practices:**

- Cache index.json locally
- Don't fetch on every page load
- Use conditional requests (ETag/If-Modified-Since)
- Respect GitHub's infrastructure

---

## CORS

All endpoints support CORS. You can make requests from any domain.

```javascript
// Works from any origin
fetch('https://nirholas.github.io/AI-Agents-Library/index.json')
  .then((r) => r.json())
  .then((data) => console.log(data));
```

---

## Caching

**Recommended strategy:**

```javascript
class AgentCache {
  constructor(ttl = 3600000) {
    // 1 hour default
    this.cache = null;
    this.timestamp = null;
    this.ttl = ttl;
  }

  async getAgents() {
    const now = Date.now();

    // Return cached if fresh
    if (this.cache && now - this.timestamp < this.ttl) {
      return this.cache;
    }

    // Fetch fresh data
    const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
    this.cache = await response.json();
    this.timestamp = now;

    return this.cache;
  }

  invalidate() {
    this.cache = null;
    this.timestamp = null;
  }
}

// Usage
const cache = new AgentCache();
const agents = await cache.getAgents();
```

---

## Error Handling

```javascript
async function safeLoadAgent(identifier) {
  try {
    const response = await fetch(`https://nirholas.github.io/AI-Agents-Library/${identifier}.json`);

    if (!response.ok) {
      throw new Error(`Agent not found: ${identifier}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to load agent:', error);
    return null;
  }
}
```

---

## Example Projects

### CLI Tool

```javascript
#!/usr/bin/env node
const https = require('https');

function searchAgents(query) {
  https.get('https://nirholas.github.io/AI-Agents-Library/index.json', (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      const agents = JSON.parse(data).agents;
      const results = agents.filter((a) =>
        a.meta.title.toLowerCase().includes(query.toLowerCase()),
      );

      results.forEach((agent) => {
        console.log(`${agent.meta.avatar} ${agent.meta.title}`);
        console.log(`   ${agent.meta.description}`);
        console.log();
      });
    });
  });
}

searchAgents(process.argv[2]);
```

### React Component

```jsx
import { useEffect, useState } from 'react';

function AgentList({ tag }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://nirholas.github.io/AI-Agents-Library/index.json')
      .then((r) => r.json())
      .then((data) => {
        const filtered = tag ? data.agents.filter((a) => a.meta.tags.includes(tag)) : data.agents;
        setAgents(filtered);
        setLoading(false);
      });
  }, [tag]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {agents.map((agent) => (
        <div key={agent.identifier}>
          <h3>
            {agent.meta.avatar} {agent.meta.title}
          </h3>
          <p>{agent.meta.description}</p>
          <div>
            {agent.meta.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Updates

The index is updated automatically when new agents are merged to main branch:

- New agents appear within 24 hours
- Updates to existing agents reflect immediately
- No API versioning (backwards compatible changes only)

---

## Support

- Issues: github.com/nirholas/AI-Agents-Library/issues
- Discord: \[Join community]

---

## License

Agent data is MIT licensed. Free for commercial and personal use.

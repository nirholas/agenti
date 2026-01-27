---
name: "api-integration"
description: "Connect Lyra Intel MCP server to REST API backend"
---

# API Integration Guide

Connect your MCP server to the Lyra Intel REST API backend.

## Environment Configuration

### 1. Create `.env.local` in MCP Server

```bash
cd /workspaces/lyra-intel/mcp-server
cat > .env.local << 'EOF'
# Lyra Intel API Configuration
LYRA_API_URL=http://localhost:3000
LYRA_API_KEY=your-api-key-here
LYRA_API_TIMEOUT=60000
LYRA_API_RETRY_ATTEMPTS=3

# Optional: Authentication
LYRA_API_AUTH_TYPE=bearer  # or api-key, basic
LYRA_API_AUTH_TOKEN=your-token-here

# Optional: Proxy
LYRA_HTTP_PROXY=http://proxy.example.com:8080
LYRA_HTTPS_PROXY=https://proxy.example.com:8080

# Optional: TLS
LYRA_API_INSECURE=false
LYRA_API_CA_CERT=/path/to/ca.crt

# Features
LYRA_ENABLE_CACHING=true
LYRA_CACHE_TTL=3600
LYRA_ENABLE_TELEMETRY=true
EOF
```

### 2. Load Environment Variables

Update `src/index.ts`:

```typescript
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fall back to global .env

// Validate required variables
const requiredVars = ['LYRA_API_URL'];
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.warn(`⚠️  Missing environment variable: ${varName}`);
  }
}
```

## API Client Implementation

### 1. Create API Client Module

Create `src/api/client.ts`:

```typescript
import fetch from 'node-fetch';
import { z } from 'zod';

const API_URL = process.env.LYRA_API_URL || 'http://localhost:3000';
const API_KEY = process.env.LYRA_API_KEY;
const TIMEOUT = parseInt(process.env.LYRA_API_TIMEOUT || '60000');

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeout?: number;
  retries?: number;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, timeout = TIMEOUT, retries = 3 } = options;
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Lyra-Intel-MCP/1.0',
  };

  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `API error: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error as Error;

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(
          `API request failed (attempt ${attempt + 1}), retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `API request failed after ${retries} attempts: ${lastError?.message}`
  );
}

// Export API methods
export const lyraAPI = {
  analyzeCodbase: async (path: string, options: any) =>
    request('/api/analyze', { method: 'POST', body: { path, ...options } }),

  searchCode: async (query: string, options: any) =>
    request('/api/search', { method: 'POST', body: { query, ...options } }),

  getComplexity: async (files: string[]) =>
    request('/api/complexity', { method: 'POST', body: { files } }),

  getSecurityIssues: async (path: string, filters: any) =>
    request('/api/security', { method: 'POST', body: { path, ...filters } }),

  getHealth: async () => request('/api/health'),
};
```

### 2. Update Analysis Tools

Modify `src/tools/analysis.ts`:

```typescript
import { lyraAPI } from '../api/client';

// Inside analyzeCodebaseTool
const result = await lyraAPI.analyzeCodbase(args.path, {
  depth: args.depth,
  includeMetrics: true,
  includeDependencies: true,
  includeSecurityRisks: true,
});

onProgress?.({
  type: 'progress',
  data: {
    status: 'API call completed',
    percentage: 100,
  },
});

return {
  content: [
    {
      type: 'text',
      text: JSON.stringify(result, null, 2),
    },
  ],
};
```

## Startup Verification

### 1. Health Check

Update `src/index.ts`:

```typescript
import { lyraAPI } from './api/client';

// On startup, verify API connectivity
async function verifyApiConnection() {
  try {
    const health = await lyraAPI.getHealth();
    console.log('✅ Connected to Lyra Intel API');
    console.log(`   Version: ${health.version}`);
    console.log(`   Status: ${health.status}`);
  } catch (error) {
    console.warn('⚠️  Lyra Intel API not available');
    console.warn(`   Error: ${(error as Error).message}`);
    console.warn('   Running in simulation mode');
  }
}

// Call on server startup
verifyApiConnection();
```

### 2. Test Configuration

```bash
cd /workspaces/lyra-intel/mcp-server

# Build
npm run build

# Test with local backend
LYRA_API_URL=http://localhost:3000 npm start
```

## Authentication Methods

### API Key Authentication

```typescript
// In .env.local
LYRA_API_AUTH_TYPE=api-key
LYRA_API_AUTH_TOKEN=sk_live_1234567890

// In client.ts
if (authType === 'api-key') {
  headers['X-API-Key'] = authToken;
}
```

### Bearer Token (OAuth2)

```typescript
// In .env.local
LYRA_API_AUTH_TYPE=bearer
LYRA_API_AUTH_TOKEN=eyJhbGc...

// In client.ts (already implemented)
headers['Authorization'] = `Bearer ${API_KEY}`;
```

### Basic Auth

```typescript
// In .env.local
LYRA_API_AUTH_TYPE=basic
LYRA_API_USERNAME=user
LYRA_API_PASSWORD=pass

// In client.ts
if (authType === 'basic') {
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  headers['Authorization'] = `Basic ${encoded}`;
}
```

## Error Handling

### Retry Strategy

```typescript
// Exponential backoff with jitter
function calculateBackoff(attempt: number): number {
  const exponential = Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return exponential * 1000 + jitter;
}

// Retry on specific errors
const retryableErrors = [
  408, // Request Timeout
  429, // Too Many Requests
  503, // Service Unavailable
  504, // Gateway Timeout
];
```

### Error Recovery

```typescript
try {
  result = await lyraAPI.analyzeCodbase(path, options);
} catch (error) {
  if (isNetworkError(error)) {
    return {
      content: [
        {
          type: 'text',
          text: 'API unavailable. Running local analysis instead...',
        },
      ],
      isError: true,
    };
  }
  throw error;
}
```

## Response Caching

### Implement Redis Cache

```typescript
import redis from 'redis';

const cache = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

async function cachedRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 3600
): Promise<T> {
  // Check cache
  const cached = await cache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch
  const result = await fetcher();

  // Store
  await cache.setEx(key, ttl, JSON.stringify(result));

  return result;
}
```

## Rate Limiting

### Client-Side Rate Limiting

```typescript
class RateLimiter {
  private requests: number[] = [];
  private limit: number;
  private window: number;

  constructor(requestsPerSecond: number) {
    this.limit = requestsPerSecond;
    this.window = 1000;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.window);

    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      const waitTime = this.window - (now - oldestRequest);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.requests.push(now);
  }
}

const limiter = new RateLimiter(10); // 10 requests/second
```

## Monitoring and Telemetry

### Collect Metrics

```typescript
interface RequestMetrics {
  endpoint: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
}

const metrics: RequestMetrics[] = [];

async function trackRequest<T>(
  endpoint: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fetcher();
    const duration = Date.now() - start;

    metrics.push({
      endpoint,
      duration,
      statusCode: 200,
      timestamp: new Date(),
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    metrics.push({
      endpoint,
      duration,
      statusCode: 500,
      timestamp: new Date(),
    });
    throw error;
  }
}
```

### Export Metrics

```typescript
app.get('/metrics', (_req, res) => {
  const stats = {
    totalRequests: metrics.length,
    averageDuration:
      metrics.reduce((a, b) => a + b.duration, 0) / metrics.length,
    errorRate:
      metrics.filter((m) => m.statusCode >= 400).length / metrics.length,
    lastUpdated: new Date(),
  };

  res.json(stats);
});
```

## Testing

### Mock API for Development

```typescript
// src/api/__mocks__/client.ts
export const lyraAPI = {
  analyzeCodbase: async () => ({
    files: 42,
    dependencies: 15,
    complexity: { average: 7.2, max: 28 },
  }),

  searchCode: async () => ({
    matches: [{ file: 'src/index.ts', line: 42, score: 0.95 }],
  }),

  getComplexity: async () => ({
    violations: [{ function: 'process', complexity: 18 }],
  }),

  getSecurityIssues: async () => ({
    issues: [{ type: 'sql_injection', severity: 'critical' }],
  }),
};
```

### Integration Tests

```typescript
describe('API Integration', () => {
  it('should handle API timeout gracefully', async () => {
    const result = await analyzeCodbase(
      '/test/path',
      { depth: 'quick' },
      null
    );
    expect(result.isError).toBe(false);
  });

  it('should retry on network error', async () => {
    // Mock fetch to fail twice, then succeed
    let attempts = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Network error');
      return { ok: true, json: async () => ({ success: true }) } as any;
    });

    const result = await lyraAPI.getHealth();
    expect(attempts).toBe(3);
  });
});
```

## Deployment

### Docker Environment Variables

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY mcp-server/ .
RUN npm install && npm run build

# Environment variables from host
ENV LYRA_API_URL=http://lyra-backend:3000
ENV LYRA_API_KEY=production-key
ENV LYRA_API_TIMEOUT=60000

CMD ["npm", "start"]
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: lyra-intel-mcp
data:
  LYRA_API_URL: http://lyra-backend-service:3000
  LYRA_API_TIMEOUT: "60000"
  LYRA_ENABLE_CACHING: "true"
---
apiVersion: v1
kind: Secret
metadata:
  name: lyra-intel-mcp
type: Opaque
stringData:
  LYRA_API_KEY: production-key-here
```

## Troubleshooting

### Connection Issues

```bash
# Test connectivity
curl -v http://localhost:3000/api/health

# Check logs
npm start 2>&1 | grep -i "api\|error\|connection"

# Verify environment
echo $LYRA_API_URL
echo $LYRA_API_KEY
```

### Performance Issues

```bash
# Enable debug logging
DEBUG=lyra:* npm start

# Check response times
npm start | grep "duration"

# Profile
node --prof dist/index.js
node --prof-process isolate-*.log > profile.txt
```

### API Errors

```
401 Unauthorized → Check LYRA_API_KEY
403 Forbidden → Verify API key permissions
429 Too Many Requests → Enable caching, reduce request rate
503 Service Unavailable → Backend is down, check logs
504 Gateway Timeout → Increase LYRA_API_TIMEOUT
```

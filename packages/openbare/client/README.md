# @openbare/client

A multi-server proxy client for OpenBare with automatic failover, load balancing, and health monitoring.

## Features

- 🔄 **Automatic Failover** - Seamlessly switch to backup servers on failure
- ⚡ **Smart Load Balancing** - Fastest-first, round-robin, or priority-based selection
- 🏥 **Health Monitoring** - Automatic server health checks and latency tracking
- 🔍 **Auto-Discovery** - Fetch public nodes from registry
- 🌐 **Universal** - Works in both browser and Node.js environments
- 📝 **TypeScript Ready** - Full type definitions included

## Installation

```bash
# Install from GitHub (recommended for now)
npm install github:nirholas/openbare#main

# Or clone and link locally
git clone https://github.com/nirholas/openbare.git
cd openbare/client
npm link
```

## Quick Start

```javascript
import { OpenBareClient } from '@openbare/client';

// Create client with multiple servers
const client = new OpenBareClient({
  servers: [
    'https://bare1.example.com',
    'https://bare2.example.com',
    'https://bare3.example.com'
  ],
  timeout: 5000,
  retries: 3
});

// Automatically uses fastest available server
const response = await client.fetch('https://example.com');
const text = await response.text();
console.log(text);
```

## Configuration Options

```javascript
const client = new OpenBareClient({
  // Initial server URLs
  servers: ['https://bare1.example.com'],
  
  // Request timeout in milliseconds
  timeout: 30000,
  
  // Maximum retry attempts
  retries: 3,
  
  // Server selection strategy: 'fastest', 'round-robin', or 'priority'
  strategy: 'fastest',
  
  // Enable automatic health checks
  autoHealthCheck: true,
  
  // Health check interval in milliseconds
  healthCheckInterval: 30000,
  
  // Registry URL for auto-discovery
  registryUrl: 'https://registry.openbare.org/api/v1/nodes',
  
  // Enable automatic server discovery
  autoDiscover: false
});
```

## API Reference

### OpenBareClient

#### `constructor(options?)`

Create a new OpenBare client instance.

#### `addServer(url, priority?)`

Add a server to the pool.

```javascript
client.addServer('https://bare4.example.com', 5);
```

#### `removeServer(url)`

Remove a server from the pool.

```javascript
client.removeServer('https://bare4.example.com');
```

#### `fetch(url, options?)`

Perform a proxied fetch with automatic failover.

```javascript
const response = await client.fetch('https://api.example.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key: 'value' }),
  timeout: 10000,
  retries: 5
});
```

#### `testServer(url)`

Test a specific server's latency.

```javascript
const result = await client.testServer('https://bare1.example.com');
console.log(result); // { ok: true, latency: 45 }
```

#### `testAllServers()`

Test all servers and get sorted results.

```javascript
const results = await client.testAllServers();
// Returns array sorted by latency:
// [
//   { url: 'https://bare1.example.com', ok: true, latency: 45 },
//   { url: 'https://bare2.example.com', ok: true, latency: 120 },
//   { url: 'https://bare3.example.com', ok: false, latency: -1 }
// ]
```

#### `getHealthyServers()`

Get all currently healthy servers.

```javascript
const healthy = client.getHealthyServers();
// [{ url: '...', latency: 45, priority: 10 }, ...]
```

#### `setFallbackOrder(urls)`

Set the priority order for failover.

```javascript
client.setFallbackOrder([
  'https://primary.example.com',
  'https://secondary.example.com',
  'https://tertiary.example.com'
]);
```

#### `getStats()`

Get pool statistics.

```javascript
const stats = client.getStats();
// { total: 3, healthy: 2, unhealthy: 1, avgLatency: 82, strategy: 'fastest' }
```

#### `discover(registryUrl?)`

Discover servers from a registry.

```javascript
const servers = await client.discover();
console.log(servers); // ['https://node1.openbare.org', ...]
```

#### `destroy()`

Clean up resources and stop background tasks.

```javascript
client.destroy();
```

## Server Selection Strategies

### Fastest (Default)

Selects the server with the lowest measured latency.

```javascript
const client = new OpenBareClient({
  strategy: 'fastest'
});
```

### Round-Robin

Distributes requests evenly across all healthy servers.

```javascript
const client = new OpenBareClient({
  strategy: 'round-robin'
});
```

### Priority

Always uses the highest priority server that's healthy.

```javascript
const client = new OpenBareClient({
  strategy: 'priority'
});

client.addServer('https://primary.example.com', 1);   // Highest priority
client.addServer('https://secondary.example.com', 2);
client.addServer('https://backup.example.com', 10);   // Lowest priority
```

## Auto-Discovery

Automatically discover and add servers from a registry:

```javascript
const client = new OpenBareClient({
  registryUrl: 'https://registry.openbare.org/api/v1/nodes',
  autoDiscover: true
});

// Or discover manually
await client.discover();
```

## Using the Discovery Module Directly

```javascript
import { Discovery, KNOWN_REGISTRIES } from '@openbare/client';

const discovery = new Discovery({
  registryUrl: KNOWN_REGISTRIES.default,
  autoRefresh: true,
  refreshInterval: 300000 // 5 minutes
});

// Fetch nodes
const nodes = await discovery.fetchNodes();

// Filter by region
const usNodes = discovery.getNodesByRegion('us-east');

// Get only verified nodes
const verified = discovery.getVerifiedNodes();

// Listen for updates
discovery.onUpdate((nodes) => {
  console.log('Nodes updated:', nodes.length);
});
```

## URL Encoding (Codec)

```javascript
import { encodeUrl, decodeUrl, xor } from '@openbare/client';

// Encode a URL
const encoded = encodeUrl('https://example.com');

// Decode it back
const decoded = decodeUrl(encoded);

// XOR encode with custom key
const xored = xor('hello', 42);
```

## Error Handling

```javascript
import { OpenBareClient, BareError } from '@openbare/client';

const client = new OpenBareClient({ servers: ['https://bare.example.com'] });

try {
  const response = await client.fetch('https://example.com');
} catch (error) {
  if (error instanceof BareError) {
    switch (error.code) {
      case 'ALL_SERVERS_FAILED':
        console.error('No servers available');
        break;
      case 'TIMEOUT':
        console.error('Request timed out');
        break;
      case 'INVALID_URL':
        console.error('Invalid target URL');
        break;
      default:
        console.error('Bare error:', error.message);
    }
  }
}
```

## Browser Usage

```html
<script type="module">
  import { OpenBareClient } from './node_modules/@openbare/client/src/index.js';
  
  const client = new OpenBareClient({
    servers: ['https://bare.example.com']
  });
  
  const response = await client.fetch('https://api.example.com/data');
  console.log(await response.json());
</script>
```

## Node.js Usage

```javascript
import { OpenBareClient } from '@openbare/client';

const client = new OpenBareClient({
  servers: ['https://bare.example.com'],
  timeout: 10000
});

const response = await client.fetch('https://api.example.com/data');
const data = await response.json();
console.log(data);
```

## TypeScript

Full TypeScript support is included:

```typescript
import { OpenBareClient, OpenBareClientOptions, BareResponse } from '@openbare/client';

const options: OpenBareClientOptions = {
  servers: ['https://bare.example.com'],
  timeout: 5000
};

const client = new OpenBareClient(options);

const response: BareResponse = await client.fetch('https://example.com');
```

## License

MIT

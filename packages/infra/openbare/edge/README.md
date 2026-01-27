# OpenBare Edge - Cloudflare Workers

A high-performance Cloudflare Workers implementation of the TompHTTP Bare Server Protocol v3. This edge server provides global, low-latency proxy capabilities with automatic scaling.

## Features

- **TompHTTP Bare Protocol v3** - Full protocol compliance
- **Global Edge Network** - Deploy to 300+ Cloudflare locations
- **WebSocket Support** - Full bidirectional WebSocket proxying
- **Automatic Scaling** - No server management required
- **Header Stripping** - Removes X-Frame-Options, CSP, and other security headers
- **CORS Support** - Full cross-origin request handling
- **Error Handling** - Comprehensive error responses with tracking IDs

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Cloudflare account](https://dash.cloudflare.com/sign-up)

### Installation

```bash
cd openbare/edge
npm install
```

### Login to Cloudflare

```bash
npm run login
# or
npx wrangler login
```

This will open your browser to authenticate with Cloudflare.

### Local Development

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`

### Deploy to Cloudflare

```bash
npm run deploy
```

Your worker will be available at `https://openbare-edge.<your-subdomain>.workers.dev`

## Configuration

### Environment Variables

Edit `wrangler.toml` to configure:

```toml
[vars]
BARE_VERSION = "3"
MAX_PAYLOAD_SIZE = "104857600"  # 100MB
```

### Custom Domain Setup

1. **Add your domain to Cloudflare**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Add your domain and update nameservers

2. **Configure routes in wrangler.toml**
   ```toml
   routes = [
     { pattern = "bare.yourdomain.com/*", zone_name = "yourdomain.com" }
   ]
   ```

3. **Deploy with custom domain**
   ```bash
   npm run deploy:production
   ```

## API Endpoints

### Health Check
```
GET /
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "openbare-edge",
  "version": "3",
  "edge_location": "SJC",
  "cf_ray": "abc123-SJC",
  "country": "US",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Server Info
```
GET /bare/
```

Response:
```json
{
  "versions": ["v1", "v2", "v3"],
  "language": "Cloudflare Workers",
  "project": {
    "name": "openbare-edge",
    "version": "1.0.0"
  }
}
```

### Bare v3 Proxy
```
[ANY METHOD] /bare/v3/

Headers:
  x-bare-url: https://example.com/path
  x-bare-headers: {"User-Agent": "Mozilla/5.0..."}
```

Response includes:
```
x-bare-status: 200
x-bare-status-text: OK
x-bare-headers: {"content-type": "text/html", ...}
```

## Bare Protocol Headers

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `x-bare-url` | Yes | Target URL to fetch |
| `x-bare-headers` | No | JSON object of headers to send |
| `x-bare-forward-headers` | No | Headers to forward from original request |
| `x-bare-pass-headers` | No | Response headers to pass through |
| `x-bare-protocol` | No* | Protocol (http:/https:) |
| `x-bare-host` | No* | Target host |
| `x-bare-port` | No* | Target port |
| `x-bare-path` | No* | Target path |

*Alternative to `x-bare-url`

### Response Headers

| Header | Description |
|--------|-------------|
| `x-bare-status` | HTTP status code from target |
| `x-bare-status-text` | HTTP status text from target |
| `x-bare-headers` | JSON object of response headers |

## WebSocket Support

WebSocket connections are supported through the same endpoint:

```javascript
const ws = new WebSocket('wss://your-worker.workers.dev/bare/v3/');
// Include bare headers in the connection
```

## Deployment Environments

### Staging
```bash
npm run deploy:staging
```
Deploys to `openbare-edge-staging.*.workers.dev`

### Production
```bash
npm run deploy:production
```
Deploys to your configured production routes

## Monitoring

### View Logs
```bash
npm run tail
```

### Cloudflare Dashboard
- [Workers Analytics](https://dash.cloudflare.com/?to=/:account/workers/analytics)
- View requests, errors, and performance metrics

## Troubleshooting

### Common Issues

**"Error: No account ID found"**
```bash
npx wrangler whoami
# Make sure you're logged in
npx wrangler login
```

**"Error: Workers Site not found"**
```bash
# Update wrangler
npm update wrangler
```

**WebSocket connections failing**
- Ensure target supports WebSockets
- Check for firewall/proxy issues
- Verify the target URL is correct

### Debug Mode

Run with verbose logging:
```bash
WRANGLER_LOG=debug npm run dev
```

## Security Considerations

- This server strips security headers to allow embedding
- Intended for development and specific use cases
- Consider rate limiting for production use
- Monitor for abuse through Cloudflare dashboard

## Limits

Cloudflare Workers have the following limits:

| Limit | Free | Paid |
|-------|------|------|
| Requests/day | 100,000 | Unlimited |
| CPU time | 10ms | 50ms (30s for Unbound) |
| Memory | 128MB | 128MB |
| Subrequest | 50 | 1000 |

## License

MIT License - See [LICENSE](../../license.md) for details.

## Related

- [OpenBare Server](../server/) - Node.js bare server
- [OpenBare Client](../client/) - JavaScript client library
- [TompHTTP Bare Server Spec](https://github.com/tomphttp/specifications)

# Deployment Guide

This guide covers deploying Agenti in various environments for production use.

## Deployment Options

### 1. Local (Development)

```bash
npm run dev
```

Runs with hot-reload via `tsx --watch`. Suitable for development and testing.

### 2. npm Package (Recommended for AI Clients)

```bash
npx @nirholas/agenti
```

The simplest deployment method. AI clients like Claude Desktop and Cursor can invoke this directly.

### 3. Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js", "--http"]
```

```bash
docker build -t agenti .
docker run -p 3000:3000 --env-file .env agenti
```

### 4. Cloud Platforms

#### Railway / Render / Fly.io

```bash
# Set environment variables in the platform dashboard
# Deploy with HTTP mode for cloud hosting
npm start -- --http
```

#### AWS Lambda / Vercel Functions

Not recommended - MCP requires persistent connections. Use HTTP mode on a long-running server instead.

## Production Configuration

### Environment Variables

```env
# Required
PRIVATE_KEY=0x...
NODE_ENV=production

# Server (HTTP/SSE modes)
PORT=3000
HOST=0.0.0.0

# RPC Endpoints (use dedicated providers for production)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Logging
LOG_LEVEL=info
```

### Security Checklist

- [ ] Use dedicated RPC endpoints (not public defaults)
- [ ] Store private keys in a secrets manager (AWS Secrets Manager, Vault)
- [ ] Enable rate limiting for HTTP/SSE modes
- [ ] Use HTTPS termination (via reverse proxy or cloud provider)
- [ ] Restrict CORS origins for HTTP mode
- [ ] Monitor transaction activity for anomalies
- [ ] Set up alerts for high gas usage
- [ ] Rotate API keys regularly

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name agenti.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## Monitoring

### Health Check

```bash
# HTTP mode health endpoint
curl http://localhost:3000/health
```

### Logging

Agenti logs to stdout in JSON format in production:

```json
{"level":"info","timestamp":"2024-01-15T12:00:00Z","message":"Tool executed","tool":"market_data_price","duration":150}
```

### Metrics to Monitor

| Metric | Alert Threshold | Description |
|--------|----------------|-------------|
| Tool execution time | > 10s | Slow tool responses |
| Error rate | > 5% | Failed tool executions |
| RPC failures | > 3/min | Blockchain connectivity issues |
| Memory usage | > 512MB | Memory leaks |
| Active connections | > 100 | Connection saturation |

## Scaling

- **Horizontal**: Run multiple instances behind a load balancer (HTTP mode)
- **Vertical**: Increase memory/CPU for heavy analytics workloads
- **Caching**: Enable Redis for shared price/data caching across instances
- **RPC**: Use dedicated RPC providers with higher rate limits

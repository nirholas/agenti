# Self-Hosting Guide

This guide covers all the ways to deploy your own OpenBare node.

## Quick Start Options

| Method | Best For | Difficulty | Cost |
|--------|----------|------------|------|
| [Cloudflare Workers](#cloudflare-workers) ⭐ | Global performance, WebSockets | Easy | Free |
| [Render](#render) | Persistent servers | Easy | Free tier |
| [Fly.io](#flyio) | Global, WebSockets | Easy | Free tier |
| [Docker](#docker) | Self-hosted | Medium | Your server |
| [Manual](#manual-installation) | Full control | Medium | Your server |

> ⚠️ **Note:** Vercel (serverless limitations) and Railway (banned dependencies) don't work well for proxy servers.

---

## Cloudflare Workers

**Recommended!** Best for global performance with <50ms latency worldwide and WebSocket support.

### Deploy

```bash
cd openbare/edge

# Install Wrangler CLI
npm install

# Login to Cloudflare
npx wrangler login

# Deploy
npx wrangler deploy
```

### Configuration

Edit `wrangler.toml`:

```toml
name = "openbare-edge"
main = "src/index.js"

[vars]
NODE_ID = "cf-worker-1"
REGION = "global"
```

### Custom Domain

```bash
npx wrangler domains add bare.yourdomain.com
```

---

## Railway

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/openbare)

### Manual Deploy

1. Fork the repository
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Select your fork
5. Set root directory to `server`
6. Add environment variables

### Environment Variables

```
PORT=8080
NODE_ID=railway-node-1
REGION=us-west
REGISTRY_URL=https://registry.openbare.dev
NODE_URL=https://your-app.railway.app
```

---

## Docker

### Using Docker Hub Image

```bash
docker run -d \
  --name openbare \
  -p 8080:8080 \
  -e NODE_ID=docker-node-1 \
  -e REGION=local \
  -e REGISTRY_URL=https://registry.openbare.dev \
  ghcr.io/nirholas/openbare:latest
```

### Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  openbare:
    image: ghcr.io/nirholas/openbare:latest
    ports:
      - "8080:8080"
    environment:
      - NODE_ID=docker-node-1
      - REGION=local
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
docker-compose up -d
```

### Building Locally

```bash
cd openbare/server
docker build -t openbare .
docker run -d -p 8080:8080 openbare
```

---

## Manual Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/nirholas/openbare.git
cd openbare/server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit configuration
nano .env
```

### Configuration

Edit `.env`:

```bash
# Required
PORT=8080
NODE_ID=my-node-1

# Recommended
REGION=us-east
NODE_URL=https://your-domain.com

# Optional - Register with network
REGISTRY_URL=https://registry.openbare.dev

# Optional - Customize
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

### Running

```bash
# Development
npm run dev

# Production
NODE_ENV=production npm start
```

### Process Manager (PM2)

```bash
# Install PM2
npm i -g pm2

# Start with PM2
pm2 start index.js --name openbare

# Auto-start on boot
pm2 startup
pm2 save
```

---

## Reverse Proxy Setup

### Nginx

```nginx
server {
    listen 80;
    server_name bare.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```
bare.yourdomain.com {
    reverse_proxy localhost:8080
}
```

---

## SSL/TLS Setup

### Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d bare.yourdomain.com
```

### Cloudflare (Origin Certificate)

1. Go to Cloudflare dashboard
2. SSL/TLS → Origin Server
3. Create Certificate
4. Install on your server

---

## Registering with the Network

To make your node discoverable:

1. Set `NODE_URL` to your public URL
2. Set `REGISTRY_URL` to the registry endpoint
3. Your node will auto-register on startup
4. Heartbeats keep it active

```bash
NODE_URL=https://bare.yourdomain.com \
REGISTRY_URL=https://registry.openbare.dev \
npm start
```

Verify registration:

```bash
curl https://registry.openbare.dev/nodes
```

---

## Monitoring

### Health Check Endpoint

```bash
curl https://your-node.com/health
```

### Metrics Endpoint

```bash
curl https://your-node.com/status
```

### Uptime Monitoring

Use services like:
- [UptimeRobot](https://uptimerobot.com)
- [Pingdom](https://pingdom.com)
- [Better Uptime](https://betteruptime.com)

Monitor endpoint: `https://your-node.com/health`

---

## Troubleshooting

### Node not registering

1. Check `NODE_URL` is publicly accessible
2. Check `REGISTRY_URL` is correct
3. Check logs for errors: `LOG_LEVEL=debug npm start`

### Rate limiting issues

Increase limits:

```bash
RATE_LIMIT_MAX=500 npm start
```

### WebSocket not working

Ensure your reverse proxy supports WebSocket upgrades (see Nginx config above).

### Memory issues

Set Node.js memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=512" npm start
```

---

## Security Recommendations

1. **Use HTTPS** - Always use SSL/TLS in production
2. **Set rate limits** - Prevent abuse
3. **Monitor logs** - Watch for suspicious activity
4. **Update regularly** - Keep dependencies updated
5. **Firewall** - Only expose necessary ports

```bash
# UFW example
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

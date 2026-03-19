# Deploy to Railway / Fly.io / Render

## Railway

The fastest path to production. Railway auto-detects the Dockerfile.

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repo
3. Add environment variables in the Railway dashboard:
   - `SETTLEMENT_PRIVATE_KEY`
   - `PAY_TO_ADDRESS`
   - `BASE_RPC_URL`
   - `MY_BACKEND_URL`
   - `MY_BACKEND_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Deploy — Railway builds from Dockerfile automatically
5. Add a custom domain in Settings → Domains

## Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch (first time)
fly launch --name x402-gateway --region iad --no-deploy

# Set secrets
fly secrets set SETTLEMENT_PRIVATE_KEY=0x...
fly secrets set PAY_TO_ADDRESS=0x...
fly secrets set BASE_RPC_URL=https://...
fly secrets set MY_BACKEND_URL=https://...
fly secrets set MY_BACKEND_API_KEY=...
fly secrets set UPSTASH_REDIS_REST_URL=https://...
fly secrets set UPSTASH_REDIS_REST_TOKEN=...

# Deploy
fly deploy

# Custom domain
fly certs create x402-api.yourdomain.com
```

Fly.io auto-detects the Dockerfile. The health check at `/health` is already configured.

### fly.toml (auto-generated, but here for reference)

```toml
app = "x402-gateway"
primary_region = "iad"

[build]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[services.http_checks]]
  interval = "30s"
  timeout = "10s"
  path = "/health"
```

## Render

1. Go to [render.com](https://render.com) and create a new Web Service
2. Connect your GitHub repo
3. Settings:
   - **Environment**: Docker
   - **Region**: Oregon (or nearest)
   - **Instance Type**: Starter ($7/mo) or higher
4. Add environment variables in the Render dashboard
5. Deploy — Render builds from Dockerfile
6. Add custom domain in Settings

## DigitalOcean App Platform

1. Create a new App from your GitHub repo
2. Select "Dockerfile" as the build method
3. Set environment variables in the App Spec
4. Deploy

## General Docker Hosting

For any platform that supports Docker containers:

```bash
# Build
docker build -t x402-gateway .

# Run
docker run -d \
  --name x402-gateway \
  -p 8080:8080 \
  -e SETTLEMENT_PRIVATE_KEY=0x... \
  -e PAY_TO_ADDRESS=0x... \
  -e BASE_RPC_URL=https://... \
  -e MY_BACKEND_URL=https://... \
  -e MY_BACKEND_API_KEY=... \
  -e UPSTASH_REDIS_REST_URL=https://... \
  -e UPSTASH_REDIS_REST_TOKEN=... \
  x402-gateway
```

Put behind nginx/Caddy for HTTPS:

```
# Caddyfile
x402-api.yourdomain.com {
    reverse_proxy localhost:8080
}
```

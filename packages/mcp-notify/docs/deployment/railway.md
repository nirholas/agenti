---
title: Railway Deployment
description: Deploy MCP Notify to Railway
icon: simple/railway
---

# Railway Deployment

Deploy MCP Notify to Railway with one click.

## One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/mcp-notify)

## Manual Deployment

### 1. Create Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### 2. Add Services

Add PostgreSQL and Redis:

```bash
# Add PostgreSQL
railway add -p postgresql

# Add Redis
railway add -p redis
```

### 3. Deploy

```bash
# Link to your project
railway link

# Deploy
railway up
```

### 4. Configure Environment

Railway auto-configures `DATABASE_URL` and `REDIS_URL` from linked services.

Add additional variables:

```bash
railway variables set API_KEY=your-secure-api-key
railway variables set LOG_LEVEL=info
```

## Configuration Files

MCP Notify includes Railway configuration:

### railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### railway.toml

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
```

## Scaling

### Horizontal Scaling

```bash
# Scale to multiple instances
railway service scale --replicas 3
```

### Vertical Scaling

Adjust resources in Railway dashboard:

- **CPU**: 0.5-8 vCPU
- **Memory**: 512MB-32GB

## Custom Domain

```bash
# Add custom domain
railway domain add api.yourdomain.com
```

Configure DNS:

| Type | Name | Value |
|------|------|-------|
| CNAME | api | your-app.up.railway.app |

## Monitoring

Railway provides built-in:

- **Logs**: `railway logs`
- **Metrics**: Dashboard → Metrics tab
- **Alerts**: Configure in dashboard

## Cost Estimation

| Usage | Estimated Cost |
|-------|---------------|
| **Hobby** (low traffic) | $5/month |
| **Production** (moderate) | $20-50/month |
| **Scale** (high traffic) | $100+/month |

!!! tip "Free Tier"
    Railway offers $5 free credit monthly for new users.

---
title: Vercel Deployment
description: Deploy MCP Notify documentation to Vercel
icon: simple/vercel
---

# Vercel Deployment

Deploy the documentation site to Vercel.

## One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nirholas/mcp-notify)

## Manual Deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Deploy

```bash
# From the repository root
vercel
```

### 3. Production Deploy

```bash
vercel --prod
```

## Configuration

The repository includes `vercel.json` for automatic configuration:

```json
{
  "buildCommand": "pip install mkdocs-material ... && mkdocs build",
  "outputDirectory": "site",
  "framework": null
}
```

## Environment Variables

Set in Vercel dashboard:

| Variable | Description |
|----------|-------------|
| `SITE_URL` | Your custom domain URL |

## Custom Domain

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed

## Automatic Deployments

Vercel automatically deploys:

- **Production**: On push to `main` branch
- **Preview**: On pull requests

No GitHub Actions needed - Vercel handles CI/CD.

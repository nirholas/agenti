# Web UI Infrastructure (Demo Frontend Hosting)

CloudFront + S3 hosting for the **React demo interface** - a user-facing website.

## What This Is

This hosts the **browser-based demo UI** where users can interact with the x402 payment flow. It's completely separate from the seller API.

```
┌─────────────┐         ┌─────────────────────────────┐         ┌───────────────────┐
│   Browser   │ ──────▶ │  This CloudFront (Web UI)   │         │ Seller CloudFront │
│   (User)    │   HTTP  │  - Serves React app         │         │ (Payment API)     │
│             │ ◀────── │  - Static files only        │         │                   │
└─────────────┘         └─────────────────────────────┘         └───────────────────┘
                                     │                                    ▲
                                     │ API calls via                      │
                                     │ Lambda proxy                       │
                                     ▼                                    │
                        ┌─────────────────────────────┐                   │
                        │     AgentCore Runtime       │ ──────────────────┘
                        │     (AI Agent)              │   Agent calls seller
                        └─────────────────────────────┘
```

The Web UI does NOT talk directly to the Seller CloudFront - it talks to the AI Agent, which then handles payments.

## Why Two CloudFronts?

| CloudFront | Purpose | Who Calls It |
|------------|---------|--------------|
| **Seller** (`seller-infrastructure/`) | Payment-gated API endpoints | AI Agent |
| **Web UI** (`web-ui-infrastructure/`) | Static React app hosting | Browser |

They serve completely different purposes and could even be in different AWS accounts.

## Prerequisites

1. Build the web-ui first:
   ```bash
   cd ../web-ui
   
   # Configure environment (update .env with your endpoints)
   # VITE_API_ENDPOINT should point to your AgentCore Gateway or proxy
   
   npm run build
   ```

2. Install dependencies:
   ```bash
   cd ../web-ui-infrastructure
   npm install
   ```

## Deploy

```bash
npx cdk bootstrap  # First time only
npx cdk deploy
```

## Outputs

After deployment, you'll get:
- **WebUiUrl**: The CloudFront URL to access the web UI
- **WebUiBucketName**: S3 bucket containing the static files
- **DistributionId**: CloudFront distribution ID for cache invalidation

## Update Deployment

To redeploy after web-ui changes:

```bash
cd ../web-ui
npm run build

cd ../web-ui-infrastructure
npx cdk deploy
```

## Cleanup

```bash
npx cdk destroy
```

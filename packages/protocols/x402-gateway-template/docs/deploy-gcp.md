# Deploy to GCP Cloud Run

## Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
- A GCP project with billing enabled
- Docker (for local builds) or Cloud Build enabled

## 1. Store Secrets

```bash
# Settlement private key
echo -n "0xYOUR_PRIVATE_KEY" | gcloud secrets create x402-settlement-key --data-file=-

# Optional: Solana facilitator key
echo -n "YOUR_BASE58_KEY" | gcloud secrets create x402-solana-facilitator-key --data-file=-

# Grant Cloud Run access
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding x402-settlement-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 2. Deploy (Quick)

```bash
gcloud run deploy x402-gateway \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --set-env-vars "BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/KEY,PAY_TO_ADDRESS=0x...,MY_BACKEND_URL=https://api.your-service.com,MY_BACKEND_API_KEY=your-key,UPSTASH_REDIS_REST_URL=https://...,UPSTASH_REDIS_REST_TOKEN=..." \
  --set-secrets "SETTLEMENT_PRIVATE_KEY=x402-settlement-key:latest"
```

## 3. Deploy (Cloud Build — CI/CD)

1. Connect your repo in [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Set branch filter: `^main$`
3. Config file: `cloudbuild.yaml`
4. Set substitution variables in the trigger UI (all `_PREFIXED` vars from `cloudbuild.yaml`)
5. Push to `main` or trigger manually

## 4. Custom Domain

Point your domain to the Cloud Run URL in your DNS provider:

```
x402-api.yourdomain.com → CNAME → x402-gateway-xxxxx-ue.a.run.app
```

Or use Cloud Run domain mapping:

```bash
gcloud run domain-mappings create \
  --service x402-gateway \
  --domain x402-api.yourdomain.com \
  --region us-east1
```

## VPC Connector (Optional)

If your backend is in a private VPC:

```bash
gcloud compute networks vpc-access connectors create my-vpc-connector \
  --region us-east1 \
  --range 10.8.0.0/28

# Then uncomment vpc-connector lines in cloudbuild.yaml
```

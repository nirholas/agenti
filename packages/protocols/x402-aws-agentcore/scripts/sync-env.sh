#!/bin/bash
# Pulls CloudFormation outputs and updates .env files automatically.
# Run after deploying seller-infrastructure (step 3).

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAYER_ENV="$PROJECT_ROOT/payer-agent/.env"
SELLER_STACK="X402SellerStack"
SELLER_REGION="us-east-1"

# Helper: update or append a key=value in an .env file
set_env_var() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "${file}.bak"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# --- Seller CloudFront URL ---
echo "Querying ${SELLER_STACK} outputs in ${SELLER_REGION}..."
CF_URL=$(aws cloudformation describe-stacks \
  --stack-name "$SELLER_STACK" \
  --region "$SELLER_REGION" \
  --query "Stacks[0].Outputs[?ExportName=='X402DistributionUrl'].OutputValue" \
  --output text 2>/dev/null) || true

if [ -z "$CF_URL" ] || [ "$CF_URL" = "None" ]; then
  echo "ERROR: Could not retrieve CloudFront URL. Is ${SELLER_STACK} deployed in ${SELLER_REGION}?"
  exit 1
fi

echo "Found CloudFront URL: ${CF_URL}"

# Update payer-agent/.env
set_env_var "$PAYER_ENV" "SELLER_API_URL" "$CF_URL"
echo "Updated payer-agent/.env  →  SELLER_API_URL=${CF_URL}"

# Export for payer-infrastructure CDK deploy
export X402_SELLER_CLOUDFRONT_URL="$CF_URL"
echo "Exported X402_SELLER_CLOUDFRONT_URL=${CF_URL}"

# --- Web UI .env.local ---
WEBUI_ENV="$PROJECT_ROOT/web-ui/.env.local"
WEBUI_EXAMPLE="$PROJECT_ROOT/web-ui/.env.example"
if [ -f "$WEBUI_EXAMPLE" ]; then
  sed "s|https://your-seller-distribution.cloudfront.net|${CF_URL}|" "$WEBUI_EXAMPLE" > "$WEBUI_ENV"
  echo "Updated web-ui/.env.local    →  VITE_SELLER_URL=${CF_URL}"
fi

echo ""
echo "Done. You can now deploy payer-infrastructure:"
echo "  cd ${PROJECT_ROOT}/payer-infrastructure && npx cdk deploy --all"

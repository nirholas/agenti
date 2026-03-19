#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
WEB_UI_DIR="$INFRA_DIR/../web-ui"

# Get runtime ARN from environment or argument
RUNTIME_ARN="${AGENT_RUNTIME_ARN:-$1}"

if [ -z "$RUNTIME_ARN" ]; then
    echo "Usage: ./deploy.sh <AGENT_RUNTIME_ARN>"
    echo "   or: AGENT_RUNTIME_ARN=arn:aws:... ./deploy.sh"
    exit 1
fi

echo "=== Deploying x402 Web UI ==="
echo "Runtime ARN: $RUNTIME_ARN"

# Step 1: Deploy infrastructure first to get API endpoint
echo ""
echo "Step 1: Deploying infrastructure..."
cd "$INFRA_DIR"
AGENT_RUNTIME_ARN="$RUNTIME_ARN" npx cdk deploy --require-approval never --outputs-file cdk-outputs.json

# Step 2: Extract API endpoint from outputs
API_ENDPOINT=$(cat cdk-outputs.json | grep -o '"ApiEndpoint": "[^"]*"' | cut -d'"' -f4)
echo "API Endpoint: $API_ENDPOINT"

# Step 3: Build web-ui with the API endpoint
echo ""
echo "Step 2: Building web-ui with API endpoint..."
cd "$WEB_UI_DIR"

# Create production env file with actual endpoint
cat > .env.production << EOF
VITE_API_ENDPOINT=${API_ENDPOINT}
VITE_AWS_REGION=us-west-2
EOF

npm run build

# Step 4: Redeploy to upload the new build
echo ""
echo "Step 3: Uploading built assets..."
cd "$INFRA_DIR"
AGENT_RUNTIME_ARN="$RUNTIME_ARN" npx cdk deploy --require-approval never --outputs-file cdk-outputs.json

# Extract final URLs
WEB_UI_URL=$(cat cdk-outputs.json | grep -o '"WebUiUrl": "[^"]*"' | cut -d'"' -f4)

echo ""
echo "=== Deployment Complete ==="
echo "Web UI URL: $WEB_UI_URL"
echo "API Endpoint: $API_ENDPOINT"
echo ""
echo "The web UI is now live and connected to your AgentCore Runtime!"

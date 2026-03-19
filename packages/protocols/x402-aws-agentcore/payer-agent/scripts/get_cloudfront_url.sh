#!/bin/bash
# =============================================================================
# Get CloudFront Distribution URL from deployed seller-infrastructure stack
# =============================================================================
#
# This script retrieves the CloudFront distribution URL from the deployed
# X402SellerStack and optionally exports it as an environment variable.
#
# Usage:
#   ./scripts/get_cloudfront_url.sh           # Print URL only
#   ./scripts/get_cloudfront_url.sh --export  # Print and export as env var
#   source ./scripts/get_cloudfront_url.sh --export  # Export to current shell
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - seller-infrastructure stack deployed (cd seller-infrastructure && cdk deploy)
#
# =============================================================================

set -e

STACK_NAME="${X402_SELLER_STACK_NAME:-X402SellerStack}"
REGION="${AWS_REGION:-us-east-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Fetching CloudFront URL from stack: ${STACK_NAME}${NC}"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed or not in PATH${NC}"
    exit 1
fi

# Get the CloudFront URL from CloudFormation outputs
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?ExportName=='X402DistributionUrl'].OutputValue" \
    --output text 2>/dev/null)

if [ -z "$CLOUDFRONT_URL" ] || [ "$CLOUDFRONT_URL" == "None" ]; then
    echo -e "${RED}Error: Could not retrieve CloudFront URL from stack${NC}"
    echo ""
    echo "Possible causes:"
    echo "  1. Stack '$STACK_NAME' has not been deployed yet"
    echo "  2. Stack is in a different region (current: $REGION)"
    echo "  3. AWS credentials don't have permission to describe stacks"
    echo ""
    echo "To deploy the seller infrastructure:"
    echo "  cd seller-infrastructure"
    echo "  npm install"
    echo "  cdk deploy"
    exit 1
fi

echo -e "${GREEN}CloudFront Distribution URL:${NC}"
echo "$CLOUDFRONT_URL"
echo ""

# Also get the Distribution ID for reference
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?ExportName=='X402DistributionId'].OutputValue" \
    --output text 2>/dev/null)

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
    echo -e "${GREEN}Distribution ID:${NC} $DISTRIBUTION_ID"
fi

# Get the API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?ExportName=='X402PaymentApiEndpoint'].OutputValue" \
    --output text 2>/dev/null)

if [ -n "$API_ENDPOINT" ] && [ "$API_ENDPOINT" != "None" ]; then
    echo -e "${GREEN}Payment API Endpoint:${NC} $API_ENDPOINT"
fi

echo ""

# Export if requested
if [ "$1" == "--export" ]; then
    export X402_SELLER_CLOUDFRONT_URL="$CLOUDFRONT_URL"
    export SELLER_API_URL="$CLOUDFRONT_URL"
    echo -e "${GREEN}Exported environment variables:${NC}"
    echo "  X402_SELLER_CLOUDFRONT_URL=$CLOUDFRONT_URL"
    echo "  SELLER_API_URL=$CLOUDFRONT_URL"
    echo ""
    echo "To use in your current shell, run:"
    echo "  source ./scripts/get_cloudfront_url.sh --export"
fi

# Print usage hint
echo -e "${YELLOW}To set these in your .env file:${NC}"
echo "  X402_SELLER_CLOUDFRONT_URL=$CLOUDFRONT_URL"
echo "  SELLER_API_URL=$CLOUDFRONT_URL"

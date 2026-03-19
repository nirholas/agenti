#!/bin/bash
# Script to upload sample content to S3 bucket
# Usage: ./upload-content.sh <bucket-name>

set -e

BUCKET_NAME=${1:-"x402-content-bucket"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTENT_DIR="${SCRIPT_DIR}/../content"

echo "Uploading content to S3 bucket: ${BUCKET_NAME}"

# Check if bucket exists
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>&1 > /dev/null; then
    echo "Error: Bucket ${BUCKET_NAME} does not exist or you don't have access"
    echo "The bucket is created automatically by the CDK stack."
    echo "Run 'cdk deploy' first, then use the bucket name from the output."
    exit 1
fi

# Upload content files
echo "Uploading research-report.json..."
aws s3 cp "${CONTENT_DIR}/research-report.json" "s3://${BUCKET_NAME}/content/research-report.json" \
    --content-type "application/json"

echo "Uploading dataset.json..."
aws s3 cp "${CONTENT_DIR}/dataset.json" "s3://${BUCKET_NAME}/content/dataset.json" \
    --content-type "application/json"

echo "Uploading tutorial.json..."
aws s3 cp "${CONTENT_DIR}/tutorial.json" "s3://${BUCKET_NAME}/content/tutorial.json" \
    --content-type "application/json"

echo ""
echo "Content upload complete!"
echo ""
echo "Available S3 content endpoints:"
echo "  - /api/research-report (5000 units - ~\$0.005 USDC)"
echo "  - /api/dataset (10000 units - ~\$0.01 USDC)"
echo "  - /api/tutorial (3000 units - ~\$0.003 USDC)"

#!/usr/bin/env bash
# download_latest_x402proxy.sh
# Downloads the latest x402proxy executable artifact from GitHub Actions

set -e

OWNER="skalenetwork"
REPO="x402proxy"
ARTIFACT_NAME="x402proxy-executables"
EXECUTABLE="x402proxy"
GITHUB_API="https://api.github.com"

# Use token if available
if [ -n "$GITHUB_TOKEN" ]; then
    AUTH_HEADER="Authorization: Bearer $GITHUB_TOKEN"
else
    AUTH_HEADER=""
fi

# Check for jq
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    exit 1
fi

# Get latest successful workflow run with the artifact
RUNS_URL="$GITHUB_API/repos/$OWNER/$REPO/actions/runs?status=success&per_page=10"
RUN_ID=$(curl -s -H "$AUTH_HEADER" "$RUNS_URL" | jq -r '.workflow_runs[0].id')
if [ "$RUN_ID" = "null" ]; then
    echo "No successful workflow runs found."
    exit 1
fi

# Get artifact ID for x402proxy-executables
ARTIFACTS_URL="$GITHUB_API/repos/$OWNER/$REPO/actions/runs/$RUN_ID/artifacts"
ARTIFACT_ID=$(curl -s -H "$AUTH_HEADER" "$ARTIFACTS_URL" | jq -r ".artifacts[] | select(.name==\"$ARTIFACT_NAME\").id")
if [ -z "$ARTIFACT_ID" ]; then
    echo "Artifact $ARTIFACT_NAME not found in latest run."
    exit 1
fi

# Download artifact zip
DOWNLOAD_URL="$GITHUB_API/repos/$OWNER/$REPO/actions/artifacts/$ARTIFACT_ID/zip"
echo "Downloading artifact..."
curl -L -H "$AUTH_HEADER" "$DOWNLOAD_URL" -o artifact.zip

# Extract x402proxy
unzip -o artifact.zip "$EXECUTABLE"
rm artifact.zip

echo "Downloaded $EXECUTABLE to current directory."

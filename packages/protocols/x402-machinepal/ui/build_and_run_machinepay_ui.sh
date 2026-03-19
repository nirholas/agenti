#!/bin/bash
set -e

# Navigate to the script's directory
cd "$(dirname "$0")"

echo "Building MachinePal UI Docker image..."
docker build -t machinepal-ui .

echo "Stopping existing container..."
docker rm -f machinepal-ui || true

# Create certs directory on host to ensure persistence
mkdir -p "$(pwd)/certs"

echo "Running MachinePal UI container..."
# Mapping container port 80 to host port 3080
# Mapping container port 443 to host port 3443
docker run -d \
  --name machinepal-ui \
  -p 3080:80 \
  -p 3443:443 \
  --ulimit nofile=65535:65535 \
  -v ~/machinepal:/machinepal \
  -v "$(pwd)/certs:/etc/nginx/certs" \
  --security-opt apparmor=unconfined \
  machinepal-ui

echo "MachinePal UI is running at http://localhost:3080 and https://localhost:3443"

echo "Waiting for service to be ready..."
sleep 2

echo "Testing connection to http://localhost:3080..."
if curl --fail --silent --show-error http://localhost:3080 > /dev/null; then
  echo "SUCCESS: MachinePal UI is responding on HTTP."
else
  echo "ERROR: Failed to connect to MachinePal UI on HTTP."
  docker logs machinepal-ui
  exit 1
fi

echo "Testing connection to https://localhost:3443..."
if curl --fail --silent --show-error --insecure https://localhost:3443 > /dev/null; then
  echo "SUCCESS: MachinePal UI is responding on HTTPS."
else
  echo "ERROR: Failed to connect to MachinePal UI on HTTPS."
  docker logs machinepal-ui
  exit 1
fi


#!/bin/bash

set -e

# Variable for easy name changes
IMAGE_NAME="machinepal_build_image"

echo "Rebuilding $IMAGE_NAME..."

# Try to remove the image, but don't exit if it doesn't exist
docker rmi -f "$IMAGE_NAME" 2>/dev/null || true

# Build the image
docker build -t "$IMAGE_NAME" -f Dockerfile .``

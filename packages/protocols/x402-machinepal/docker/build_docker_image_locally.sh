#!/bin/bash

set -e

# Variable for easy name changes
IMAGE_NAME="machinepal_image"

echo "Rebuilding $IMAGE_NAME..."

# Try to remove the image, but don't exit if it doesn't exist
docker rmi -f "$IMAGE_NAME" 2>/dev/null || true

# Build the image
docker build -t "$IMAGE_NAME" -f Dockerfile .``

echo "Docker image $IMAGE_NAME built successfully."

# test image

rm -rf ~/machinepal
mkdir ~/machinepal  && docker run -it -v ~/machinepal:/machinepal -e PUID=$(id -u) -e PGID=$(id -g) machinepal_image init
docker rm -f machinepal_image_test
docker run -d --name machinepal_image_test \
  --restart unless-stopped \
  --network host \
  -e PUID=$(id -u) -e PGID=$(id -g) \
  --ulimit nofile=65535:65535 \
  -v ~/machinepal:/machinepal \
  --security-opt apparmor=unconfined \
  machinepal_image
ls -l ~/machinepal/
sleep 10
docker run --rm -v ~/machinepal:/machinepal -e PUID=$(id -u) -e PGID=$(id -g)  --network host \
  machinepal_image client --url https://localhost:8443/hello_world.txt
echo "Machinepal logs:"
docker logs machinepal_image_test
docker rm -f machinepal_image_test
echo "Docker image $IMAGE_NAME tested successfully."
#!/bin/bash

ZIP_PATH="/tmp/libertai-agent.zip"
CODE_PATH="/root/libertai-agent"

# Suppress debconf warnings and needrestart noise
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_SUSPEND=1

# Setup
apt-get update
apt-get install unzip -y
if ! command -v docker &> /dev/null; then
    # Docker installation when not already present
    curl -fsSL https://get.docker.com | sudo DEBIAN_FRONTEND=noninteractive sh 2>/dev/null
    sudo usermod -aG docker $USER  # Allow non-root usage
    sudo systemctl enable --now docker 2>/dev/null # Start Docker and enable on boot
fi
apt-get install docker-compose-plugin -y

# Stop previous agent (if any)
if [ -d "$CODE_PATH" ]; then
    cd "$CODE_PATH" && docker compose down > /dev/null 2>&1
    cd ~
    rm -rf $CODE_PATH
fi

# Starting to clean previous agent and preparing new one
unzip $ZIP_PATH -d $CODE_PATH
cd $CODE_PATH
docker compose up -d --build > /dev/null 2>&1

# Cleanup
rm -f $ZIP_PATH

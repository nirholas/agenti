#!/bin/bash

# Complete test script for x402 AI Agent
# This script tests both unpaid and paid request flows

set -e

echo "🧪 x402 AI Agent Test Suite"
echo "============================"
echo ""

# Check if agent is running
echo "1️⃣ Checking if agent is running..."
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "❌ Agent is not running!"
    echo ""
    echo "Please start the agent first:"
    echo "  npm start"
    echo ""
    exit 1
fi

echo "✅ Agent is running"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: No .env file found"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "Please edit .env and add your configuration, then run this script again."
    exit 1
fi

# Build the test client if needed
if [ ! -d "dist" ]; then
    echo "2️⃣ Building project..."
    npm run build
    echo ""
fi

# Run the test client
echo "3️⃣ Running test client..."
echo ""
node dist/testClient.js

echo ""
echo "✅ Test suite complete!"

#!/bin/bash

# Test script for the x402 AI Agent

PORT=${PORT:-3000}
HOST="http://localhost:${PORT}"

echo "🧪 Testing x402 AI Agent"
echo ""

# Test 1: Health check
echo "1️⃣ Testing health endpoint..."
curl -s "${HOST}/health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test 2: Simple request (should return 402 Payment Required)
echo ""
echo "2️⃣ Testing payment required flow..."
echo "Sending request to /process endpoint..."
echo ""

curl -X POST "${HOST}/process" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "parts": [
        {
          "type": "text",
          "text": "What is 2+2?"
        }
      ]
    }
  }' | jq '.' || echo "❌ Request failed"

echo ""
echo "✅ Test complete!"
echo ""
echo "Expected: 402 Payment Required response with x402 payment details"
echo "To complete the payment, you need to use an x402-compatible client"

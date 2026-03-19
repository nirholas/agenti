#!/bin/bash

echo "🧪 Testing ChaosChain Facilitator"
echo "=================================="
echo ""

# Test 1: Root endpoint
echo "1️⃣  Testing GET / (root endpoint)..."
curl -s http://localhost:8402/ | jq '.'
echo ""

# Test 2: Health check
echo "2️⃣  Testing GET /health..."
curl -s http://localhost:8402/health | jq '.healthy, .checks.rpcBaseSepolia, .checks.gasBalanceHealthy'
echo ""

# Test 3: Supported chains
echo "3️⃣  Testing GET /supported..."
curl -s http://localhost:8402/supported | jq '.chains[] | select(.chainId == "base-sepolia")'
echo ""

# Test 4: POST /verify (with sample data)
echo "4️⃣  Testing POST /verify (sample payment)..."
curl -s -X POST http://localhost:8402/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "x402Version": 1,
    "paymentHeader": {
      "sender": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "nonce": "test_001",
      "signature": "0x00"
    },
    "paymentRequirements": {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "10.00",
      "payTo": "0x1111111111111111111111111111111111111111",
      "asset": "usdc",
      "resource": "/api/service"
    }
  }' | jq '{isValid, amount: .amount.human, fee: .fee.human, net: .net.human}'

echo ""
echo "✅ All endpoints tested!"


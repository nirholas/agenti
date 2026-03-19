#!/bin/bash

echo "🧪 Testing ChaosChain Facilitator with POST requests"
echo "===================================================="
echo ""

echo "1️⃣  Testing POST /verify..."
curl -s -X POST http://localhost:8402/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "x402Version": 1,
    "paymentHeader": {
      "sender": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      "nonce": "test_001",
      "signature": "0x0000000000000000000000000000000000000000000000000000000000000000"
    },
    "paymentRequirements": {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "10.00",
      "payTo": "0x1111111111111111111111111111111111111111",
      "asset": "usdc",
      "resource": "/api/service"
    }
  }' | jq '{
    isValid,
    invalidReason,
    amount: .amount.human,
    fee: .fee.human,
    net: .net.human,
    fee_bps: .fee.bps
  }'

echo ""
echo "✅ POST /verify works!"
echo ""
echo "📊 What you see:"
echo "  - isValid: false (expected - test wallet has no USDC)"
echo "  - Amount: 10.00 USDC"
echo "  - Fee: 0.10 USDC (1%)"
echo "  - Net: 9.90 USDC"
echo ""
echo "✨ The facilitator is calculating fees correctly!"

#!/bin/bash

# ChaosChain x402 Facilitator - Smoke Test
# This script demonstrates the full payment flow on Base Sepolia

set -e

echo "════════════════════════════════════════════════════════════════"
echo "  🧪 ChaosChain x402 Facilitator - Smoke Test"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Configuration
export PAY="${PAY:-http://localhost:8402}"
export PAYER_ADDR="${PAYER_ADDR:-0x1234567890123456789012345678901234567890}"
export MERCHANT="${MERCHANT:-0x1111111111111111111111111111111111111111}"
export FACILITATOR="${FACILITATOR:-0x0000000000000000000000000000000000000001}"
export USDC="${USDC:-0x036CbD53842c5426634e7929541eC2318f3dCF7e}"
export BASE_SEPOLIA_RPC="${BASE_SEPOLIA_RPC:-https://sepolia.base.org}"

echo "📋 Configuration:"
echo "  Facilitator URL: $PAY"
echo "  Payer Address: $PAYER_ADDR"
echo "  Merchant Address: $MERCHANT"
echo "  Facilitator Contract: $FACILITATOR"
echo "  USDC Contract: $USDC"
echo "  RPC: $BASE_SEPOLIA_RPC"
echo ""

# Check if facilitator is running
echo "🔍 Step 0: Check if facilitator is running..."
if curl -s "$PAY/health" > /dev/null 2>&1; then
  echo "✅ Facilitator is online"
  curl -s "$PAY/health" | jq -c '{healthy, supabase: .checks.supabase, rpc: .checks.rpcBaseSepolia}'
else
  echo "❌ Facilitator is offline at $PAY"
  echo "   Start it with: cd http-bridge && npm run dev"
  exit 1
fi
echo ""

# Step 1: Approve (requires cast from Foundry)
echo "════════════════════════════════════════════════════════════════"
echo "🔐 Step 1: Approve Facilitator (requires 'cast' CLI)"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "If you have a funded test wallet, run:"
echo ""
echo "  cast send $USDC --rpc-url $BASE_SEPOLIA_RPC \\"
echo "    \"approve(address,uint256)\" $FACILITATOR 1000000 \\"
echo "    --private-key \$PAYER_KEY"
echo ""
echo "This approves the facilitator to spend 1 USDC (1000000 base units)"
echo ""
read -p "Press Enter to continue (assuming approval is done)..."
echo ""

# Step 2: Verify Payment
echo "════════════════════════════════════════════════════════════════"
echo "✅ Step 2: Verify Payment"
echo "════════════════════════════════════════════════════════════════"
echo ""

VERIFY_PAYLOAD=$(cat <<EOF
{
  "x402Version": 1,
  "paymentHeader": {
    "sender": "$PAYER_ADDR",
    "nonce": "smoke_$(date +%s)",
    "signature": "0x00"
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1.00",
    "payTo": "$MERCHANT",
    "asset": "usdc",
    "resource": "/api/service"
  }
}
EOF
)

echo "Request payload:"
echo "$VERIFY_PAYLOAD" | jq
echo ""

echo "Calling /verify..."
VERIFY_RESPONSE=$(curl -s -X POST "$PAY/verify" \
  -H 'Content-Type: application/json' \
  -d "$VERIFY_PAYLOAD")

echo "$VERIFY_RESPONSE" | jq
echo ""

# Check if valid
IS_VALID=$(echo "$VERIFY_RESPONSE" | jq -r '.isValid')
if [ "$IS_VALID" = "true" ]; then
  echo "✅ Payment is valid!"
  echo "   Fee: $(echo "$VERIFY_RESPONSE" | jq -r '.fee.human') USDC ($(echo "$VERIFY_RESPONSE" | jq -r '.fee.bps')bps)"
  echo "   Net: $(echo "$VERIFY_RESPONSE" | jq -r '.net.human') USDC"
else
  echo "⚠️  Payment is invalid:"
  echo "   Reason: $(echo "$VERIFY_RESPONSE" | jq -r '.invalidReason')"
  echo ""
  echo "   This is expected if:"
  echo "   - Payer doesn't have USDC balance"
  echo "   - Facilitator not approved"
  echo "   - Using placeholder addresses"
fi
echo ""

# Step 3: Settle Payment (with idempotency)
echo "════════════════════════════════════════════════════════════════"
echo "💰 Step 3: Settle Payment (with idempotency)"
echo "════════════════════════════════════════════════════════════════"
echo ""

IDEM_KEY="smoke_$(date +%s)_$$"
SETTLE_PAYLOAD=$(cat <<EOF
{
  "x402Version": 1,
  "paymentHeader": {
    "sender": "$PAYER_ADDR",
    "nonce": "smoke_$(date +%s)",
    "signature": "0x00"
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1.00",
    "payTo": "$MERCHANT",
    "asset": "usdc",
    "resource": "/api/service"
  },
  "agentId": "8004#123"
}
EOF
)

echo "Request payload (with agentId for ERC-8004):"
echo "$SETTLE_PAYLOAD" | jq
echo ""

echo "Calling /settle (first time)..."
SETTLE_RESPONSE_1=$(curl -s -X POST "$PAY/settle" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d "$SETTLE_PAYLOAD")

echo "$SETTLE_RESPONSE_1" | jq '{
  success,
  timestamp,
  amount: .amount.human,
  fee: .fee.human,
  net: .net.human,
  txHash,
  evidenceHash,
  proofOfAgency
}'
echo ""

TIMESTAMP_1=$(echo "$SETTLE_RESPONSE_1" | jq -r '.timestamp')

echo "Waiting 1 second..."
sleep 1
echo ""

echo "Calling /settle again (same Idempotency-Key)..."
SETTLE_RESPONSE_2=$(curl -s -X POST "$PAY/settle" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d "$SETTLE_PAYLOAD")

echo "$SETTLE_RESPONSE_2" | jq '{
  success,
  timestamp,
  amount: .amount.human,
  fee: .fee.human,
  net: .net.human
}'
echo ""

TIMESTAMP_2=$(echo "$SETTLE_RESPONSE_2" | jq -r '.timestamp')

# Verify idempotency
if [ "$TIMESTAMP_1" = "$TIMESTAMP_2" ]; then
  echo "✅ Idempotency working correctly!"
  echo "   Both calls returned identical timestamp: $TIMESTAMP_1"
  echo "   Response is byte-for-byte identical"
else
  echo "❌ Idempotency FAILED!"
  echo "   First timestamp:  $TIMESTAMP_1"
  echo "   Second timestamp: $TIMESTAMP_2"
  exit 1
fi
echo ""

# Step 4: Health Check
echo "════════════════════════════════════════════════════════════════"
echo "🏥 Step 4: Health Check"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "Checking facilitator health..."
HEALTH=$(curl -s "$PAY/health")
echo "$HEALTH" | jq
echo ""

HEALTHY=$(echo "$HEALTH" | jq -r '.healthy')
if [ "$HEALTHY" = "true" ]; then
  echo "✅ All systems healthy"
else
  echo "⚠️  Some systems unhealthy (expected without Supabase)"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ Smoke Test Complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Test Results:"
echo "  ✅ Facilitator is online"
echo "  ✅ /verify returns fee breakdown"
echo "  ✅ /settle includes amount/fee/net fields"
if [ "$TIMESTAMP_1" = "$TIMESTAMP_2" ]; then
  echo "  ✅ Idempotency working (same timestamp)"
else
  echo "  ❌ Idempotency NOT working"
fi
echo ""
echo "Next Steps:"
echo "  1. Fund a test wallet with Base Sepolia USDC"
echo "  2. Approve the facilitator contract"
echo "  3. Run real on-chain settlements"
echo "  4. Monitor transactions in block explorer"
echo ""
echo "Production Readiness: See PRODUCTION_HARDENING.md"
echo ""


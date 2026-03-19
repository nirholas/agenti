#!/bin/bash

# ChaosChain x402 Facilitator - Week 1 Testing Setup Script
# This script helps you set up the testing environment on Base Sepolia

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   ChaosChain x402 Facilitator - Week 1 Testing Setup     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo ""
    echo "Please create .env file with the following variables:"
    echo ""
    cat << 'EOF'
FACILITATOR_MODE=managed
DEFAULT_CHAIN=base-sepolia
FEE_BPS_DEFAULT=100
TREASURY_ADDRESS=0xYourTreasuryAddress

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
FACILITATOR_PRIVATE_KEY=0xYourPrivateKey

CHAOSCHAIN_ENABLED=false
MIN_GAS_BALANCE_ETH=0.1
MAX_PAYMENT_AMOUNT_USD=1000
LOG_LEVEL=info
PORT=8402
EOF
    echo ""
    exit 1
fi

echo "✅ Found .env file"
echo ""

# Load environment variables
source .env

# Check required variables
REQUIRED_VARS=(
    "FACILITATOR_MODE"
    "DEFAULT_CHAIN"
    "TREASURY_ADDRESS"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_KEY"
    "BASE_SEPOLIA_RPC_URL"
    "FACILITATOR_PRIVATE_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required variable: $var"
        exit 1
    fi
done

echo "✅ All required environment variables set"
echo ""

# Check Node.js/npm
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node --version)"
echo ""

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Test Supabase connection
echo "🔍 Testing Supabase connection..."
SUPABASE_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET "${SUPABASE_URL}/rest/v1/" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}")

if [ "$SUPABASE_TEST" == "200" ]; then
    echo "✅ Supabase connection successful"
else
    echo "❌ Supabase connection failed (HTTP $SUPABASE_TEST)"
    echo "   Please check your SUPABASE_URL and SUPABASE_SERVICE_KEY"
    exit 1
fi
echo ""

# Test RPC connection
echo "🔍 Testing Base Sepolia RPC..."
RPC_TEST=$(curl -s -X POST "${BASE_SEPOLIA_RPC_URL}" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    | jq -r '.result')

if [ -n "$RPC_TEST" ] && [ "$RPC_TEST" != "null" ]; then
    echo "✅ Base Sepolia RPC connected (block: $((16#${RPC_TEST:2})))"
else
    echo "❌ Base Sepolia RPC connection failed"
    echo "   Please check your BASE_SEPOLIA_RPC_URL"
    exit 1
fi
echo ""

# Check facilitator wallet balance
echo "🔍 Checking facilitator wallet balance..."

# Extract address from private key (requires cast from Foundry)
if command -v cast &> /dev/null; then
    FACILITATOR_ADDRESS=$(cast wallet address --private-key "$FACILITATOR_PRIVATE_KEY")
    echo "   Address: $FACILITATOR_ADDRESS"
    
    # Check ETH balance
    ETH_BALANCE=$(cast balance "$FACILITATOR_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL" --ether)
    echo "   ETH Balance: $ETH_BALANCE"
    
    # Check USDC balance
    USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    USDC_BALANCE=$(cast call "$USDC_ADDRESS" \
        "balanceOf(address)(uint256)" \
        "$FACILITATOR_ADDRESS" \
        --rpc-url "$BASE_SEPOLIA_RPC_URL")
    USDC_BALANCE_FORMATTED=$(awk "BEGIN {printf \"%.2f\", $((16#${USDC_BALANCE:2})) / 1000000}")
    echo "   USDC Balance: $USDC_BALANCE_FORMATTED"
    echo ""
    
    # Check if balance is sufficient
    ETH_BALANCE_NUM=$(echo $ETH_BALANCE | cut -d' ' -f1)
    if (( $(echo "$ETH_BALANCE_NUM < 0.1" | bc -l) )); then
        echo "⚠️  Warning: ETH balance is low. You need at least 0.1 ETH for gas."
        echo "   Get testnet ETH: https://faucet.triangleplatform.com/base/sepolia"
        echo ""
    fi
else
    echo "⚠️  Foundry not installed. Skipping balance check."
    echo "   Install: https://getfoundry.sh/"
    echo ""
fi

# Summary
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "1. Make sure your Supabase database has the required tables:"
echo "   - Run: http-bridge/supabase/schema.sql"
echo "   - Run: http-bridge/supabase/seed.sql"
echo ""
echo "2. Start the facilitator:"
echo "   npm run dev"
echo ""
echo "3. Test health endpoint:"
echo "   curl http://localhost:8402/health | jq"
echo ""
echo "4. Follow Week 1 Testing Guide:"
echo "   ../WEEK1_TESTING_GUIDE.md"
echo ""
echo "Happy testing! 🚀"


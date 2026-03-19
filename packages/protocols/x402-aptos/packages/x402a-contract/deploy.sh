#!/bin/bash

# x402 Contract Deployment Script
# Run this after funding both wallets

set -e  # Exit on error

echo "========================================"
echo "x402 Contract Deployment"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DEPLOYER="0x966eb1d2d3ed1e199f7d92335b5bb40f7a79dbbfb142ed951035bf78ba1b9744"
FACILITATOR="0x719c8c157cd82e012b57aba5ab65a970316b21a957b9340de89a10b5393168db"

echo "Step 1: Checking wallet balances..."
echo "-----------------------------------"

# Check deployer balance
DEPLOYER_BALANCE=$(curl -s "https://api.testnet.aptoslabs.com/v1/accounts/$DEPLOYER/resource/0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>" | python3 -c "import sys, json; data = json.load(sys.stdin); print(int(data['data']['coin']['value']))" 2>/dev/null || echo "0")

if [ "$DEPLOYER_BALANCE" -lt "10000000" ]; then
    echo -e "${RED}✗ Deployer wallet needs funding${NC}"
    echo "  Address: $DEPLOYER"
    echo "  Fund at: https://aptoslabs.com/testnet-faucet"
    exit 1
else
    DEPLOYER_APT=$(echo "scale=2; $DEPLOYER_BALANCE / 100000000" | bc)
    echo -e "${GREEN}✓ Deployer has $DEPLOYER_APT APT${NC}"
fi

# Check facilitator balance
FACILITATOR_BALANCE=$(curl -s "https://api.testnet.aptoslabs.com/v1/accounts/$FACILITATOR/resource/0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>" | python3 -c "import sys, json; data = json.load(sys.stdin); print(int(data['data']['coin']['value']))" 2>/dev/null || echo "0")

if [ "$FACILITATOR_BALANCE" -lt "10000000" ]; then
    echo -e "${YELLOW}⚠ Facilitator wallet should be funded${NC}"
    echo "  Address: $FACILITATOR"
else
    FACILITATOR_APT=$(echo "scale=2; $FACILITATOR_BALANCE / 100000000" | bc)
    echo -e "${GREEN}✓ Facilitator has $FACILITATOR_APT APT${NC}"
fi

echo ""
echo "Step 2: Compiling contract..."
echo "-----------------------------------"
aptos move compile --skip-fetch-latest-git-deps

echo ""
echo "Step 3: Running tests..."
echo "-----------------------------------"
aptos move test --skip-fetch-latest-git-deps

echo ""
echo "Step 4: Deploying to testnet..."
echo "-----------------------------------"
aptos move publish --skip-fetch-latest-git-deps --assume-yes

echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo "Contract Address: $DEPLOYER"
echo "Explorer: https://explorer.aptoslabs.com/account/$DEPLOYER?network=testnet"
echo ""
echo "Next steps:"
echo "1. Verify deployment on explorer"
echo "2. Test contract functions"
echo "3. Initialize registries for users"
echo "4. Update frontend with new contract address"
echo ""

#!/bin/bash

# x402a Contract Deployment Script for Testnet
# This script deploys the x402a Move contract to Aptos testnet

set -e  # Exit on error

echo "======================================"
echo "x402a Contract Deployment to Testnet"
echo "======================================"
echo ""

# Contract address from Move.toml
CONTRACT_ADDRESS="0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36"

echo "Step 1: Checking Aptos CLI..."
if ! command -v aptos &> /dev/null; then
    echo "❌ Error: Aptos CLI not found. Please install it first:"
    echo "   https://aptos.dev/tools/aptos-cli/"
    exit 1
fi
echo "✅ Aptos CLI found: $(aptos --version)"
echo ""

echo "Step 2: Compiling contract..."
aptos move compile --named-addresses daudio=$CONTRACT_ADDRESS
echo "✅ Contract compiled successfully"
echo ""

echo "Step 3: Running tests..."
aptos move test
echo "✅ All tests passed"
echo ""

echo "Step 4: Checking testnet profile..."
if ! aptos account list --profile testnet &> /dev/null; then
    echo "⚠️  Testnet profile not found. Creating it now..."
    echo ""
    echo "Please enter your private key (from .env.local):"
    echo "Default: 0x8d387425c2f440879bbeb1a20b075ed0c4b36b5dcc9e39a6cf6ff38dfc2c6d2b"
    echo ""

    aptos init --profile testnet --network testnet \
        --private-key 0x8d387425c2f440879bbeb1a20b075ed0c4b36b5dcc9e39a6cf6ff38dfc2c6d2b \
        --skip-faucet

    echo "✅ Testnet profile created"
else
    echo "✅ Testnet profile found"
fi
echo ""

echo "Step 5: Checking account balance..."
ACCOUNT_INFO=$(aptos account list --profile testnet 2>&1 || echo "ERROR")
if [[ "$ACCOUNT_INFO" == *"ERROR"* ]]; then
    echo "❌ Error: Could not fetch account info"
    exit 1
fi
echo "$ACCOUNT_INFO"
echo ""

echo "Step 6: Deploying contract..."
echo "Contract address: $CONTRACT_ADDRESS"
echo ""
read -p "Deploy to testnet? This will publish/upgrade the contract. (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    aptos move publish --profile testnet \
        --named-addresses daudio=$CONTRACT_ADDRESS \
        --assume-yes

    echo ""
    echo "======================================"
    echo "✅ Deployment Complete!"
    echo "======================================"
    echo ""
    echo "Contract Address: $CONTRACT_ADDRESS"
    echo "Network: Testnet"
    echo "Explorer: https://explorer.aptoslabs.com/account/$CONTRACT_ADDRESS?network=testnet"
    echo ""
    echo "Next steps:"
    echo "1. Verify deployment in explorer"
    echo "2. Test the example: cd ../../examples/nextjs-app-router && bun dev"
    echo "3. Fund your facilitator account if needed: https://faucet.testnet.aptoslabs.com"
    echo ""
else
    echo "Deployment cancelled."
    exit 0
fi

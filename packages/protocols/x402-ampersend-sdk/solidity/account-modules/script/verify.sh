#!/bin/bash

# Script to verify deployed contracts on Basescan/Etherscan
# Usage: ./verify.sh [network]
# Example: ./verify.sh base-sepolia

NETWORK=${1:-base-sepolia}

# Contract addresses (same on all chains)
AUTO_TOPUP_ADDRESS="0x92Be8FA04bF1d9Ee311F4B2754Ca22252ccA18D4"
AUTO_COLLECT_ADDRESS="0x6647fA97ff1f04614A0A960dcF499545c4DcC431"

echo "Verifying contracts on $NETWORK..."
echo ""

# Verify AutoTopUpExecutor
echo "Verifying AutoTopUpExecutor at $AUTO_TOPUP_ADDRESS..."
forge verify-contract \
    --chain $NETWORK \
    --num-of-optimizations 200 \
    --compiler-version v0.8.30 \
    $AUTO_TOPUP_ADDRESS \
    src/AutoTopUpExecutor.sol:AutoTopUpExecutor

echo ""

# Verify AutoCollectExecutor
echo "Verifying AutoCollectExecutor at $AUTO_COLLECT_ADDRESS..."
forge verify-contract \
    --chain $NETWORK \
    --num-of-optimizations 200 \
    --compiler-version v0.8.30 \
    $AUTO_COLLECT_ADDRESS \
    src/AutoCollectExecutor.sol:AutoCollectExecutor

echo ""
echo "Verification complete!"
echo ""
echo "View verified contracts:"
echo "- AutoTopUpExecutor: https://sepolia.basescan.org/address/$AUTO_TOPUP_ADDRESS#code"
echo "- AutoCollectExecutor: https://sepolia.basescan.org/address/$AUTO_COLLECT_ADDRESS#code"

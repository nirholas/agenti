#!/bin/bash
# Use this script to set environment variables for REAL SDK usage with your RPC

# ============================================
# STEP 1: Set your RPC endpoint here
# ============================================
# Option A: Use a free public RPC (may be rate-limited)
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"

# Option B: Use your Alchemy API key (recommended)
# export BASE_SEPOLIA_RPC_URL="https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY"

# Option C: Use your Infura project ID
# export BASE_SEPOLIA_RPC_URL="https://base-sepolia.infura.io/v3/YOUR_PROJECT_ID"

# ============================================
# STEP 2: Set facilitator URL
# ============================================
export X402_FACILITATOR_URL="http://localhost:8402"

# ============================================
# STEP 3: Enable real SDK (disable mock mode)
# ============================================
export DEMO_MODE_NO_SDK="false"

# ============================================
# STEP 4: (Optional) Set your private key
# ============================================
# If you want to use a specific wallet:
# export PRIVATE_KEY="your_private_key_without_0x"

echo "✅ Environment variables set for REAL SDK usage!"
echo ""
echo "RPC URL: $BASE_SEPOLIA_RPC_URL"
echo "Facilitator: $X402_FACILITATOR_URL"
echo "Mock mode: $DEMO_MODE_NO_SDK"
echo ""
echo "Now run: python demo_facilitator.py"

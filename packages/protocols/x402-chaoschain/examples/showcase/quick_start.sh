#!/bin/bash
# Quick start script for ChaosChain x402 demo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 ChaosChain x402 Facilitator Demo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo ""
    echo "Please create .env and add your RPC URL:"
    echo "  BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
    echo ""
    echo "See SETUP_GUIDE.md for details"
    exit 1
fi

# Check if RPC is configured
if grep -q "YOUR_ALCHEMY_API_KEY_HERE" .env; then
    echo "⚠️  Warning: .env still has placeholder RPC URL"
    echo ""
    echo "Please edit .env and add your actual RPC key:"
    echo "  nano .env"
    echo ""
    read -p "Continue anyway with mock agent? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    export DEMO_MODE_NO_SDK=true
fi

# Check if facilitator is running
if ! curl -s http://localhost:8402 > /dev/null 2>&1; then
    echo "❌ HTTP bridge not running!"
    echo ""
    echo "Start it in another terminal:"
    echo "  cd ../../http-bridge && bun run dev"
    echo ""
    exit 1
fi

echo "✅ Facilitator is online"
echo "✅ Configuration loaded"
echo ""
echo "Starting demo..."
echo ""

python demo_facilitator.py

#!/bin/bash

# x402 AI Agent Setup Script

set -e

echo "🚀 Setting up x402 AI Agent..."
echo ""

# Check if we're in the agent directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the agent directory"
    exit 1
fi

# Step 1: Install agent dependencies
echo "📦 Step 1: Installing agent dependencies..."
npm install

# Step 2: Check for .env file
echo ""
if [ ! -f ".env" ]; then
    echo "⚠️  Step 2: No .env file found"
    echo "   Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "📝 Please edit the .env file and add your configuration:"
    echo "   - OPENAI_API_KEY"
    echo "   - PAY_TO_ADDRESS"
    echo "   - PRIVATE_KEY (optional)"
    echo "   - NETWORK (default: base-sepolia)"
    echo ""
else
    echo "✅ Step 2: .env file already exists"
fi

# Step 3: Build the agent
echo ""
echo "🔨 Step 3: Building agent..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run 'npm start' to start the agent"
echo "3. Visit http://localhost:3000/health to check status"
echo ""

#!/bin/bash

# x402a NPM Publishing Script
# This script publishes both x402a packages to npm

set -e  # Exit on error

echo "🚀 x402a NPM Publishing Script"
echo "================================"
echo ""

# Check if logged in to npm
echo "📝 Checking npm authentication..."
if ! npm whoami &> /dev/null; then
    echo "❌ Not logged in to npm. Please run 'npm login' first."
    exit 1
fi

echo "✅ Logged in as: $(npm whoami)"
echo ""

# Confirm before publishing
read -p "Ready to publish x402a@0.1.0 and x402a-next@0.1.0? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publishing cancelled."
    exit 1
fi

echo ""
echo "📦 Publishing x402a@0.1.0..."
cd packages/x402a
npm publish
echo "✅ x402a@0.1.0 published successfully!"
echo ""

echo "📦 Publishing x402a-next@0.1.0..."
cd ../x402a-next
npm publish
echo "✅ x402a-next@0.1.0 published successfully!"
echo ""

echo "🎉 All packages published successfully!"
echo ""
echo "Verify at:"
echo "  - https://www.npmjs.com/package/x402a"
echo "  - https://www.npmjs.com/package/x402a-next"
echo ""
echo "Test installation:"
echo "  npm install x402a@0.1.0"
echo "  npm install x402a-next@0.1.0"

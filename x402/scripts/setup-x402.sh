#!/bin/bash
# x402 Integration Setup Script
# Sets up x402 payment protocol for universal-crypto-mcp
# Target: https://github.com/nirholas/universal-crypto-mcp

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
X402_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$X402_DIR")"

echo "🚀 x402 Integration Setup"
echo "========================="
echo ""

# Check Node.js version
check_node() {
    echo "📦 Checking Node.js..."
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Install via: https://github.com/nvm-sh/nvm"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        echo "❌ Node.js v20+ required. Current: $(node -v)"
        echo "   Run: nvm install 20 && nvm use 20"
        exit 1
    fi
    echo "✅ Node.js $(node -v)"
}

# Check pnpm
check_pnpm() {
    echo "📦 Checking pnpm..."
    if ! command -v pnpm &> /dev/null; then
        echo "Installing pnpm..."
        npm install -g pnpm
    fi
    echo "✅ pnpm $(pnpm -v)"
}

# Install x402 dependencies
install_deps() {
    echo ""
    echo "📦 Installing x402 dependencies..."
    
    cd "$ROOT_DIR"
    
    # Core x402 packages
    npm install @x402/core @x402/evm @x402/svm @x402/axios @x402/fetch @x402/express
    
    # Wallet dependencies  
    npm install viem @solana/kit @scure/base
    
    echo "✅ x402 packages installed"
}

# Create .env template
create_env_template() {
    echo ""
    echo "📝 Creating .env template..."
    
    ENV_FILE="$ROOT_DIR/.env.x402"
    
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" << 'EOF'
# x402 Payment Protocol Configuration
# =====================================

# EVM Wallet Private Key (0x prefixed)
# For receiving payments (seller) or making payments (buyer)
EVM_PRIVATE_KEY=0x...

# Solana Wallet Private Key (base58 encoded)
# Optional - for Solana network support
SVM_PRIVATE_KEY=...

# EVM Address (for receiving payments as seller)
EVM_ADDRESS=0x...

# Solana Address (for receiving payments as seller)  
SVM_ADDRESS=...

# Facilitator URL
# Testnet: https://x402.org/facilitator
# Mainnet: Use Coinbase CDP or self-host
FACILITATOR_URL=https://x402.org/facilitator

# Resource Server URL (for MCP client mode)
RESOURCE_SERVER_URL=http://localhost:4021

# Endpoint Path (for MCP client mode)
ENDPOINT_PATH=/api/data

# Network Configuration
# eip155:84532 = Base Sepolia (testnet)
# eip155:8453 = Base Mainnet
# solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1 = Solana Devnet
# solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp = Solana Mainnet
DEFAULT_NETWORK=eip155:84532
EOF
        echo "✅ Created $ENV_FILE"
    else
        echo "⏭️  $ENV_FILE already exists"
    fi
}

# Setup gin-gonic (Go HTTP framework)
setup_gin() {
    echo ""
    echo "🔧 Setting up gin-gonic..."
    
    GIN_DIR="$X402_DIR/gin-gonic"
    
    if [ ! -d "$GIN_DIR" ]; then
        git clone https://github.com/gin-gonic/gin.git "$GIN_DIR"
        echo "✅ Cloned gin-gonic"
    else
        echo "⏭️  gin-gonic already exists"
    fi
}

# Fetch CAIP-2 spec
fetch_caip2() {
    echo ""
    echo "📄 Fetching CAIP-2 spec..."
    
    CAIP_FILE="$X402_DIR/docs/CAIP-2-original.md"
    
    curl -sL "https://raw.githubusercontent.com/ChainAgnostic/CAIPs/main/CAIPs/caip-2.md" -o "$CAIP_FILE"
    echo "✅ Fetched CAIP-2 to $CAIP_FILE"
}

# Download llms-full.txt
fetch_llms_docs() {
    echo ""
    echo "📄 Fetching LLMs documentation..."
    
    LLMS_FILE="$X402_DIR/docs/llms-full-original.txt"
    
    curl -sL "https://docs.x402.org/llms-full.txt" -o "$LLMS_FILE" || echo "⚠️  Could not fetch llms-full.txt"
    
    if [ -f "$LLMS_FILE" ]; then
        echo "✅ Fetched llms-full.txt"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "🎉 x402 Integration Setup Complete!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Configure your wallet:"
    echo "   cp .env.x402 .env"
    echo "   # Edit .env with your private keys"
    echo ""
    echo "2. For BUYERS (make paid requests):"
    echo "   npm install @x402/axios @x402/evm"
    echo "   # See x402-coinbase/docs/guides/mcp-server-with-x402.md"
    echo ""
    echo "3. For SELLERS (receive payments):"
    echo "   npm install @x402/express @x402/core @x402/evm"
    echo "   # See x402-coinbase/docs/getting-started/quickstart-for-sellers.mdx"
    echo ""
    echo "4. Run the whitepaper conversion:"
    echo "   bash x402-coinbase/scripts/convert-whitepaper-to-md.sh"
    echo ""
    echo "📚 Documentation:"
    echo "   - x402-coinbase/docs/llms-full.md"
    echo "   - x402-coinbase/docs/CAIP-2.md"
    echo "   - x402-coinbase/docs/guides/mcp-server-with-x402.md"
    echo ""
    echo "💰 Give Claude Money!"
    echo "   npx @nirholas/universal-crypto-mcp"
    echo ""
}

# Main
main() {
    check_node
    check_pnpm
    install_deps
    create_env_template
    setup_gin
    fetch_caip2
    fetch_llms_docs
    print_summary
}

main "$@"

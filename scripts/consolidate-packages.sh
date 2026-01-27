#!/bin/bash
# Consolidate duplicate packages and integrate with x402
# Run from repo root: ./scripts/consolidate-packages.sh

set -e
cd "$(dirname "$0")/.."

echo "🔄 Agenti Package Consolidation"
echo "================================"
echo ""

# ============================================================
# PHASE 1: Remove duplicates (keep newer/better version)
# ============================================================
echo "📦 Phase 1: Removing duplicates..."

# Binance: Keep Binance-MCP (newer), remove binance-mcp-server
if [ -d "packages/Binance-MCP" ] && [ -d "packages/binance-mcp-server" ]; then
  echo "  - Removing packages/binance-mcp-server (keeping Binance-MCP)"
  rm -rf packages/binance-mcp-server
fi

# Binance US: Keep Binance-US-MCP (newer), remove binance-us-mcp-server
if [ -d "packages/Binance-US-MCP" ] && [ -d "packages/binance-us-mcp-server" ]; then
  echo "  - Removing packages/binance-us-mcp-server (keeping Binance-US-MCP)"
  rm -rf packages/binance-us-mcp-server
fi

# ============================================================
# PHASE 2: Normalize naming (kebab-case)
# ============================================================
echo ""
echo "📝 Phase 2: Normalizing package names..."

# Function to rename if exists
rename_pkg() {
  if [ -d "packages/$1" ] && [ ! -d "packages/$2" ]; then
    echo "  - Renaming $1 -> $2"
    mv "packages/$1" "packages/$2"
  fi
}

rename_pkg "AI-Agents-Library" "ai-agents-library"
rename_pkg "Binance-MCP" "binance-mcp"
rename_pkg "Binance-US-MCP" "binance-us-mcp"
rename_pkg "UCAI" "ucai"
rename_pkg "XActions" "xactions"

# ============================================================
# PHASE 3: Categorize packages
# ============================================================
echo ""
echo "📂 Phase 3: Categorizing packages..."

# Create category directories
mkdir -p packages/exchanges    # Binance, etc
mkdir -p packages/chains       # EVM chains, Solana
mkdir -p packages/data         # Market data, news
mkdir -p packages/tools        # Tool discovery, registry
mkdir -p packages/wallets      # Wallet toolkits
mkdir -p packages/generators   # UCAI, github-to-mcp
mkdir -p packages/protocols    # x402, Sperax
mkdir -p packages/social       # XActions, Twitter
mkdir -p packages/infra        # MCP notify, openbare

# Move packages to categories (if not already moved)
move_to_category() {
  local pkg=$1
  local category=$2
  if [ -d "packages/$pkg" ] && [ ! -d "packages/$category/$pkg" ]; then
    echo "  - Moving $pkg -> $category/"
    mv "packages/$pkg" "packages/$category/"
  fi
}

# Exchanges
move_to_category "binance-mcp" "exchanges"
move_to_category "binance-us-mcp" "exchanges"

# Chains
move_to_category "bnbchain-mcp" "chains"

# Data
move_to_category "crypto-market-data" "data"
move_to_category "crypto-market-data-ts" "data"
move_to_category "crypto-data-aggregator" "data"
move_to_category "free-crypto-news" "data"

# Tools
move_to_category "lyra-registry" "tools"
move_to_category "lyra-tool-discovery" "tools"
move_to_category "lyra-intel" "tools"
move_to_category "ai-agents-library" "tools"
move_to_category "defi-agents" "tools"

# Wallets
move_to_category "ethereum-wallet-toolkit" "wallets"
move_to_category "solana-wallet-toolkit" "wallets"
move_to_category "sweep" "wallets"

# Generators
move_to_category "ucai" "generators"
move_to_category "github-to-mcp" "generators"
move_to_category "extract-llms-docs" "generators"

# Protocols
move_to_category "x402-ecosystem" "protocols"
move_to_category "x402-stablecoin" "protocols"
move_to_category "sperax-crypto-mcp" "protocols"

# Social
move_to_category "xactions" "social"

# Infra
move_to_category "mcp-notify" "infra"
move_to_category "openbare" "infra"

# Web (React apps for plugin.delivery)
mkdir -p packages/web
move_to_category "lyra-web3-playground" "web"

echo ""
echo "✅ Consolidation complete!"
echo ""
echo "New structure:"
find packages -maxdepth 2 -type d | head -50

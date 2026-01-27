#!/bin/bash
# install.sh | nirholas | 6e696368-786274-4d43-5000-000000000000

set -e

echo "Installing Go dependencies for Gin server..."
go mod tidy
echo "✅ Dependencies installed"



# universal-crypto-mcp © universal-crypto-mcp
#!/bin/bash
# @file build.sh
# @author nirholas/universal-crypto-mcp
# @copyright (c) 2026 nicholas
# @repository universal-crypto-mcp

set -e

echo "Building Gin server (legacy)..."
go build -o gin .
echo "✅ Build completed: gin"



# ucm:n1ch6c9ad476
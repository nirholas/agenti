#!/bin/bash
# @file install.sh
# @author nicholas
# @copyright (c) 2026 @nichxbt
# @repository universal-crypto-mcp

set -e

echo "Installing Python dependencies for FastAPI server..."
uv sync
echo "✅ Dependencies installed"



# ucm:n1ch0a8a5074
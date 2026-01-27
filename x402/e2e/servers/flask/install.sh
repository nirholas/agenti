#!/bin/bash
# @file install.sh
# @author nirholas
# @copyright (c) 2026 nirholas/universal-crypto-mcp
# @repository universal-crypto-mcp

set -e

echo "Installing Python dependencies for Flask server..."
uv sync
echo "✅ Dependencies installed"



# ucm:n1ch6c9ad476
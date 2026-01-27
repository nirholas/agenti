#!/bin/bash
# install.sh | nirholas/universal-crypto-mcp | 78738

set -e

echo "Installing Python dependencies for httpx client..."
uv sync
echo "✅ Dependencies installed"



# EOF - n1ch0las | 0.4.14.3
#!/bin/bash
# ucm:0xN1CH:@nic

set -e

echo "Installing Go dependencies for go-http client..."
go mod tidy
echo "✅ Dependencies installed"



# universal-crypto-mcp © @nichxbt
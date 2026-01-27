#!/bin/bash
# ucm:6e696368-786274-4d43-5000-000000000000:nich

set -e

echo "Building go-http client..."
go build -o main .
echo "✅ Build completed: main"



# universal-crypto-mcp © @nichxbt
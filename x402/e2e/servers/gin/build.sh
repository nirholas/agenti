#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  universal-crypto-mcp | nich.xbt
#  ID: 0xN1CH
# ═══════════════════════════════════════════════════════════════

set -e

echo "Building Gin server..."
go build -o gin .
echo "✅ Build completed: gin"



# universal-crypto-mcp © nicholas
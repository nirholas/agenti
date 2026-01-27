#!/bin/bash
set -e

# Usage: ./scripts/import-repo.sh <repo-url> <module-name> [--package]

REPO_URL=$1
MODULE_NAME=$2
IS_PACKAGE=${3:-""}

if [ -z "$REPO_URL" ] || [ -z "$MODULE_NAME" ]; then
  echo "Usage: $0 <repo-url> <module-name> [--package]"
  echo ""
  echo "Examples:"
  echo "  $0 https://github.com/user/crypto-alerts alerts"
  echo "  $0 https://github.com/user/trading-bot trading-bot --package"
  exit 1
fi

TEMP_DIR=$(mktemp -d)
echo "📦 Cloning $REPO_URL..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR"

if [ "$IS_PACKAGE" == "--package" ]; then
  TARGET_DIR="packages/$MODULE_NAME"
  echo "📁 Creating package at $TARGET_DIR"
  
  mkdir -p "$TARGET_DIR"
  rsync -av --exclude='.git' "$TEMP_DIR/" "$TARGET_DIR/"
  
  echo "✅ Package created at $TARGET_DIR"
  echo ""
  echo "Next steps:"
  echo "  1. Update $TARGET_DIR/package.json name to @nirholas/$MODULE_NAME"
  echo "  2. Run: npm install"
  
else
  TARGET_DIR="src/modules/$MODULE_NAME"
  echo "📁 Creating module at $TARGET_DIR"
  
  mkdir -p "$TARGET_DIR"
  
  if [ -d "$TEMP_DIR/src" ]; then
    cp -r "$TEMP_DIR/src/"* "$TARGET_DIR/" 2>/dev/null || true
  fi
  
  find "$TEMP_DIR" -maxdepth 1 -name "*.ts" -exec cp {} "$TARGET_DIR/" \; 2>/dev/null || true
  
  # Create index.ts if missing
  if [ ! -f "$TARGET_DIR/index.ts" ]; then
    MODULE_PASCAL=$(echo "$MODULE_NAME" | sed -r 's/(^|-)(\w)/\U\2/g')
    cat > "$TARGET_DIR/index.ts" << EOF
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { register${MODULE_PASCAL}Tools } from "./tools.js"

export function register${MODULE_PASCAL}(server: McpServer) {
  register${MODULE_PASCAL}Tools(server)
}
EOF
  fi
  
  # Create tools.ts if missing  
  if [ ! -f "$TARGET_DIR/tools.ts" ]; then
    MODULE_PASCAL=$(echo "$MODULE_NAME" | sed -r 's/(^|-)(\w)/\U\2/g')
    cat > "$TARGET_DIR/tools.ts" << EOF
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function register${MODULE_PASCAL}Tools(server: McpServer) {
  server.tool(
    "${MODULE_NAME}_example",
    "Example tool - replace with actual implementation",
    {
      input: z.string().describe("Input parameter")
    },
    async ({ input }) => {
      return {
        content: [{ type: "text", text: \\\`Received: \\\${input}\\\` }]
      }
    }
  )
}
EOF
  fi
  
  echo "✅ Module created at $TARGET_DIR"
  echo ""
  echo "Next steps:"
  echo "  1. Edit $TARGET_DIR/tools.ts"
  echo "  2. Register in src/server/base.ts"
fi

rm -rf "$TEMP_DIR"

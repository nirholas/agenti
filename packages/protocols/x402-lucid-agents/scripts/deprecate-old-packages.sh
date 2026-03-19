#!/bin/bash
# Run this after publishing new @lucid-agents packages with simplified names
# Requires npm publish permissions

set -e

echo "Deprecating old package names..."

npm deprecate @lucid-agents/agent-kit "Package renamed to @lucid-agents/core. Please migrate to the new package name."
npm deprecate @lucid-agents/agent-kit-identity "Package renamed to @lucid-agents/identity. Please migrate to the new package name."
npm deprecate @lucid-agents/agent-kit-payments "Package renamed to @lucid-agents/payments. Please migrate to the new package name."
npm deprecate @lucid-agents/agent-kit-hono "Package renamed to @lucid-agents/hono. Please migrate to the new package name."
npm deprecate @lucid-agents/agent-kit-tanstack "Package renamed to @lucid-agents/tanstack. Please migrate to the new package name."
npm deprecate @lucid-agents/create-agent-kit "Package renamed to @lucid-agents/cli. Please migrate to the new package name."

echo "✓ All old packages deprecated successfully"
echo ""
echo "Users will now see deprecation warnings when installing old package names."


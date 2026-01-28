#!/bin/bash
# Push openrouter.md to all nirholas repos
set -e

unset GITHUB_TOKEN

REPOS=(
  "agenti:/workspaces/agenti/docs/content/openrouter.md"
  "xactions:/workspaces/agenti/packages/social/xactions/docs/openrouter.md"
  "free-crypto-news:/workspaces/agenti/packages/data/free-crypto-news/docs/openrouter.md"
  "binance-mcp:/workspaces/agenti/packages/chains/binance-mcp/docs/openrouter.md"
  "binance-us-mcp:/workspaces/agenti/packages/chains/binance-us-mcp/docs/openrouter.md"
  "bnbchain-mcp:/workspaces/agenti/packages/chains/bnbchain-mcp/docs/openrouter.md"
  "sperax-crypto-mcp:/workspaces/agenti/packages/chains/sperax-crypto-mcp/docs/openrouter.md"
  "universal-crypto-mcp:/workspaces/agenti/packages/tools/universal-crypto-mcp/docs/openrouter.md"
  "github-to-mcp:/workspaces/agenti/packages/generators/github-to-mcp/docs/openrouter.md"
  "lyra-tool-discovery:/workspaces/agenti/packages/tools/lyra-tool-discovery/docs/openrouter.md"
  "lyra-intel:/workspaces/agenti/packages/tools/lyra-intel/docs/openrouter.md"
  "lyra-web3-playground:/workspaces/agenti/packages/web/lyra-web3-playground/docs/openrouter.md"
  "lyra-registry:/workspaces/agenti/packages/tools/lyra-registry/docs/openrouter.md"
  "crypto-data-aggregator:/workspaces/agenti/packages/data/crypto-data-aggregator/docs/openrouter.md"
  "mcp-notify:/workspaces/agenti/packages/tools/mcp-notify/docs/openrouter.md"
  "plugin-delivery:/workspaces/agenti/plugins/plugin.delivery/docs/openrouter.md"
  "defi-agents:/workspaces/agenti/packages/tools/defi-agents/docs/openrouter.md"
  "extract-llms-docs:/workspaces/agenti/packages/tools/extract-llms-docs/docs/openrouter.md"
  "shakespeare:/workspaces/agenti/packages/tools/ucai/docs/openrouter.md"
  "quests:/workspaces/agenti/packages/tools/ai-agents-library/docs/openrouter.md"
)

WORKDIR="/tmp/openrouter-docs-push"
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

for item in "${REPOS[@]}"; do
  repo="${item%%:*}"
  docpath="${item#*:}"
  
  echo "=== $repo ==="
  
  cd "$WORKDIR"
  rm -rf "$repo"
  
  if gh repo clone "nirholas/$repo" "$repo" 2>/dev/null; then
    cd "$repo"
    mkdir -p docs
    cp "$docpath" docs/openrouter.md
    git add docs/openrouter.md
    if git diff --cached --quiet; then
      echo "  No changes needed"
    else
      git commit -m "docs: Add OpenRouter integration documentation"
      git push
      echo "  ✅ Pushed successfully"
    fi
  else
    echo "  ⚠️ Could not clone repo"
  fi
done

echo ""
echo "=== All done ==="

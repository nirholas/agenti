#!/bin/bash
cd /workspaces/agenti

# Resize all logos to 128x128
echo "Resizing logos to 128x128..."
for f in logos/*.png; do
  convert "$f" -resize 128x128 "$f"
done

# Copy logos to app directories (20 apps)
# agenti uses agenti.png as requested
cp logos/agenti.png awesome-openrouter-pr/apps/agenti/logo.png
cp logos/1.png awesome-openrouter-pr/apps/ai-agents-library/logo.png
cp logos/2.png awesome-openrouter-pr/apps/binance-mcp/logo.png
cp logos/3.png awesome-openrouter-pr/apps/binance-us-mcp/logo.png
cp logos/4.png awesome-openrouter-pr/apps/bnbchain-mcp/logo.png
cp logos/5.png awesome-openrouter-pr/apps/crypto-data-aggregator/logo.png
cp logos/6.png awesome-openrouter-pr/apps/defi-agents/logo.png
cp logos/7.png awesome-openrouter-pr/apps/extract-llms-docs/logo.png
cp logos/8.png awesome-openrouter-pr/apps/free-crypto-news/logo.png
cp logos/9.png awesome-openrouter-pr/apps/github-to-mcp/logo.png
cp logos/10.png awesome-openrouter-pr/apps/lyra-intel/logo.png
cp logos/11.png awesome-openrouter-pr/apps/lyra-registry/logo.png
cp logos/12.png awesome-openrouter-pr/apps/lyra-tool-discovery/logo.png
cp logos/13.png awesome-openrouter-pr/apps/lyra-web3-playground/logo.png
cp logos/14.png awesome-openrouter-pr/apps/mcp-notify/logo.png
cp logos/15.png awesome-openrouter-pr/apps/plugin-delivery/logo.png
cp logos/16.png awesome-openrouter-pr/apps/sperax-crypto-mcp/logo.png
cp logos/17.png awesome-openrouter-pr/apps/ucai/logo.png
cp logos/18.png awesome-openrouter-pr/apps/universal-crypto-mcp/logo.png
cp logos/19.png awesome-openrouter-pr/apps/xactions/logo.png

# Also copy main logo
cp logos/agenti.png logo.png

echo "Done! All logos resized to 128x128 and copied."
ls -la awesome-openrouter-pr/apps/*/logo.png | wc -l

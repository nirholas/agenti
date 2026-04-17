# Scan GitHub: Crypto MCP Servers

status: complete

## Goal
Search GitHub for existing MCP (Model Context Protocol) servers that expose crypto/wallet/payment tools. We want to find patterns, avoid duplicating work, and potentially give credit or build on top of permissively-licensed code.

## Search queries

1. `MCP server crypto wallet` (repos)
2. `modelcontextprotocol crypto payment`
3. `MCP solana tools`
4. `MCP ethereum wallet`
5. `MCP server x402`

Also review these known repos (clone and inspect if public):
- https://github.com/nirholas/universal-crypto-mcp
- https://github.com/nirholas/bnbchain-mcp
- https://github.com/nirholas/Binance-MCP

## What to look for
- Tool schemas we haven't implemented (e.g., swap, bridge, NFT mint, on-ramp)
- Better transport patterns (SSE vs stdio)
- Auth patterns for MCP servers that hold private keys
- Any battle-tested MCP crypto server worth forking

## Output
For each relevant repo:
1. Full URL + license + star count
2. Tools it exposes that we don't have in `@agenti/mcp`
3. Any patterns worth adopting
4. Clone command + attribution

Write findings to: `prompts/results/scan-mcp-crypto-results.md`

Mark this file's status as `complete` when done.

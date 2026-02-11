# agenti

> Give AI agents access to money. Manage finances, trade cryptocurrency. MCP server for AI agents to interact with 20+ blockchains. 380+ tools for DeFi, DEX aggregation, security scanning, cross-chain bridges, QR payments. x402 enabled - AI agents can autonomously pay for premium APIs and trade with other agents. Works with Claude, ChatGPT, Cursor.

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

# MCP Server Overview

The Agenti Server provides AI agents with tools to interact with EVM-compatible blockchains.

---

## Quick Start

### Claude Desktop

```json
{
  "mcpServers": {
    "@nirholas/agenti": {
      "command": "npx",
      "args": ["-y", "@nirholas/@nirholas/agenti@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "@nirholas/agenti": {
      "command": "npx",
      "args": ["-y", "@nirholas/@nirholas/agenti@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

### SSE Mode

```json
{
  "mcpServers": {
    "@nirholas/agenti": {
      "command": "npx",
      "args": ["-y", "@nirholas/@nirholas/agenti@latest", "--sse"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

---

## 📚 Documentation

<div class="grid cards" markdown>

-   :material-tools:{ .lg .middle } **Tools Reference**

    ---

    Complete list of available MCP tools

    [:octicons-arrow-right-24: Tools](tools.md)

-   :material-plus-circle:{ .lg .middle } **Extended Tools**

    ---

    Advanced tools and integrations

    [:octicons-arrow-right-24: Extended Tools](tools-extended.md)

-   :material-ethereum:{ .lg .middle } **Universal EVM**

    ---

    Multi-chain EVM toolkit

    [:octicons-arrow-right-24: Universal EVM](universal-evm.md)

-   :material-cube-outline:{ .lg .middle } **EVM Module**

    ---

    Core EVM blockchain operations

    [:octicons-arrow-right-24: EVM Module](evm-module.md)

-   :material-book-open:{ .lg .middle } **Resources & Prompts**

    ---

    Built-in resources and prompts

    [:octicons-arrow-right-24: Resources](resources-prompts.md)

-   :material-code-tags:{ .lg .middle } **Development**

    ---

    Local setup and contribution guide

    [:octicons-arrow-right-24: Development](development.md)

</div>

---

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| BNB Smart Chain | 56 | ✅ |
| opBNB | 204 | ✅ |
| Arbitrum One | 42161 | ✅ |
| Ethereum | 1 | ✅ |
| Polygon | 137 | ✅ |
| Base | 8453 | ✅ |
| Optimism | 10 | ✅ |
| + Testnets | Various | ✅ |

---

## Local Development

```bash
git clone https://github.com/nirholas/agenti
cd @nirholas/agenti
bun install
bun dev:sse
```

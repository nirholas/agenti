# Build: README and Documentation

status: pending

## Goal
Write the top-level `README.md` for the agenti monorepo. It should be concise, code-first, and developer-facing. Think: npm package README style, not a landing page.

## Output file
`README.md` (overwrite any existing stub)

## Structure

```md
# agenti

Give any AI agent a crypto wallet and the ability to pay for things.

## Install

pnpm add @agenti/sdk

## 30-second example

[show examples/03-pay-for-api.ts condensed to ~10 lines]

## What it does

- **pay(url)** — make an HTTP request, auto-pay if the server returns 402
- **balance()** — get USDC + SOL balances
- **receive(params)** — create a payment invoice

## Agent frameworks

| Framework | Import |
|-----------|--------|
| LangChain | `@agenti/sdk/langchain` |
| Vercel AI | `@agenti/sdk/vercel-ai` |
| ElizaOS   | `@agenti/sdk/eliza` |
| CrewAI    | `agenti` (Python) |

## MCP server

npx @agenti/mcp

[list the 5 MCP tools with one-line descriptions]

## Packages

| Package | Description |
|---------|-------------|
| @agenti/core | Wallet generation (EVM + Solana) |
| @agenti/sdk | Pay, balance, receive + framework adapters |
| @agenti/mcp | MCP server with 5 wallet/payment tools |

## License

Apache-2.0
```

## Rules
- No marketing fluff. Just code + tables.
- Every code block must be real, runnable TypeScript.
- If framework adapters aren't built yet, mark them with `(coming soon)`.
- Keep it under 200 lines.

Mark this file's status as `complete` when done.

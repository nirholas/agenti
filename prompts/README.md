# Agenti Agent Prompts

Individual task prompts for building the agenti project. Each file is self-contained — agents can run them in any order.

## Status legend
- `status: pending` — not started
- `status: complete` — done, output committed

## Scan agents (run first — inform the build agents)

| File | What it does |
|------|-------------|
| [scan-framework-adapters.md](scan-framework-adapters.md) | Find LangChain/CrewAI/Eliza payment adapters on GitHub |
| [scan-x402-implementations.md](scan-x402-implementations.md) | Find x402 protocol implementations and facilitator servers |
| [scan-mcp-crypto.md](scan-mcp-crypto.md) | Find crypto MCP servers on GitHub |
| [scan-wallet-toolkits.md](scan-wallet-toolkits.md) | Evaluate user's own wallet toolkit repos for reuse |

Scan results are written to `prompts/results/`.

## Build agents

| File | Output | Depends on scan? |
|------|--------|-----------------|
| [build-langchain-adapter.md](build-langchain-adapter.md) | `packages/sdk/src/frameworks/langchain.ts` | Optional: scan-framework-adapters |
| [build-vercel-ai-adapter.md](build-vercel-ai-adapter.md) | `packages/sdk/src/frameworks/vercel-ai.ts` | Optional: scan-framework-adapters |
| [build-eliza-plugin.md](build-eliza-plugin.md) | `packages/sdk/src/frameworks/eliza.ts` | Optional: scan-framework-adapters |
| [build-crewai-adapter.md](build-crewai-adapter.md) | `packages/sdk-python/` (Python package) | Optional: scan-framework-adapters |
| [build-facilitator-server.md](build-facilitator-server.md) | `packages/facilitator/` | Optional: scan-x402 |
| [build-test-suite.md](build-test-suite.md) | `**/__tests__/*.test.ts` | None |
| [build-examples.md](build-examples.md) | `examples/` | None (notes if adapters missing) |
| [build-readme.md](build-readme.md) | `README.md` | None |
| [build-gitignore.md](build-gitignore.md) | `.gitignore`, `.env.example` | None |

## Setup agents

| File | Output |
|------|--------|
| [setup-ci.md](setup-ci.md) | `.github/workflows/ci.yml` + `publish.yml` |
| [setup-publishing.md](setup-publishing.md) | `tsup` build, dual ESM/CJS exports, changesets |

## Clone workflow reminder
When a scan agent finds a useful repo:
1. Clone to `/tmp/<repo-name>` (never inside agenti workspace)
2. Read and understand the relevant code
3. Rewrite it cleanly into the agenti package
4. Add attribution comment: `// Adapted from github.com/owner/repo (LICENSE)`
5. Only then commit and push agenti

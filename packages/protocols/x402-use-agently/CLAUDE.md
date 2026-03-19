# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bun-based TypeScript monorepo for `use-agently`, a CLI tool for the Agently platform — a decentralized marketplace for AI agents using ERC-8004 and the x402 payment protocol. The CLI manages local EVM wallets, discovers agents, and communicates with them via the A2A (Agent-to-Agent) protocol.

## Commands

```bash
# Install dependencies
bun install

# Build all packages (compiles to standalone binary via bun build --compile)
bun run build

# Run the CLI in development mode
bun run --filter use-agently dev

# Format code
bun run format

# Run tests
bun run test
```

All top-level commands use Turborepo (`turbo`) to orchestrate across packages.

## Local Dev Test Loop

`packages/localhost-aixyz` is the local testing infrastructure for the CLI. It is a private aixyz agent that serves a free A2A endpoint at `http://localhost:3000` so you can test `use-agently a2a` without hitting production agents or spending real funds.

```bash
# Terminal 1 — start the local agent (requires OPENAI_API_KEY in packages/localhost-aixyz/.env.local)
bun run --filter localhost-aixyz dev

# Terminal 2 — send a message via the CLI
use-agently a2a send --uri http://localhost:3000 -m "Hello!"
```

The agent exposes a free endpoint (`accepts: { scheme: "free" }`), so no wallet balance is needed. Set `OPENAI_API_KEY` in `packages/localhost-aixyz/.env.local` before starting the dev server.

Always use this agent when developing or testing changes to `use-agently` to maintain conformity and ensure every change is exercised end-to-end.

## Architecture

- **Monorepo**: Bun workspaces with `packages/*` layout, Turborepo for task orchestration
- **`packages/localhost-aixyz`**: Local development agent (private, not published)
  - `aixyz.config.ts` — Agent metadata and skills
  - `app/agent.ts` — Free A2A endpoint (`accepts: { scheme: "free" }`) with echo tool
  - `app/tools/echo.ts` — Simple echo tool for testing
- **`packages/use-agently-sdk`** (`@use-agently/sdk`): The SDK package (published to npm)
  - `client.ts` — `unstable_Client` type, `createClient()`, fetch wrappers (dry-run, payment)
  - `agently.ts` — Agently platform API (`search`, `getAgent` for ERC-8004 resolution)
  - `a2a.ts` — A2A protocol: `sendMessage`, `sendMessageStream`, `getAgentCard`, URL resolution
  - `mcp.ts` — MCP protocol: `listMcpTools`, `callMcpTool`, URL resolution
  - `wallets/` — Wallet interface and implementations (EVM private key)
  - `utils/` — Chain config, transaction mode types
- **`packages/use-agently`**: The CLI package
  - `src/bin.ts` — Executable entry point (`#!/usr/bin/env bun`)
  - `src/cli.ts` — Commander.js program setup, registers all commands
  - `src/config.ts` — Config persistence at `~/.use-agently/config.json` (load, save, backup)
  - `src/client.ts` — Creates `defaultClient` via `createClient()` with CLI user-agent; all CLI commands use this client
  - `src/commands/` — One file per CLI command (init, whoami, balance, agents, a2a)
  - Build output: `build/use-agently` (standalone binary via `bun build --compile`)

### SDK Architecture (`@use-agently/sdk`)

The SDK is structured in three layers: **client**, **platform**, and **protocol**. All new SDK work must follow this layering.

#### Client Layer (`client.ts`)

`unstable_Client` is the low-level primitive. It holds a configured `fetch` (with User-Agent, etc.) and nothing else. It does **not** bundle protocol logic. Create one via `createClient({ userAgent })`.

```ts
const client = createClient({ userAgent: "my-app:1.0" });
```

The CLI creates a single `defaultClient` in `src/client.ts` and passes it through to all SDK calls.

#### Platform Layer (`agently.ts`)

The Agently API layer (`api.use-agently.com`). Provides `search(client, options)` and `getAgent(client, id)` for agent discovery and ERC-8004 metadata resolution. All functions take `unstable_Client` as the first argument.

#### Protocol Layer (`a2a.ts`, `mcp.ts`)

Each protocol file owns its own URL resolution and communication logic. Protocol functions take `unstable_Client` as the first argument.

- **A2A** (`a2a.ts`): `sendMessage(client, uri, message, options?)`, `sendMessageStream(client, uri, message, options?)`, `getAgentCard(client, uri)`, `createA2AClient(client, uri, fetchImpl)`
- **MCP** (`mcp.ts`): `listMcpTools(uri, options?)`, `callMcpTool(uri, tool, args?, options?)`

#### Key Design Rules

1. **`unstable_Client` is always the first parameter** — every SDK function that makes network requests takes `client: unstable_Client` as its first argument. This provides the configured `fetch`. Never use bare `fetch` or `clientFetch` in protocol-level code.

2. **Protocol-level URL resolution** — each protocol handles its own URI → URL mapping. A2A has `getAgentCardURL()` (appends `/.well-known/agent-card.json`). MCP has `resolveMcpUrl()`. The client layer does **not** resolve URLs.

3. **ERC-8004 resolution via `getAgent()`** — ERC-8004 URIs (`eip155:...`) are resolved through `getAgent(client, id)` from `agently.ts`. Each protocol finds its service entry by name (e.g., `services.find(s => s.name === "a2a")`). No shortname resolution — URIs are either HTTP(S) URLs or ERC-8004 CAIP-19 IDs.

4. **Transaction mode via `options.mode`** — payment behavior is controlled by `options?: { mode?: TransactionMode }`. `DryRunTransaction` (default) intercepts 402s and throws `DryRunPaymentRequired`. `PayTransaction(wallet)` wraps fetch with x402 payment. The resolved fetch is derived from `client.fetch` via `resolveFetchForTransaction(mode, client.fetch)`.

5. **Don't export internal constants** — things like the User-Agent string are internal to the SDK. Tests should assert behavior (e.g., `toMatch("@use-agently/sdk:")`) not exact values.

6. **SDK tests SDK, CLI tests CLI** — SDK tests exercise SDK functions directly (e.g., `sendMessage`, `createA2AClient`). CLI tests exercise the CLI surface via `cli.parseAsync`. Never test SDK-level concerns (payment flows, client creation) in CLI test files.

7. **Inline option types** — prefer inline types for simple option bags: `options?: { mode?: TransactionMode }` rather than separate named interfaces, unless the type is reused across multiple functions.

### Wallet Abstraction

The wallet system is designed for extensibility. `Wallet` interface requires `type`, `address`, and `getX402Schemes()`. New wallet types are added by creating an implementation and registering it in the `loadWallet()` factory switch. Config stores `{ wallet: { type: "evm-private-key", ...fields } }`.

### Key Dependencies

- **commander** — CLI command framework
- **viem** — EVM wallet generation, account management, on-chain reads
- **@x402/fetch** + **@x402/evm** — Wraps fetch to auto-handle 402 Payment Required via x402 protocol
- **@a2a-js/sdk** — A2A protocol client (agent card resolution, JSON-RPC/REST transport)

## Tooling

- **Runtime/Package Manager**: Bun (>= 1.3.0)
- **Build**: Turborepo orchestrates tasks; Bun compiler creates standalone executables
- **Formatting**: Prettier (printWidth: 120), enforced via pre-commit hook (husky + lint-staged)
- **CI**: GitHub Actions runs build, test, and format check on PRs

## Publishing

npm publishing is triggered by GitHub releases. Version is extracted from git tags (`v1.0.0` format). Tags containing `.beta` or similar publish with `next` dist-tag.

## Agent-First Design Principle

`use-agently` is built for AI agents as first-class users. Every new feature should be designed with this in mind:

- **Non-interactive by default** — all commands must work without a TTY; no interactive prompts unless an explicit `--interactive` flag is provided
- **Self-describing** — `use-agently --help` and `use-agently <command> --help` are the authoritative reference; `use-agently doctor` is the go-to health check
- **Machine-readable output** — prefer structured output (exit codes, predictable stdout) so agents can parse results without screen-scraping
- When in doubt, ask: _"Would an AI agent love to use this?"_

## CLI Design Specification

This section is the authoritative design plan for the `use-agently` CLI command surface. All new commands **must** follow these conventions.

### Command Taxonomy

Commands are grouped into four categories. New commands must be placed in one of these categories:

| Category               | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| **Lifecycle & Health** | Setup, diagnostics, identity, and wallet balance               |
| **Discovery**          | Browsing the Agently marketplace for agents, tools, and skills |
| **Operations**         | Configuration, wallet management, and CLI updates              |
| **Protocols**          | Direct protocol invocations (A2A, MCP, ERC-8004, HTTP)         |

### Subcommand Pattern

Commands that have subcommands use a **space separator**: `<command> <subcommand>`.

```
use-agently a2a send --uri "uri"
use-agently a2a card --uri "uri"
use-agently mcp tools --uri "uri"
use-agently mcp call --tool "tool" --args "args" --uri "uri"
```

### Full Command Reference

#### Lifecycle & Health

```bash
use-agently                        # Default: print available commands (same as --help)
use-agently help                   # Print available commands
use-agently doctor                 # Run environment and configuration health checks
use-agently whoami                 # Show current wallet type and address
use-agently balance                # Show on-chain wallet balance
```

#### Discovery

```bash
use-agently agents                 # List all agents on the marketplace
use-agently search [query]         # Search the marketplace
use-agently search [query] --protocol a2a,mcp,web  # Filter by protocol(s)
```

#### Operations

```bash
use-agently init                   # Initialize a wallet and config
use-agently update                 # Update the CLI to the latest version
```

#### Protocols

```bash
use-agently erc-8004 --uri "uri"                     # Resolve an ERC-8004 agent URI
use-agently a2a send --uri "uri/url" -m "message"    # Send a message via A2A protocol
use-agently a2a card --uri "uri/url"                 # Fetch and display the A2A agent card
use-agently mcp tools --uri "uri/url"                # List tools on an MCP server
use-agently mcp call --tool "tool" --args "args" --uri "uri/url" # Call a tool on an MCP server
use-agently web get <url>                            # HTTP GET with x402 payment support
use-agently web post <url>                           # HTTP POST with x402 payment support
use-agently web put <url>                            # HTTP PUT with x402 payment support
use-agently web patch <url>                          # HTTP PATCH with x402 payment support
use-agently web delete <url>                         # HTTP DELETE with x402 payment support
```

### Design Rules for New Commands

1. **No TTY assumed** — every command must work in a non-interactive, non-TTY environment (scripts, CI, agent pipelines). Never prompt for input.

2. **2-attempt error recovery** — if a command fails due to bad input, the error message must include enough information (expected type, shape, example) that the caller can succeed on the **second** attempt. A third attempt required is a design failure.

   Example of a good error:

   ```
   Error: <agent-uri> must be a URL (e.g. https://use-agently.com/echo-agent/) or a short name resolvable on Agently (e.g. echo-agent).
   ```

3. **Self-describing** — `use-agently`, `use-agently -h`, `use-agently help`, and `use-agently --help` must all print the same top-level help output listing available commands by category.

4. **Include examples in help** — every command's `--help` output should include at least one concrete usage example so agents can use it without guessing argument shapes.

5. **Structured output** — use exit codes to signal success/failure. For `--output json`, emit valid JSON to stdout so agents can parse results.

6. **Space subcommand convention** — use `command subcommand` (space separator) for protocol variants. Do not use colon separators.

## Documentation

When CLI commands, features, or behavior change, always update these files to keep them in sync:

- `README.md` — Project README (install, quick start, command reference, how it works)
- `CLAUDE.md` / `AGENTS.md` — Development guidance and CLI design specification (keep in sync)
- `skills/use-agently/SKILL.md` — General skill reference for AI agents; keep it focused on discovery (`doctor`, `--help`) rather than enumerating every flag

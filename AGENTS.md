# AGENTS.md

Operating notes for AI coding agents (Claude Code, Codex, Cursor, Copilot and others) working in this repository. Everything here is derived from the files actually in the tree, so trust it over guesses, and update it when the facts change.

## What this repository is

Give any AI agent a crypto wallet. Agents deserve access to money.  Pay x402 APIs, receive USDC, check balances - autonomously. Works with Claude, LangChain, AutoGen, CrewAI, and any MCP client. EVM + Solana.

- Homepage: https://agenti.cash
- Source: https://github.com/nirholas/agenti
- Primary language: TypeScript
- License: Other (see the LICENSE file)

## Repository layout

- `docs/`
- `examples/`
- `packages/`
- `prompts/`
- `scripts/`
- `README.md`
- `LICENSE`
- `package.json`

## Setup

```bash
pnpm install
```

## Commands

| Task | Command |
|---|---|
| dev | `pnpm run dev` |
| build | `pnpm run build` |
| test | `pnpm test` |
| typecheck | `pnpm run typecheck` |

Run the test and lint commands above before you consider a change finished. If a command fails on code you did not touch, say so in your report instead of silently skipping it.

## Conventions

- This is a monorepo (`workspaces` in `package.json`); run scripts from the root unless a package README says otherwise.
- `.env` files are gitignored; never commit credentials, and read configuration from environment variables.
- Commit messages follow Conventional Commits (`type(scope): summary`), matching the existing history.
- Read the surrounding code before adding to it, and match its naming, file organisation and error-handling style.
- Keep `README.md` accurate: if a change alters behaviour, commands or configuration, update the docs in the same commit.
- Do not leave TODO comments, stub functions, placeholder data or commented-out code behind. Finish what you start or leave it out.
- Small, focused commits with a subject line that describes the change, not the act of committing.

## Where to raise things

- Bugs and feature requests: https://github.com/nirholas/agenti/issues
- Questions and ideas: https://github.com/nirholas/agenti/discussions
- Security issues: report privately at https://github.com/nirholas/agenti/security/advisories/new, never in a public issue.

# Scan GitHub: Framework Payment Adapters

status: complete

## Goal
Search GitHub for existing open-source adapters that wire cryptocurrency payments or x402 into AI agent frameworks (LangChain, Vercel AI SDK, CrewAI, ElizaOS, AutoGen, DSPy). The goal is to avoid reinventing code that already exists under a permissive license.

## What to search for

Use the GitHub search API (https://api.github.com/search/repositories) or GitHub web search for each of the following queries:

1. `x402 langchain tool` — LangChain tool for x402 payments
2. `x402 vercel ai sdk` — Vercel AI SDK tool for payments
3. `crewai crypto payment tool` — CrewAI payment tools
4. `eliza plugin payment crypto` — ElizaOS payment plugins
5. `agent payment langchain` — general agent payment patterns
6. `x402 protocol typescript` — x402 client implementations

## Evaluation criteria for each result
- License must be MIT, Apache-2.0, or BSD (not GPL)
- Must have TypeScript or Python source
- Check if it implements x402 client logic we could adapt
- Check if it provides a clean framework adapter pattern we could follow

## Output
For each relevant repo found:
1. Full URL
2. License
3. What specifically is reusable (file path / function names)
4. Suggested clone command: `git clone <url> /tmp/<name>`
5. Attribution line to add to agenti source (e.g., `// Adapted from github.com/owner/repo (MIT)`)

Write your findings to: `prompts/results/scan-framework-adapters-results.md`

Mark this file's status as `complete` when done.

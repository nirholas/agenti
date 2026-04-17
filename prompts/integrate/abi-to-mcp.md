# Integrate: ABI-to-MCP Contract Generator

status: todo

## Source repo
https://github.com/nirholas/UCAI (ABI → MCP server generator, Python)

## Goal
Add a TypeScript CLI tool (`packages/cli/`) that takes any EVM smart contract
ABI (or address) and generates a ready-to-use MCP server that exposes each
contract function as an MCP tool. This makes any smart contract instantly
accessible to AI agents without writing integration code.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/UCAI /tmp/UCAI
```
Read:
- `/tmp/UCAI/src/abi_to_mcp/generator/server_generator.py`
- `/tmp/UCAI/src/abi_to_mcp/generator/tool_generator.py`
- `/tmp/UCAI/src/abi_to_mcp/fetchers/` (Etherscan, Sourcify fetchers)
- `/tmp/UCAI/src/abi_to_mcp/cli/` (command structure)
- `/tmp/UCAI/src/abi_to_mcp/generator/templates/` (output templates)

### 2. Create `packages/cli/`

```
packages/cli/
  src/
    commands/
      generate.ts   — agenti generate <address|abi-file> [--chain <chain>] [--out <dir>]
      deploy.ts     — agenti deploy (wraps x402-deploy workflow)
      register.ts   — agenti register <url> (registers on x402scan)
    abi/
      fetcher.ts    — fetch ABI from Etherscan / Sourcify / local file
      parser.ts     — parse ABI JSON into function specs
      generator.ts  — generate MCP server TypeScript source
    templates/
      mcp-server.ts.template  — template for generated server
    index.ts        — CLI entrypoint (commander.js)
  package.json
  tsconfig.json
```

### 3. `abi/fetcher.ts`

```ts
export async function fetchAbi(
  source: string,  // 0x address, .json file path, or URL
  chain?: string   // 'base', 'eth', 'bsc', 'arbitrum'
): Promise<AbiItem[]>
```

Sources in order:
1. If file path: read local JSON
2. If URL: fetch directly
3. If 0x address: try Etherscan → Sourcify → 4byte.directory

Etherscan API: `https://api.etherscan.io/api?module=contract&action=getabi&address={addr}`
Use ETHERSCAN_API_KEY env var if set (free tier fine without).

### 4. `abi/generator.ts`

```ts
export function generateMcpServer(
  abi: AbiItem[],
  options: {
    contractAddress: string
    contractName?: string
    chain?: string
    rpc?: string
  }
): string  // TypeScript source code for the MCP server
```

Each ABI function maps to one MCP tool:
- `view`/`pure` functions → read-only tools (no signing needed)
- `nonpayable` functions → write tools (require private key)
- `payable` functions → write tools with ETH value input
- `event` definitions → skip (not callable)

Tool input schema is derived from function inputs:
- `uint256/int256` → `z.string()` (bigint as string)
- `address` → `z.string().regex(/^0x[0-9a-fA-F]{40}$/)`
- `bool` → `z.boolean()`
- `string/bytes` → `z.string()`
- arrays → `z.array(...)`

### 5. CLI commands

**`agenti generate <address> --chain base --out ./my-contract-mcp`**
Fetches ABI, generates an MCP server in the output directory.

**`agenti register <url>`**
POSTs to x402scan registry: `https://x402scan.com/api/x402/registry/register-origin`

**`agenti serve <abi-file> --port 3000`**
Generates and immediately serves the MCP server (no file write).

### 6. Generated server template

The generated `server.ts` should:
- Import `@agenti/sdk` for payment gating (optional)
- Create one MCP tool per ABI function
- Use viem's `readContract`/`writeContract`
- Accept RPC URL and optional private key from env vars
- Be immediately runnable with `node server.js`

### 7. `package.json`
```json
{
  "name": "@agenti/cli",
  "version": "0.1.0",
  "description": "CLI for generating MCP servers from smart contract ABIs and deploying x402-gated APIs",
  "bin": { "agenti": "./dist/index.js" },
  "dependencies": {
    "commander": "^12.0.0",
    "viem": "^2.21.0",
    "@agenti/sdk": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.10.0",
    "zod": "^3.23.0"
  }
}
```

### 8. Update workspace
Add `"packages/cli"` to `pnpm-workspace.yaml`.

## Sensitivity check
UCAI is MIT licensed. The core concept (ABI → tool mapping) is a standard
technique published in multiple articles. The fetcher logic (Etherscan/Sourcify)
uses public APIs. Implement the TypeScript version from scratch using UCAI's
Python logic as a specification — no code copy needed.

## Output files
- `packages/cli/src/commands/generate.ts`
- `packages/cli/src/commands/deploy.ts`
- `packages/cli/src/commands/register.ts`
- `packages/cli/src/abi/fetcher.ts`
- `packages/cli/src/abi/parser.ts`
- `packages/cli/src/abi/generator.ts`
- `packages/cli/src/templates/mcp-server.ts.template`
- `packages/cli/src/index.ts`
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- Updated `pnpm-workspace.yaml`

Mark this file's status as `complete` when done.

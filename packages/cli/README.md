# @agenti/cli

Turn a deployed smart contract into a working MCP server, and list an x402-gated
API so other agents can find it.

Every read function on the contract becomes an MCP tool, so an agent can query
the contract in plain language without anyone hand-writing a wrapper.

## Install

```bash
npm install -g @agenti/cli
# or run it without installing
npx @agenti/cli generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

## Generate an MCP server from a contract

```bash
agenti generate 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --chain base \
  --name "USDC on Base" \
  --out ./usdc-mcp
```

The CLI fetches the verified ABI from the chain's block explorer, maps each
readable function to an MCP tool with a typed schema, and writes a runnable
server into `--out`.

| Option | Default | Description |
| --- | --- | --- |
| `--chain <chain>` | `mainnet` | `mainnet`, `base`, `arbitrum`, `optimism`, `polygon`, or `bsc`. |
| `--out <dir>` | `./contract-mcp` | Where to write the generated server. |
| `--name <name>` | contract name from the explorer | Display name used in the tool descriptions. |
| `--rpc <url>` | public RPC for the chain | Custom RPC endpoint. |

Then run it:

```bash
cd usdc-mcp
npm install
RPC_URL=https://mainnet.base.org node dist/index.js
```

An unverified contract has no published ABI, so `generate` will fail with the
explorer's error rather than guess at the interface.

## Register a paid API

```bash
agenti register https://api.example.com \
  --name "Report Generator" \
  --description "Generates market reports, 0.10 USDC per call"
```

Lists an x402-gated endpoint on [x402scan](https://x402scan.com) so paying
agents can discover it. The URL must already be serving x402 payment
requirements; see [`@agenti/sdk`](../sdk) for the handler wrappers that produce
them.

## Related

- [`@agenti/sdk`](../sdk) gates the endpoint you are registering.
- [`@agenti/mcp`](../mcp) is the general-purpose wallet MCP server.

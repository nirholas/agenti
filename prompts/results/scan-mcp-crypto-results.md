# MCP Crypto/Wallet/Payment Server Research
**Date:** 2026-04-17  
**Status:** complete  
**Scope:** Public GitHub repos exposing crypto, wallet, and payment tools via Model Context Protocol

---

## Table of Contents
1. [nirholas/universal-crypto-mcp](#1-nirholasuniversal-crypto-mcp)
2. [nirholas/bnbchain-mcp](#2-nirholasbnbchain-mcp)
3. [nirholas/Binance-MCP](#3-nirholasbinance-mcp)
4. [nirholas/ethereum-wallet-toolkit](#4-nirholasethereumwallettoolkit)
5. [armorwallet/armor-crypto-mcp](#5-armorwalletarmor-crypto-mcp)
6. [dcSpark/mcp-cryptowallet-evm](#6-dcsparkMCP-cryptowallet-evm)
7. [sendaifun/solana-mcp](#7-sendaifunsolana-mcp)
8. [AbdelStark/bitcoin-mcp](#8-abdel-starkbitcoin-mcp)
9. [strangelove-ventures/web3-mcp](#9-strangelove-venturesweb3-mcp)
10. [crazyrabbitLTC/mcp-ethers-server](#10-crazyrabbitltcmcp-ethers-server)
11. [magnetai/mcp-free-usdc-transfer](#11-magnetaimcp-free-usdc-transfer)
12. [MetaMask/mcp-x402](#12-metamaskmcp-x402)
13. [microchipgnu/MCPay](#13-microchipgnumcpay)
14. [FlowMCP/x402-mcp-middleware](#14-flowmcpx402-mcp-middleware)
15. [Coinbase x402 MCP Example](#15-coinbase-x402-mcp-example)
16. [Curated Lists & Ecosystem Overview](#16-curated-lists--ecosystem-overview)
17. [Patterns & Recommendations](#17-patterns--recommendations)

---

## 1. nirholas/universal-crypto-mcp

**URL:** https://github.com/nirholas/universal-crypto-mcp  
**Stars:** 30 | **License:** Apache-2.0  
**Clone:** `git clone https://github.com/nirholas/universal-crypto-mcp.git`  
**Attribution:** nirholas — Apache-2.0

### Description
Universal MCP server for AI agents to interact with any blockchain via natural language and plugins. Supports 380+ tools across swaps, bridges, staking, lending, and payments across Ethereum, Arbitrum, Base, Polygon, BSC, and testnets.

### Tools & Capabilities
- **DEX/Swaps:** Token swaps via 1inch, 0x, ParaSwap aggregators; LP management
- **Bridges:** Cross-chain transfers via LayerZero, Stargate, Wormhole
- **DeFi:** Aave/Compound lending, Lido liquid staking, yield farming
- **Market Data:** CoinGecko prices, DefiLlama TVL, LunarCrush sentiment
- **Security:** Rug pull detection, honeypot checks, GoPlus token analysis
- **Governance:** Snapshot votes, on-chain proposals
- **ENS/Domains:** Registration, transfers, renewals, record management
- **Technical Indicators:** 50+ indicators (RSI, MACD, Bollinger Bands)
- **Wallet Analytics:** Whale tracking, cross-chain behavior analysis
- **x402 Payment Tools (14 dedicated tools):**
  - `x402_pay_request` — automatic API payment handling
  - `x402_balance` — USDC/USDs + native balance checks
  - `x402_send` — direct payments
  - `x402_batch_send` — batched transactions
  - `x402_gasless_send` — gasless transfers via relayer
  - Supported networks: Base, Arbitrum, Ethereum, Polygon, Solana

### Transport Pattern
Three modes:
- **stdio** — Claude Desktop, Cursor (default)
- **HTTP** — ChatGPT Developer Mode
- **SSE** — Legacy HTTP clients

### Key Management
- `PRIVATE_KEY` env var for write operations (swaps, transfers, deployments)
- `X402_PRIVATE_KEY` for payment operations
- Read-only mode requires no credentials
- Third-party API keys: `COINGECKO_API_KEY`, `LUNARCRUSH_API_KEY`, custom RPC URLs

### Monorepo Architecture
10+ integrated packages: `core/`, `trading/`, `market-data/`, `defi/`, `wallets/`, `payments/`, `automation/`, `generators/`. Includes ABI-to-MCP and repo-to-MCP meta-tools. Also integrates 11 community MCP servers (Kukapay, Shinzo Labs, GoPlausible, etc.) with attribution.

### Worth Noting
- USDs stablecoin integration with ~5% APY auto-yield on held funds
- Plugin/community MCP aggregation model is a strong reference for `@agenti/mcp` extensibility

---

## 2. nirholas/bnbchain-mcp

**URL:** https://github.com/nirholas/bnbchain-mcp  
**Stars:** 24 | **License:** Apache-2.0  
**Clone:** `git clone https://github.com/nirholas/bnbchain-mcp.git`  
**Attribution:** nirholas — Apache-2.0

### Description
MCP server enabling AI assistants to interact with BNB Chain and opBNB via natural language. 165+ tools across blockchain operations, DeFi, and market data.

### Tools & Capabilities
- **Blockchain Core (45+):** transactions, blocks, balances, gas estimation, nonces
- **Token Operations (30+):** ERC-20 transfers, approvals, ERC-721/ERC-1155 NFT metadata
- **DeFi (50+):** DEX swaps, lending rates, yield farming, liquidity pools
- **Security (15+):** honeypot detection, rug pull assessment, GoPlus token verification
- **Market Data (25+):** prices, OHLCV, trending coins, TVL via CoinGecko/DefiLlama

### Transport Pattern
Same three-mode pattern: stdio / HTTP / SSE  
Runs via `npx @nirholas/bnb-chain-mcp@latest` — no install required.

### Key Management
- Optional `PRIVATE_KEY` env var; read-only mode without it
- API keys for external services: CoinGecko, LunarCrush, DefiLlama
- Keys never persisted — memory-only during runtime

### Networks
BNB Chain (56), opBNB (204), Ethereum (1), Arbitrum (42161), Polygon (137), Base (8453), Optimism (10), Avalanche, Fantom, Gnosis — plus BSC Testnet, Sepolia, Goerli.

### Config Example
```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/bnb-chain-mcp@latest"],
      "env": { "PRIVATE_KEY": "0x..." }
    }
  }
}
```

### Tech Stack
TypeScript, Node.js 18+, Bun, `viem` for EVM interactions

---

## 3. nirholas/Binance-MCP

**URL:** https://github.com/nirholas/Binance-MCP  
**Stars:** 22 | **License:** MIT  
**Clone:** `git clone https://github.com/nirholas/Binance-MCP.git`  
**Attribution:** nirholas — MIT

### Description
478+ tool MCP server covering every Binance API endpoint — spot trading, futures, margin, staking, NFT, algo trading, and more.

### Tools & Capabilities (24+ modules)
| Module | Tool Count |
|--------|-----------|
| Spot Trading | 35+ |
| Futures (USD-M & COIN-M) | 75+ |
| Margin Trading | 41 |
| Wallet & Transfers | 40+ |
| Staking & Earn | 37+ |
| Options, Mining, NFT | 50+ |
| Algo Trading, Pay, C2C/P2P | 35+ |
| Portfolio Margin, Copy Trading, Crypto Loans | additional |

### Transport Pattern
- **STDIO** — Claude Desktop, Cursor
- **SSE** — Web applications, ChatGPT (serves on localhost:3000)

### Key Management
- `BINANCE_API_KEY` + `BINANCE_API_SECRET` via `.env` file
- "API credentials never leave your machine" — local-only model
- Recommends IP restrictions and withdrawal limits

### Architecture Pattern
Modular registration — each Binance API module registers independently. Project structure: `src/modules/` → `src/tools/` → `src/server/` (STDIO/SSE transport layers) → `src/config/` (client init).

### Tech Stack
TypeScript 5.0+, Node.js ≥ 18, MCP SDK 1.11.0, official Binance SDKs, Express

---

## 4. nirholas/ethereum-wallet-toolkit

**URL:** https://github.com/nirholas/ethereum-wallet-toolkit  
**Stars:** 19 | **License:** MIT  
**Clone:** `git clone https://github.com/nirholas/ethereum-wallet-toolkit.git`  
**Attribution:** nirholas — MIT

### Description
Python toolkit for Ethereum wallets with both CLI tools and multiple dedicated MCP server implementations. Focuses on secure wallet generation, HD derivation, keystores, and typed data signing.

### MCP Servers
- `ethereum-wallet-mcp` — core wallet functionality
- `keystore-mcp-server` — Web3 Secret Storage V3 management
- `signing-mcp-server` — EIP-712 typed data signing
- `transaction-mcp-server` — transaction handling
- `validation-mcp-server` — address/data validation

### Key Management Approach
- BIP39 mnemonics + BIP44 HD derivation paths
- Web3 Secret Storage V3 keystore encryption
- Offline-first architecture (dedicated offline build components)
- No server-side key storage

### Tech Stack
Python (43.5%), TypeScript (3.9%), HTML (49% — docs/UI build). Supports vanity address generation.

### Worth Noting
Decomposed MCP-per-concern pattern (separate servers for wallet gen, keystore, signing, tx, validation) is worth evaluating for security isolation in `@agenti/mcp`.

---

## 5. armorwallet/armor-crypto-mcp

**URL:** https://github.com/armorwallet/armor-crypto-mcp  
**Stars:** 184 | **License:** GPL-3.0  
**Clone:** `git clone https://github.com/armorwallet/armor-crypto-mcp.git`  
**Attribution:** armorwallet — GPL-3.0 (copyleft — not suitable for MIT/Apache agenti packages)

### Description
Python-based MCP server enabling AI agents to interact with the crypto ecosystem. Requires Armor NFT for API key access. Alpha (0.1.24+) with Solana primary support.

### Tools & Capabilities
- **Wallet Management:** grouping, organization, archiving of multiple wallets
- **Trading:** swaps, DCA (Dollar-Cost Averaging), scheduled orders, limit orders
- **Staking:** stake and unstake operations
- **Analysis:** token search, trending tokens, statistical calculators

### Auth Pattern (Unique)
- Requires Armor NFT to obtain API keys from https://codex.armorwallet.ai/
- NFT-gated API access is a distinct monetization/identity model
- No direct private key management — server-side via Armor's MPC infrastructure

### Transport Pattern
MCP server via `uvx` command, compatible with Claude Desktop, Cline, Cursor, n8n.

### Tech Stack
Python (99.1%), Docker support, `uv` package manager

### Worth Noting
NFT-gated API access model is interesting but GPL-3.0 and Python-only limits direct reuse. The DCA/limit order/scheduled trade concept is a useful capability pattern.

---

## 6. dcSpark/mcp-cryptowallet-evm

**URL:** https://github.com/dcSpark/mcp-cryptowallet-evm  
**Stars:** 9 | **License:** MIT  
**Clone:** `git clone https://github.com/dcSpark/mcp-cryptowallet-evm.git`  
**Attribution:** dcSpark — MIT

### Description
MCP server providing Ethereum and EVM-compatible blockchain operations via ethers.js v5. Focused on complete wallet lifecycle and transaction management.

### Tools & Capabilities
**Wallet Management:**
- `create_wallet` — random wallet creation
- `import_from_private_key` / `import_from_mnemonic` / `import_from_encrypted_json`
- `encrypt_wallet` — password-based encryption
- Address, public key, private key, mnemonic retrieval

**Blockchain Operations:**
- Balance queries, chain ID, gas price, nonce lookup
- Contract method calls (read-only)

**Transaction Handling:**
- `send_transaction`, `sign_transaction`, `populate_transaction`

**Signing & Verification:**
- `sign_message`, `verify_message`
- `sign_typed_data` (EIP-712), `verify_typed_data`

**Provider Methods:**
- Block/transaction retrieval, receipts, contract code inspection
- Storage position access, gas estimation, log retrieval with filters
- ENS resolution

### Key Management
- Optional `PRIVATE_KEY` env var
- In-memory wallet encryption via ethers.js
- Security warnings on private key exposure

### Tech Stack
TypeScript (97.6%), ethers.js v5, Node.js v16+, Jest

---

## 7. sendaifun/solana-mcp

**URL:** https://github.com/sendaifun/solana-mcp  
**Stars:** 156 | **License:** Apache-2.0  
**Clone:** `git clone https://github.com/sendaifun/solana-mcp.git`  
**Attribution:** sendaifun — Apache-2.0

### Description
MCP server for Solana blockchain built on the Solana Agent Kit. The most-starred Solana-specific MCP server found.

### Tools & Capabilities
| Tool | Description |
|------|-------------|
| `GET_ASSET` | Retrieve asset/token information |
| `DEPLOY_TOKEN` | Deploy new tokens |
| `GET_PRICE` | Fetch token pricing |
| `WALLET_ADDRESS` | Get wallet address |
| `BALANCE` | Check account balance |
| `TRANSFER` | Execute token transfers |
| `MINT_NFT` | Create and mint NFTs |
| `TRADE` | Execute token trades |
| `REQUEST_FUNDS` | Request devnet/testnet funds |
| `RESOLVE_DOMAIN` | Resolve Solana domain names |
| `GET_TPS` | Query network TPS |

### Key Management
- `SOLANA_PRIVATE_KEY` env var (required for write ops)
- `RPC_URL` env var
- Optional `OPENAI_API_KEY`

### Transport Pattern
Standard MCP JSON-RPC via stdio; configured via `claude_desktop_config.json` using `npx` or `node` invocation.

### Tech Stack
TypeScript, Node.js v16+, `@solana/web3.js`, `@modelcontextprotocol/sdk`, `solana-agent-kit`, pnpm

---

## 8. AbdelStark/bitcoin-mcp

**URL:** https://github.com/AbdelStark/bitcoin-mcp  
**Stars:** 74 | **License:** MIT  
**Clone:** `git clone https://github.com/AbdelStark/bitcoin-mcp.git`  
**Attribution:** AbdelStark — MIT

### Description
Bitcoin & Lightning Network MCP Server enabling AI models to interact with Bitcoin and Lightning via LNBits.

### Tools & Capabilities
1. **Key Generation** — Bitcoin key pairs (address, pubkey, WIF private key)
2. **Address Validation** — Verify Bitcoin address correctness
3. **Transaction Decoding** — Parse raw transactions to human-readable format
4. **Latest Block Query** — Block metadata (hash, height, timestamp, tx count)
5. **Transaction Details** — Fetch by TXID
6. **Lightning Invoice Decoding** — Parse BOLT11 invoices
7. **Lightning Payment** — Execute LNBits wallet payments
8. **Wallet Information** — LNBits account details

### Transport Pattern
Dual-mode:
- **STDIO** — Claude Desktop, Goose CLI (local subprocess)
- **SSE** — Remote HTTP endpoint for distributed deployments

### Key Management
- LNBits admin key + read key via env vars
- No embedded private key management — external LNBits wallet holds keys
- `.env` file, not stored server-side

### Tech Stack
TypeScript (97.4%), Node.js, `bitcoin` library, LNBits API client, Pino logging, Docker support

---

## 9. strangelove-ventures/web3-mcp

**URL:** https://github.com/strangelove-ventures/web3-mcp  
**Stars:** 94 | **License:** Apache-2.0  
**Clone:** `git clone https://github.com/strangelove-ventures/web3-mcp.git`  
**Attribution:** strangelove-ventures — Apache-2.0

### Description
"1 MCP to rule all them chains" — the broadest multi-chain coverage found. Supports 7+ blockchain ecosystems in a single server.

### Supported Chains & Tools
| Chain | Capabilities |
|-------|-------------|
| **Solana** | Balance checks, SPL tokens, Jupiter swaps |
| **Ethereum + EVM** | ETH/ERC-20, Arbitrum, Base, Optimism, BSC, Polygon, Avalanche, Berachain |
| **Cardano** | Balance queries, stake pool info, transaction history |
| **THORChain** | RUNE operations, cross-chain swaps |
| **UTXO Chains** | Bitcoin, Litecoin, Dogecoin, Bitcoin Cash |
| **XRP Ledger** | Balance checks, trustline creation |
| **TON** | Balance queries, transfers with memos |

**Core tools across chains:** `balance`, `transfer`, `swap`, `approve`, `transaction_history`, `address_validate`, `pool_info`

### Key Management
- Env vars in `.env` file (git-ignored)
- Key types: private keys (EVM, Solana), mnemonics (Cardano, XRP, TON)
- Feature flag system: `ENABLE_*_TOOLS` to minimize attack surface
- External API keys: Blockfrost (Cardano), TON Center

### Transport Pattern
Node.js MCP server, configured via `claude_desktop_config.json`, standard stdio.

---

## 10. crazyrabbitLTC/mcp-ethers-server

**URL:** https://github.com/crazyrabbitLTC/mcp-ethers-server  
**Stars:** 12 | **License:** MIT  
**Clone:** `git clone https://github.com/crazyrabbitLTC/mcp-ethers-server.git`  
**Attribution:** crazyrabbitLTC — MIT

### Description
Full ethers.js v6 wrapper as an AI tool for MCP. 20+ EVM network support.

### Tools & Capabilities
- **Core:** Network info, block/transaction data, wallet operations, gas estimation, ENS, message signing, unit conversion
- **ERC-20:** Token info, balance queries, transfers, approval management
- **ERC-721:** NFT operations, ownership tracking, metadata
- **ERC-1155:** Multi-token balance checks, batch transfers
- **Transactions:** Prepare → sign → broadcast workflow with gas optimization

### Key Management / Notable Pattern
- **Prepare-then-sign separation** — prevents inadvertent key exposure
- Private keys never stored on server; external signing supported (hardware wallets, offline signing)
- `.env` file; "Protect your `.env` file. Never expose Alchemy/Infura keys."

### Tech Stack
TypeScript, ethers.js v6, 20+ EVM chains (Ethereum, Polygon, Arbitrum, Base, etc.)

---

## 11. magnetai/mcp-free-usdc-transfer

**URL:** https://github.com/magnetai/mcp-free-usdc-transfer  
**Stars:** 20 | **License:** MIT  
**Clone:** `git clone https://github.com/magnetai/mcp-free-usdc-transfer.git`  
**Attribution:** magnetai — MIT

### Description
MCP server for feeless USDC transfers on Base using Coinbase CDP's MPC wallet infrastructure.

### Tools Exposed
- `transfer-usdc` — USDC transfers to on-chain addresses, ENS names, or BaseNames
- `create_coinbase_mpc_wallet` — Generate new Coinbase MPC wallet addresses

### Key Management (Notable Pattern)
- Uses **Coinbase MPC (Multi-Party Computation)** wallets — private key never fully exists in one place
- Wallet seed persisted locally at `~/Documents/mpc_info.json`
- Auth via `COINBASE_CDP_API_KEY_NAME` + `COINBASE_CDP_PRIVATE_KEY` env vars
- No traditional private key exposure

### Transport Pattern
npm-installable MCP server; Claude Desktop via `claude_desktop_config.json`.

### Worth Noting
MPC wallet model (Coinbase CDP) avoids raw private key exposure — a production-worthy key management approach suitable for `@agenti/mcp`.

---

## 12. MetaMask/mcp-x402

**URL:** https://github.com/MetaMask/mcp-x402  
**Stars:** 2 | **License:** MIT  
**Clone:** `git clone https://github.com/MetaMask/mcp-x402.git`  
**Attribution:** MetaMask — MIT

### Description
MCP server that generates x402 payment headers using a provided private key. Created by MetaMask as an x402 integration reference.

### Tools Exposed
- `CreateX402PaymentHeader` — Generates X-PAYMENT headers for a given payment request using the wallet
- `LookupAddress` — Retrieves the signer's address with lazy account creation

### Key Management
- Basic private key approach via env var
- Roadmap: "configurable key management and signing" + "integration with Delegation Toolkit" (MetaMask's ERC-7710 delegation system)

### Transport Pattern
Standard MCP protocol; invokable via MCP Inspector or any MCP-compatible AI application.

### Worth Noting
MetaMask Delegation Toolkit integration planned — would enable scoped, delegated signing without exposing raw keys.

---

## 13. microchipgnu/MCPay

**URL:** https://github.com/microchipgnu/MCPay  
**Stars:** 86 | **License:** Apache-2.0  
**Clone:** `git clone https://github.com/microchipgnu/MCPay.git`  
**Attribution:** microchipgnu — Apache-2.0

### Description
Open-source infrastructure for monetizing MCP servers via x402 "Payment Required" protocol. Enables per-call pricing for MCP tools.

### Architecture — Proxy-Mediated Payment Flow
1. Client requests trigger upstream calls
2. Services respond with HTTP 402 + pricing metadata
3. Payment proxy pays on-chain (if authorized) or delegates to client wallet
4. Confirmation triggers request retry, transparently
5. Results stream back with usage/revenue events

### Components
- **Registry:** Searchable index of monetized MCP servers at mcpay.tech/servers
- **Monetizer Proxy:** Wraps HTTP/MCP endpoints to enforce payment gates
- **SDK:** JavaScript package for custom server implementations
- **CLI:** Local stdio proxy for connecting to remote paid MCP servers

### Key Management
- EVM wallets: Private key signers (Base, Avalanche, IoTeX, Sei)
- SVM wallets: Solana secret keys
- API keys: Server-side credential authentication
- Pluggable signer implementations

### Transport Pattern
`StreamableHTTPClientTransport` — intercepts MCP requests, handles 402 responses, coordinates blockchain transactions, forwards results.

### Tech Stack
TypeScript (96.7%), Node.js, `@modelcontextprotocol/sdk`, Hono (server examples), pnpm monorepo

### Worth Noting
Best-in-class x402 + MCP integration with the most production-oriented proxy architecture. The pluggable signer model maps well to `@agenti/mcp`'s payment infrastructure.

---

## 14. FlowMCP/x402-mcp-middleware

**URL:** https://github.com/FlowMCP/x402-mcp-middleware  
**Stars:** 3 | **License:** MIT  
**Clone:** `git clone https://github.com/FlowMCP/x402-mcp-middleware.git`  
**Attribution:** FlowMCP — MIT

### Description
Express-compatible middleware for payment-gating MCP endpoints. Implements JSON-RPC 402 compliance with multi-network EVM support.

### Payment Flow (Challenge-Response)
1. Client calls restricted tool without payment
2. Server returns JSON-RPC error code 402 with payment options
3. Client resubmits with payment data in `_meta["x402/payment"]`
4. Server validates signature, optionally simulates tx, executes on-chain
5. Server returns result with confirmation in `_meta["x402/payment-response"]`

### Key Details
- Implements EIP-3009 (gas-efficient signatures) for EVM chains
- Multi-network routing — automatically routes to correct chain
- Pre-settlement transaction simulation available
- v2 stable (multi-network); v1 frozen for legacy support

### Tech Stack
JavaScript (100%), Express.js, JSON-RPC, EVM-compatible chains

---

## 15. Coinbase x402 MCP Example

**URL:** https://github.com/coinbase/x402/tree/main/examples/typescript/clients/mcp  
**Stars:** (part of coinbase/x402 monorepo) | **License:** Apache-2.0  
**Attribution:** Coinbase — Apache-2.0

### Description
Official Coinbase reference implementation showing how an MCP client handles x402-protected APIs. Also documented at https://docs.cdp.coinbase.com/x402/mcp-server.

### Tool Exposed
- `get-data-from-resource-server` — retrieves data from payment-gated endpoint; triggers automatic payment if HTTP 402 is encountered

### Payment Flow
1. Tool calls hit protected endpoint
2. HTTP 402 response with `PAYMENT-REQUIRED` header is received
3. `@x402/axios` wrapper parses payment requirements
4. Client signs payment using appropriate blockchain scheme
5. Request resubmitted with `PAYMENT-SIGNATURE` header
6. Protected data returned to user

### Key Management
```
EVM_PRIVATE_KEY=<hex-encoded key>   # for Ethereum-compatible wallets
SVM_PRIVATE_KEY=<base58-encoded>    # for Solana wallets
```
Stored in Claude Desktop config; network selection determined by server requirements in 402 response.

### Config Pattern
```json
{
  "mcpServers": {
    "demo": {
      "command": "pnpm",
      "args": ["--silent", "-C", "<path>/clients/mcp", "dev"],
      "env": {
        "EVM_PRIVATE_KEY": "<wallet-key>",
        "RESOURCE_SERVER_URL": "http://localhost:4021",
        "ENDPOINT_PATH": "/weather"
      }
    }
  }
}
```

### Tech Stack
TypeScript, Node.js v20+, pnpm v10, `@x402/axios`, `@modelcontextprotocol/sdk`

---

## 16. Curated Lists & Ecosystem Overview

### awesome-crypto-mcp-servers (badkk)
https://github.com/badkk/awesome-crypto-mcp-servers  
**Stars:** 131 | **Forks:** 50  
Key entries: Bankless Onchain, mcp-free-usdc-transfer, GOAT (200+ onchain actions), Solana Agent Kit (40+ protocol actions), EVM MCP Server (30+ EVM networks), whale-tracker-mcp, Heurist Mesh Agent, DexPaprika, Octav API MCP.

### awesome-blockchain-mcps (royyannick)
https://github.com/royyannick/awesome-blockchain-mcps  
Broader blockchain/Web3 MCP curated list.

### awesome-solana-mcp-servers (sendaifun)
https://github.com/sendaifun/awesome-solana-mcp-servers  
**Stars:** 52 | **Forks:** 34  
15+ Solana-specific MCP servers including: Aldrin Labs (21 RPC methods), Jupiter limit orders (dimitrov-d), AMOCA wallet analysis, MCP Meme Deployer, Hubble PumpFun analytics, SolMCP (Helius + Dexscreener + Pyth), daoCLI (DAO + bonding curves).

### TensorBlock/awesome-mcp-servers (Finance/Crypto section)
https://github.com/TensorBlock/awesome-mcp-servers/blob/main/docs/finance--crypto.md  
Comprehensive categorized list including: coin_api_mcp (CoinMarketCap), crypto-feargreed-mcp, cryptopanic-mcp-server, Dappier real-time crypto data.

### mark3labs/mcp-go-x402
https://github.com/mark3labs/mcp-go-x402  
Go implementation of x402 transport for MCP-Go clients and servers — the only Go implementation found.

### GOAT SDK
https://github.com/goat-sdk/goat  
200+ onchain actions across Ethereum, Solana, and Base. Framework-agnostic wallet plugin system; adapters for MCP.

---

## 17. Patterns & Recommendations

### Transport: What to Use for `@agenti/mcp`
**Recommendation: stdio as primary, HTTP/SSE as secondary.**
- All battle-tested implementations default to **stdio** for local/desktop use
- **SSE** is the standard for remote/web clients (ChatGPT plugin mode, API access)
- **Streamable HTTP** (newer MCP spec) used by MCPay's proxy — adopt this for the payment proxy layer
- Avoid SSE as primary; it's being superseded by streamable HTTP in newer MCP SDK versions

### Key/Wallet Management: Ranked Options

| Pattern | Examples | Recommendation |
|---------|----------|----------------|
| Raw `PRIVATE_KEY` env var | bnbchain-mcp, solana-mcp, most repos | Acceptable for MVP; document risks clearly |
| MPC wallet (Coinbase CDP) | magnetai/mcp-free-usdc-transfer | Best for production; no raw key exposure |
| Keystore encryption | dcSpark/mcp-cryptowallet-evm, ethereum-wallet-toolkit | Good for local storage; add password prompt |
| NFT-gated API (server-side custody) | armorwallet/armor-crypto-mcp | Interesting but requires external dependency |
| MetaMask Delegation Toolkit | MetaMask/mcp-x402 (planned) | Future-facing; monitor ERC-7710 adoption |

**Recommendation for `@agenti/mcp`:** Support raw private key env var for MVP + pluggable signer interface so MPC/hardware wallet/delegation patterns can be dropped in. Match MCPay's pluggable signer model.

### Tool Schema Patterns Worth Adopting

1. **Feature flags for tool registration** (strangelove-ventures/web3-mcp): `ENABLE_EVM_TOOLS=true` — lets operators expose only what's needed, reduces attack surface
2. **Decomposed MCP servers per concern** (ethereum-wallet-toolkit): separate servers for wallet-gen, keystore, signing, tx — enables least-privilege deployments
3. **Prepare-then-sign workflow** (mcp-ethers-server): never auto-sign; return unsigned tx for user approval before broadcast
4. **Read-only mode without keys** (bnbchain-mcp, universal-crypto-mcp): all balance/query tools work without `PRIVATE_KEY` — good DX default

### x402 Integration Pattern for `@agenti/mcp`
The MCPay / FlowMCP / Coinbase reference implementations converge on this pattern:

```
Agent calls MCP tool
  → MCP server hits HTTP resource
    → 402 response with payment requirements
      → x402 payment signed using wallet
        → Request retried with X-PAYMENT header
          → Resource returns data
            → Result returned to agent
```

**Key implementation detail (FlowMCP):** Inject payment as `_meta["x402/payment"]` in JSON-RPC request body — allows any MCP-compliant tool to carry payment data without changing the tool signature itself.

**Recommended libs:**
- `@x402/axios` — Coinbase's official axios wrapper (handles 402 negotiation)
- `@modelcontextprotocol/sdk` — MCP SDK for server/client construction

### Networks to Support at Launch
Based on what the ecosystem clusters around:
- **Base** — dominant x402 network; nearly every payment example uses it
- **Ethereum mainnet** — required for general EVM coverage
- **Solana** — separate key type (`SOLANA_PRIVATE_KEY`, base58) but high demand
- **Arbitrum, Polygon** — secondary EVM; add via feature flags

### Capability Gaps (Opportunities for `@agenti/mcp`)
The existing landscape is missing:
1. **Unified EVM + Solana + x402 in a single well-tested TypeScript package** — universal-crypto-mcp attempts this but is sprawling (380+ tools)
2. **Agent-to-agent payment delegation** — MetaMask Delegation Toolkit could enable this but isn't production yet
3. **On-ramp tools** — very few MCP servers expose fiat → crypto on-ramp flows
4. **Gasless meta-transactions** — only universal-crypto-mcp mentions `x402_gasless_send`; ERC-2771/ERC-4337 patterns not widely implemented in MCP layer yet
5. **Spending limits / allowance enforcement** — no MCP server implements agent-level spend caps at the protocol layer

### Repos to Clone for Reference (All Open Source, Compatible Licenses)
```bash
# Core reference implementations
git clone https://github.com/nirholas/universal-crypto-mcp.git   # Apache-2.0
git clone https://github.com/nirholas/bnbchain-mcp.git           # Apache-2.0
git clone https://github.com/sendaifun/solana-mcp.git            # Apache-2.0
git clone https://github.com/strangelove-ventures/web3-mcp.git   # Apache-2.0
git clone https://github.com/microchipgnu/MCPay.git              # Apache-2.0

# x402-specific patterns
git clone https://github.com/MetaMask/mcp-x402.git              # MIT
git clone https://github.com/FlowMCP/x402-mcp-middleware.git    # MIT
git clone https://github.com/coinbase/x402.git                   # Apache-2.0 (includes MCP example)

# EVM wallet patterns
git clone https://github.com/dcSpark/mcp-cryptowallet-evm.git   # MIT
git clone https://github.com/crazyrabbitLTC/mcp-ethers-server.git # MIT
git clone https://github.com/AbdelStark/bitcoin-mcp.git          # MIT

# DO NOT clone (GPL-3.0 — copyleft incompatible with agenti's license):
# armorwallet/armor-crypto-mcp
```

---

*Research conducted 2026-04-17. Star counts are point-in-time snapshots. All repos verified public and accessible.*

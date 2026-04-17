# Wallet Toolkits & On-Ramps: Research Findings

**Date:** 2026-04-17  
**Status:** complete

---

## Part 1: Nirholas Toolkit Repos

### `nirholas/ethereum-wallet-toolkit`

- **URL:** https://github.com/nirholas/ethereum-wallet-toolkit
- **License:** MIT
- **Primary language:** Python (43.5%), HTML (49%), TypeScript (3.9%)
- **Stars:** 19 | **Forks:** 4

**Key observation:** Primarily a Python toolkit exposed via MCP servers — not a native TypeScript npm package.

**Modules / MCP servers:**
- `ethereum-wallet-mcp/` — wallet generation
- `keystore-mcp-server/` — Web3 Secret Storage V3 keystore (.json) import/export
- `signing-mcp-server/` — EIP-712 typed data signing
- `transaction-mcp-server/` — transaction construction & signing
- `validation-mcp-server/` — address/input validation

**Python internals (reference patterns):**
- `wallet.py` — BIP-39 mnemonic + BIP-44 HD derivation
- `keystore.py` — V3 keystore encrypt/decrypt
- `sign.py` — EIP-712 signing
- `transaction.py` — legacy + EIP-1559 tx building
- `vanity.py` — vanity address generation

**HD/mnemonic support:** Yes (Python). BIP-39 + BIP-44 explicitly implemented.  
**Hardware wallet:** Not documented.

**Agenti use:** MCP server architecture informs `@agenti/mcp`. Port keystore V3 pattern to TypeScript for `@agenti/core`. No direct npm install possible — requires rewrite.

```bash
git clone https://github.com/nirholas/ethereum-wallet-toolkit.git
```

**Attribution:**
```
# Wallet generation patterns adapted from nirholas/ethereum-wallet-toolkit (MIT)
```

---

### `nirholas/solana-wallet-toolkit`

- **URL:** https://github.com/nirholas/solana-wallet-toolkit
- **License:** MIT
- **Primary language:** Rust + TypeScript

**Description:** "Secure, auditable toolkit for Solana wallet generation and vanity addresses — using only official Solana Labs libraries."

**TypeScript exports:**
- `VanityGenerator` class:
  - `new VanityGenerator(config)` — configurable prefix/suffix/threads
  - Progress callback: `(attempts: number, rate: number) => void`
  - Result: `{ publicKey, secretKey }` in Solana CLI JSON format (64-byte array)

**HD/mnemonic support:** No — focused on vanity generation only, not BIP-44. Keypairs are raw 64-byte Solana format.  
**Dependencies:** `@solana/web3.js`

**Agenti use:** `VanityGenerator` could be wrapped in `@agenti/core` for agent wallet branding. Does NOT cover HD derivation — agenti needs `@scure/bip39` + `ed25519-hd-key` for that.

```bash
git clone https://github.com/nirholas/solana-wallet-toolkit.git
```

**Attribution:**
```
# Solana vanity address generation adapted from nirholas/solana-wallet-toolkit (MIT)
```

---

### `nirholas/bnb-chain-toolkit`

- **URL:** https://github.com/nirholas/bnb-chain-toolkit
- **License:** MIT
- **Primary language:** TypeScript (70.3%), Solidity (10.5%)
- **Package manager:** Bun

**Description:** "AI assistants with superpowers on the blockchain" — 78 AI agents, 6 MCP servers, 1,100+ tools.

**Wallet features (from `wallets/ethereum-wallet-toolkit/` subdirectory — TypeScript):**
- HD wallet generation (BIP-39/BIP-44)
- Vanity address generation
- Message signing (EIP-191, EIP-712)
- Transaction signing (legacy + EIP-1559)
- Keystore V3 import/export
- BSC-compatible

**MCP servers included:**
- `bnbchain-mcp`, `binance-mcp`, `universal-crypto-mcp`
- Market data (CoinGecko, DeFiLlama)
- ERC-8004 agent discovery standard

**Agenti use:** Most architecturally aligned of the three. The `wallets/ethereum-wallet-toolkit/` directory has TypeScript HD wallet code to inform `@agenti/core`. ERC-8004 agent discovery pattern worth tracking for future agent-to-agent payment discovery.

```bash
git clone https://github.com/nirholas/bnb-chain-toolkit.git
```

**Attribution:**
```
# HD wallet and MCP server patterns adapted from nirholas/bnb-chain-toolkit (MIT)
```

---

## Part 2: GitHub Search Results

### Multi-chain wallet generation

**`iamnotstatic/multichain-crypto-wallet`** ← primary reference
- **URL:** https://github.com/iamnotstatic/multichain-crypto-wallet
- **npm:** `multichain-crypto-wallet`
- **License:** MIT
- **Chains:** Ethereum, Bitcoin, Solana, Tron, Waves, BSC, Polygon, Avalanche

**Exported functions:**
```ts
generateMnemonic()                                          // BIP-39 12-word phrase
createWallet({ mnemonic, derivationPath, network })         // BIP-44 HD derivation
generateWalletFromMnemonic({ mnemonic, derivationPath, network })
getAddressFromPrivateKey({ privateKey, network })
getBalance({ address, network, rpcUrl })
transfer({ privateKey, recipientAddress, amount, network, rpcUrl })
getTransaction({ hash, network, rpcUrl })
getTokenInfo({ contractAddress, network, rpcUrl })
smartContractCall({ contractAddress, method, methodType, params, network, rpcUrl })
getEncryptedJsonFromPrivateKey({ privateKey, password })    // keystore V3
getWalletFromEncryptedJson({ json, password })
```

**Agenti use:** Use as API design reference for `@agenti/core` HD wallet functions. Model public API signatures on this but write from scratch to avoid bundling ethers.js (agenti uses viem).

---

**`open-wallet-standard/core`**
- **URL:** https://github.com/open-wallet-standard/core
- Policy-gated signing engine — pre-signing policy gates before key decryption
- Relevant for future `@agenti/sdk` spending limits / guardrails feature

---

### Fiat On-Ramp SDKs

#### Coinbase OnchainKit + Onramp Demo
- **URL:** https://github.com/coinbase/onchainkit | https://github.com/coinbase/onramp-demo-application
- **npm:** `@coinbase/onchainkit`
- **License:** MIT

**Session token pattern (from demo app):**
```ts
// Backend: POST /api/session → one-time Coinbase onramp token (10 req/min)
// Backend: POST /api/fund/session → Fund Card token (20 req/min)
```

**Agenti use:** Wrap session token generation in `@agenti/sdk` as:
```ts
generateCoinbaseOnrampUrl({ walletAddress, asset, network })
```
Agents call this to produce a hosted onramp link users can click to fund agent wallets.

---

#### Coinbase CDP SDK
- **URL:** https://github.com/coinbase/cdp-sdk
- **npm:** `@coinbase/cdp-sdk` (v1.45.0, actively maintained)
- **License:** MIT

**Key functions:**
```ts
cdp.evm.createAccount()      // managed EVM account (keys held by Coinbase)
cdp.solana.createAccount()   // managed Solana account
generateJwt({ apiKeyId, apiKeySecret })
getAuthHeaders(...)
```

**Note:** Keys are custodied by Coinbase — not self-sovereign. Add as **optional** custodial backend in `@agenti/sdk`, not the default. Appropriate for enterprise/regulated contexts.

```bash
npm install @coinbase/cdp-sdk
```

---

#### Changelly Fiat API SDK ← recommended on-ramp adapter
- **URL:** https://github.com/changelly/fiat-api-sdk-node
- **npm:** `@changelly/fiat-api-sdk-node`
- **License:** MIT

**Key functions:**
```ts
getProviderList()
getCurrencyList()
getCountryAvailabilityList()
getOffers({ from, to, amount, country })              // quotes from multiple providers
createOrder({ providerId, from, to, amount, walletAddress })
validateWalletAddress({ currency, address })
buildSignature(...) / validateOrderCallbackSignature(...)  // webhook verification
```

**Agenti use:** `getOffers()` + `createOrder()` are the core integration points. Wrap as `@agenti/sdk` tools so agents can query on-ramp rates and initiate top-ups autonomously.

---

#### MoonPay
- **npm:** `@moonpay/login-sdk`
- Primarily widget-based; less suited for autonomous agent flows. Best as fallback option.

#### Transak
- **npm:** `@transak/ui-js-sdk`
- Widget-based, requires UI context. Useful if agenti adds a web dashboard for wallet funding. Not suitable for purely autonomous agent flows.

---

### USDC / ERC-20 Balance Fetching with viem

**Primary approach: viem native multicall**
```ts
const results = await client.multicall({
  contracts: [
    { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [agentAddress] },
    { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'decimals' },
  ]
})
```

No additional library needed — viem's native multicall is the right foundation.

**`joshstevens19/ethereum-erc20-token-balances-multicall`**
- **URL:** https://github.com/joshstevens19/ethereum-erc20-token-balances-multicall
- **npm:** `ethereum-erc20-token-balances-multicall`
- **License:** MIT
- Uses ethers.js (not viem-native), but `getBalancesForEthereumAddress()` and `getBalancesForEthereumAddresses()` are good API design references for batch balance querying.

**Recommendation for `@agenti/core`:** Write a thin `getTokenBalances(address, tokens[])` helper wrapping viem's multicall with token metadata caching. No external library needed.

---

## Part 3: Summary Table

| Repo | URL | License | Package | Action |
|---|---|---|---|---|
| nirholas/ethereum-wallet-toolkit | https://github.com/nirholas/ethereum-wallet-toolkit | MIT | None (Python) | Clone, port keystore pattern to TS |
| nirholas/solana-wallet-toolkit | https://github.com/nirholas/solana-wallet-toolkit | MIT | None | Clone, wrap `VanityGenerator` |
| nirholas/bnb-chain-toolkit | https://github.com/nirholas/bnb-chain-toolkit | MIT | None (bun monorepo) | Clone, extract `wallets/` module |
| iamnotstatic/multichain-crypto-wallet | https://github.com/iamnotstatic/multichain-crypto-wallet | MIT | `multichain-crypto-wallet` | API design reference only |
| coinbase/cdp-sdk | https://github.com/coinbase/cdp-sdk | MIT | `@coinbase/cdp-sdk` | Optional custodial backend in `@agenti/sdk` |
| coinbase/onramp-demo-application | https://github.com/coinbase/onramp-demo-application | MIT | `@coinbase/onchainkit` | Port session token pattern to `@agenti/sdk` |
| changelly/fiat-api-sdk-node | https://github.com/changelly/fiat-api-sdk-node | MIT | `@changelly/fiat-api-sdk-node` | Wrap `getOffers()`+`createOrder()` in `@agenti/sdk` |
| wevm/viem | https://github.com/wevm/viem | MIT | `viem` | Use native multicall in `@agenti/core` |

---

## Recommendation: Should agenti add mnemonic/HD wallet support to `@agenti/core`?

**Yes — this is a hard requirement, not optional.**

**Reasoning:**

1. **Autonomous agents need deterministic, reproducible wallets.** An agent that restarts must recover its wallet from a seed. Without BIP-39/BIP-44 there is no recovery path — each restart generates a new wallet and loses all funds.

2. **The nirholas toolkits confirm the pattern but can't be imported directly.** `ethereum-wallet-toolkit` is Python-first; `bnb-chain-toolkit` has the right TypeScript code but is bundled in a large monorepo with no standalone npm package.

3. **`multichain-crypto-wallet` is the strongest external reference** for API design — its `generateMnemonic()` / `createWallet()` / `generateWalletFromMnemonic()` function signatures map directly onto what `@agenti/core` needs.

**Recommended implementation for `@agenti/core`:**

```ts
// Dependencies (all MIT, audited Noble cryptography)
// @scure/bip39       — mnemonic generation/validation
// @scure/bip32       — BIP-44 EVM key derivation (m/44'/60'/0'/0/${index})
// ed25519-hd-key     — BIP-44 Solana key derivation (m/44'/501'/${index}'/0')
// @solana/web3.js    — Solana account objects
// @noble/ciphers     — AES-256-GCM for encrypted mnemonic storage

// Public API to export:
generateMnemonic(): string
createWallet(mnemonic: string, chain: 'evm' | 'solana', index?: number): Wallet
recoverWallet(mnemonic: string, chain: 'evm' | 'solana', index?: number): Wallet
encryptMnemonic(mnemonic: string, password: string): string   // AES-256-GCM
decryptMnemonic(ciphertext: string, password: string): string
```

**Hardware wallet support:** Defer to a later milestone. No reference repo had it working cleanly in a TypeScript-native stack.

**Write from scratch** (don't wrap `multichain-crypto-wallet`) to:
- Avoid bundling ethers.js alongside viem
- Keep full control over derivation path configuration
- Fit agenti's TypeScript monorepo structure
- Maintain clear MIT attribution with no transitive license ambiguity

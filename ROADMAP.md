# Agenti Roadmap

A comprehensive roadmap of all blockchain, DeFi, and Web3 capabilities.

**Legend:** &check; Implemented &middot; &bull; In Progress &middot; &cir; Planned

---

## Core Blockchain Operations

### Network & Chain

| Feature | Status |
|---------|--------|
| Get chain ID, block number, gas price | &check; |
| Get network status/health | &check; |
| Switch networks/chains | &check; |
| Get supported networks list | &check; |
| Get RPC endpoints | &check; |
| Estimate block time | &check; |
| Get chain metadata (name, symbol, explorers) | &check; |
| Get finality status | &check; |
| Get mempool/pending transactions | &check; |
| Get network peers/nodes | &check; |
| Get gas oracle | &check; |

### Blocks

| Feature | Status |
|---------|--------|
| Get block by number/hash | &check; |
| Get latest block | &check; |
| Get block transactions | &check; |
| Get block receipts | &check; |
| Get uncle blocks | &check; |
| Subscribe to new blocks | &cir; |
| Get block rewards | &check; |
| Get block gas used/limit | &check; |
| Get block range | &check; |
| Get blocks by miner | &check; |

### Transactions

| Feature | Status |
|---------|--------|
| Send transaction | &check; |
| Get transaction by hash | &check; |
| Get transaction receipt | &check; |
| Get transaction status | &check; |
| Estimate gas | &check; |
| Speed up transaction (replace with higher gas) | &check; |
| Cancel transaction | &check; |
| Decode transaction input | &check; |
| Simulate transaction | &check; |
| Get transaction trace | &cir; |
| Get internal transactions | &cir; |
| Batch transactions | &check; |
| Get pending transactions | &check; |
| Get transaction history by address | &check; |

### Accounts & Wallets

| Feature | Status |
|---------|--------|
| Get balance (native/token) | &check; |
| Get nonce | &check; |
| Get transaction count | &check; |
| Create wallet | &check; |
| Import wallet (private key/mnemonic) | &check; |
| Export private key | &cir; |
| Sign message | &check; |
| Verify signature | &check; |
| Get address from private key | &check; |
| Generate mnemonic | &check; |
| Derive addresses (HD wallet) | &check; |
| Multi-sig wallet operations | &cir; |
| Revoke approvals | &check; |
| Account abstraction (ERC-4337) | &cir; |
| Get wallet portfolio | &check; |
| Get token approvals | &check; |

---

## Token Operations

### Native Tokens

| Feature | Status |
|---------|--------|
| Get native balance | &check; |
| Transfer native tokens | &check; |
| Wrap/unwrap native tokens (WETH, WBNB) | &check; |

### ERC-20 (Fungible Tokens)

| Feature | Status |
|---------|--------|
| Get token info (name, symbol, decimals, total supply) | &check; |
| Get token balance | &check; |
| Transfer tokens | &check; |
| Approve spending | &check; |
| Get allowance | &check; |
| Transfer from (delegated) | &check; |
| Burn tokens | &check; |
| Mint tokens | &check; |
| Get token holders | &check; |
| Get token transfers | &check; |
| Permit (gasless approvals - EIP-2612) | &check; |
| Batch transfers | &check; |
| Token snapshots | &cir; |
| Check/revoke token approval | &check; |

### ERC-721 (NFTs)

| Feature | Status |
|---------|--------|
| Get NFT metadata | &check; |
| Get NFT owner | &check; |
| Transfer NFT | &check; |
| Approve NFT | &check; |
| Set approval for all | &check; |
| Get NFTs by owner | &check; |
| Get NFT collection info | &check; |
| Mint NFT | &cir; |
| Burn NFT | &cir; |
| Get NFT traits/attributes | &check; |
| Batch transfer NFTs | &check; |
| Fetch NFT metadata from URI | &check; |

### ERC-1155 (Multi-Token)

| Feature | Status |
|---------|--------|
| Get token balance (fungible + NFT) | &check; |
| Safe transfer | &check; |
| Get URI | &check; |
| Batch transfers | &cir; |
| Batch balance queries | &cir; |

### Future Token Standards

| Standard | Status |
|----------|--------|
| ERC-777 (advanced fungible) | &cir; |
| ERC-3525 (semi-fungible) | &cir; |
| ERC-4626 (tokenized vaults) | &cir; |
| ERC-6551 (token-bound accounts) | &cir; |
| ERC-404 (hybrid tokens) | &cir; |
| Soulbound tokens (SBTs) | &cir; |

---

## DeFi

### DEX / Swaps

| Feature | Status |
|---------|--------|
| Get quote/price | &check; |
| Swap exact tokens for tokens | &check; |
| Swap tokens for exact tokens | &check; |
| Multi-hop swaps | &check; |
| Cross-DEX aggregation | &check; |
| Get slippage estimate | &check; |
| Get price impact | &check; |
| Split route swaps | &cir; |
| Limit orders | &cir; |
| TWAP orders | &cir; |
| Stop-loss orders | &cir; |

### DEX Analytics

| Feature | Status |
|---------|--------|
| Get trending/new/top pools | &check; |
| Get pool OHLCV data | &check; |
| Get pool trades | &check; |
| Get token pools | &check; |
| Search pools cross-chain | &check; |
| Get token price by contract | &check; |
| Multi-token price lookup | &check; |

### Liquidity Provision

| Feature | Status |
|---------|--------|
| Add/remove liquidity | &check; |
| Get LP token balance | &check; |
| Get pool reserves | &check; |
| Calculate arbitrage opportunities | &check; |
| Concentrated liquidity (Uniswap V3) | &cir; |
| Get impermanent loss estimate | &cir; |
| Collect fees | &cir; |

### Lending & Borrowing

| Feature | Status |
|---------|--------|
| Supply/deposit assets | &check; |
| Withdraw assets | &check; |
| Get supply/borrow APY | &check; |
| Get health factor | &check; |
| Get liquidation threshold | &check; |
| Flash loans | &check; |
| Borrow/repay assets | &check; |
| Get liquidatable positions | &check; |

### Staking

| Feature | Status |
|---------|--------|
| Stake/unstake native tokens | &check; |
| Claim rewards | &check; |
| Get staking APY | &check; |
| Liquid staking (stETH, rETH) | &check; |
| LP staking/farming | &check; |
| Get pending rewards | &check; |
| Restaking (EigenLayer) | &cir; |

### Derivatives (Planned)

| Feature | Status |
|---------|--------|
| Perpetual futures (open/close/margin) | &cir; |
| Options trading | &cir; |
| Synthetic assets | &cir; |

---

## Cross-Chain & Bridges

| Feature | Status |
|---------|--------|
| Bridge tokens cross-chain | &check; |
| Get bridge quote/fees/status | &check; |
| Get supported chains/tokens | &check; |
| Get estimated time | &check; |
| Cross-chain messaging (LayerZero, Axelar, Wormhole) | &cir; |
| Atomic swaps | &cir; |
| CCIP (Chainlink) | &cir; |

---

## Security & Analysis

### Contract Analysis

| Feature | Status |
|---------|--------|
| Verify contract source | &check; |
| Get contract ABI | &check; |
| Check if proxy / get implementation | &check; |
| Detect honeypots | &check; |
| Check for rug pull risks | &check; |
| GoPlus token/rug pull security | &check; |
| Detect malicious functions | &check; |

### Token Security

| Feature | Status |
|---------|--------|
| Check token safety | &check; |
| Get holder distribution | &check; |
| Check mintable/pausable/hidden fees | &check; |
| Check liquidity locked | &check; |
| Check ownership renounced | &check; |
| GoPlus NFT/approval security | &check; |

### Wallet Security

| Feature | Status |
|---------|--------|
| Get/revoke approval list | &check; |
| Check for drainers | &check; |
| Simulate transaction safety | &check; |
| GoPlus address/dApp/signature security | &check; |

---

## Governance

| Feature | Status |
|---------|--------|
| Create/vote/delegate proposals | &check; |
| Get voting power/proposal state | &check; |
| Queue/execute/cancel proposals | &check; |
| Token locking (veTokens) | &cir; |
| Snapshot off-chain voting | &cir; |

---

## Price & Market Data

| Feature | Status |
|---------|--------|
| Current/historical prices | &check; |
| OHLCV data | &check; |
| DEX/oracle price feeds (Chainlink, Pyth) | &check; |
| TWAP price | &check; |
| Market cap, volume, trending | &check; |
| TVL, protocol metrics | &check; |
| Yield farming APYs | &check; |
| DeFi fees, revenue, liquidation data | &check; |
| Stablecoin/bridge volume data | &check; |

---

## Identity & Domains

| Feature | Status |
|---------|--------|
| ENS: register, resolve, transfer, renew | &check; |
| ENS: set records, subdomains | &check; |
| Unstoppable Domains, Space ID, Bonfida | &cir; |
| DIDs & Verifiable Credentials | &cir; |

---

## Smart Contracts

| Feature | Status |
|---------|--------|
| Read: view/pure calls, storage, multicall | &check; |
| Write: transactions, encode/decode, batch | &check; |
| Deploy: standard, CREATE2, proxy, verify | &check; |

---

## MEV & Advanced

| Feature | Status |
|---------|--------|
| Flashbots: private tx, bundles, protection | &check; |
| Account Abstraction (ERC-4337) | &cir; |
| Intents & Solvers | &cir; |

---

## News & Social

| Feature | Status |
|---------|--------|
| Crypto news (search, categories) | &check; |
| Social sentiment & influencer rankings | &check; |
| Trending topics, Galaxy Score, AltRank | &check; |
| Fear & Greed Index | &check; |

---

## Institutional & Compliance (Planned)

| Feature | Status |
|---------|--------|
| KYC/AML wallet screening | &cir; |
| Transaction monitoring | &cir; |
| Tax/P&L reporting | &cir; |
| Multi-sig custody | &cir; |

---

## NFT Marketplace & Metaverse (Planned)

| Feature | Status |
|---------|--------|
| List/buy/auction NFTs | &cir; |
| NFT finance (loans, fractionalization, renting) | &cir; |
| Deploy NFT collections | &cir; |
| Virtual land operations | &cir; |

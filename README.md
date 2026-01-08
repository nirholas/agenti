# Universal Crypto MCP

A Universal Model Context Protocol server for all EVM-compatible networks.

Enable AI agents to interact with any EVM blockchain through natural language.

## Supported Networks

- BNB Smart Chain (BSC)
- opBNB
- Arbitrum One
- Ethereum
- Polygon
- Base
- Optimism
- + All testnets

## Features

- 🔄 **Swap/DEX** - Token swaps via 1inch, 0x, ParaSwap
- 🌉 **Bridge** - Cross-chain transfers via LayerZero, Stargate, Wormhole
- ⛽ **Gas** - Gas prices across chains, EIP-1559 suggestions
- 📦 **Multicall** - Batch read/write operations
- 📊 **Events/Logs** - Query historical events, decode logs
- 🔒 **Security** - Rug pull detection, honeypot check, holder analysis, contract permissions
- 💰 **Staking** - Liquid staking (Lido), LP farming
- ✍️ **Signatures** - Sign messages, verify signatures, EIP-712
- 🏦 **Lending** - Aave/Compound positions, borrow rates
- 📈 **Price Feeds** - Historical prices, TWAP, oracle aggregation
- 📁 **Portfolio** - Track holdings across chains
- 🏛️ **Governance** - Snapshot votes, on-chain proposals
- 🚀 **Deployment** - Deploy contracts, CREATE2, upgradeable proxies, verification
- 🛡️ **MEV Protection** - Flashbots Protect, private transactions, bundle simulation
- 🆔 **ENS/Domains** - Register, transfer, renew, set records, subdomains

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

### Cursor

Add to your MCP settings:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

### ChatGPT Developer Mode

1. Enable [Developer Mode](https://chatgpt.com/#settings/Connectors/Advanced) in ChatGPT settings
2. Start the HTTP server:
   ```bash
   npx @nirholas/universal-crypto-mcp@latest --http
   ```
3. In ChatGPT Settings → Apps, click **Create app**
4. Enter your server URL: `http://localhost:3001/mcp`
5. Select the app in conversations via **Developer mode** menu

For detailed setup instructions, see [ChatGPT Setup Guide](https://universal-crypto-mcp.vercel.app/mcp-server/chatgpt-setup/).

## Server Modes

| Mode | Command | Use Case |
|------|---------|----------|
| stdio | `npx @nirholas/universal-crypto-mcp` | Claude Desktop, Cursor |
| HTTP | `npx @nirholas/universal-crypto-mcp --http` | ChatGPT Developer Mode |
| SSE | `npx @nirholas/universal-crypto-mcp --sse` | Legacy HTTP clients |

## Local Development

```bash
# Clone
git clone https://github.com/nirholas/universal-crypto-mcp
cd universal-crypto-mcp

# Install
bun install

# Run dev server (stdio - Claude)
bun dev

# Run dev server (HTTP - ChatGPT)
bun dev:http

# Run dev server (SSE - legacy)
bun dev:sse
```

## Documentation

https://universal-crypto-mcp.vercel.app

---

## 🗺️ Roadmap

A comprehensive roadmap of all crypto/blockchain/DeFi/Web3 features to be implemented.

### Legend
- ✅ Implemented
- 🚧 In Progress
- 📋 Planned

---

### 🔗 Core Blockchain Operations

#### Network & Chain
| Feature | Status |
|---------|--------|
| Get chain ID, block number, gas price | ✅ |
| Get network status/health | ✅ |
| Switch networks/chains | ✅ |
| Get supported networks list | ✅ |
| Get RPC endpoints | ✅ |
| Estimate block time | ✅ |
| Get chain metadata (name, symbol, explorers) | ✅ |
| Get finality status | ✅ |
| Get mempool/pending transactions | ✅ |
| Get network peers/nodes | ✅ |
| Get gas oracle | ✅ |

#### Blocks
| Feature | Status |
|---------|--------|
| Get block by number/hash | ✅ |
| Get latest block | ✅ |
| Get block transactions | ✅ |
| Get block receipts | ✅ |
| Get uncle blocks | ✅ |
| Subscribe to new blocks | 📋 |
| Get block rewards | ✅ |
| Get block gas used/limit | ✅ |
| Get block range | ✅ |
| Get blocks by miner | ✅ |

#### Transactions
| Feature | Status |
|---------|--------|
| Send transaction | ✅ |
| Get transaction by hash | ✅ |
| Get transaction receipt | ✅ |
| Get transaction status | ✅ |
| Estimate gas | ✅ |
| Speed up transaction (replace with higher gas) | ✅ |
| Cancel transaction | ✅ |
| Decode transaction input | ✅ |
| Simulate transaction | ✅ |
| Get transaction trace | 📋 |
| Get internal transactions | 📋 |
| Batch transactions | ✅ |
| Get pending transactions | ✅ |
| Get transaction history by address | ✅ |

#### Accounts/Wallets
| Feature | Status |
|---------|--------|
| Get balance (native/token) | ✅ |
| Get nonce | ✅ |
| Get transaction count | ✅ |
| Create wallet | ✅ |
| Import wallet (private key/mnemonic) | ✅ |
| Export private key | 📋 |
| Sign message | ✅ |
| Verify signature | ✅ |
| Get address from private key | ✅ |
| Generate mnemonic | ✅ |
| Derive addresses (HD wallet) | ✅ |
| Multi-sig wallet operations | 📋 |
| Get wallet permissions | 📋 |
| Revoke approvals | ✅ |
| Account abstraction (ERC-4337) | 📋 |
| Social recovery | 📋 |
| Hardware wallet integration | 📋 |
| Get wallet portfolio | ✅ |
| Get token approvals | ✅ |

---

### 💰 Token Operations

#### Native Tokens
| Feature | Status |
|---------|--------|
| Get native balance | ✅ |
| Transfer native tokens | ✅ |
| Wrap/unwrap native tokens (WETH, WBNB) | ✅ |

#### ERC-20 (Fungible Tokens)
| Feature | Status |
|---------|--------|
| Get token info (name, symbol, decimals, total supply) | ✅ |
| Get token balance | ✅ |
| Transfer tokens | ✅ |
| Approve spending | ✅ |
| Get allowance | ✅ |
| Transfer from (delegated) | ✅ |
| Burn tokens | ✅ |
| Mint tokens | ✅ |
| Get token holders | ✅ |
| Get token transfers | ✅ |
| Permit (gasless approvals - EIP-2612) | ✅ |
| Batch transfers | ✅ |
| Token snapshots | 📋 |
| Get token supply info | ✅ |
| Check/revoke token approval | ✅ |

#### ERC-721 (NFTs)
| Feature | Status |
|---------|--------|
| Get NFT metadata | ✅ |
| Get NFT owner | ✅ |
| Transfer NFT | ✅ |
| Approve NFT | ✅ |
| Set approval for all | ✅ |
| Get NFTs by owner | ✅ |
| Get NFT collection info | ✅ |
| Mint NFT | 📋 |
| Burn NFT | 📋 |
| Get NFT transfer history | 📋 |
| Get NFT traits/attributes | ✅ |
| Get NFT rarity | 📋 |
| Verify NFT authenticity | 📋 |
| Batch transfer NFTs | ✅ |
| Check NFT approval | ✅ |
| Revoke NFT approval | ✅ |
| Approve for marketplace | ✅ |
| Fetch NFT metadata from URI | ✅ |

#### ERC-1155 (Multi-Token)
| Feature | Status |
|---------|--------|
| Get token balance (fungible + NFT) | ✅ |
| Batch transfers | 📋 |
| Batch balance queries | 📋 |
| Safe transfer | ✅ |
| Get URI | ✅ |

#### Other Token Standards
| Feature | Status |
|---------|--------|
| ERC-777 (advanced fungible) | 📋 |
| ERC-3525 (semi-fungible) | 📋 |
| ERC-4626 (tokenized vaults) | 📋 |
| ERC-6551 (token-bound accounts) | 📋 |
| ERC-404 (hybrid tokens) | 📋 |
| Soulbound tokens (SBTs) | 📋 |

---

### 🏦 DeFi - Decentralized Exchanges (DEX)

#### Swaps
| Feature | Status |
|---------|--------|
| Get quote/price | ✅ |
| Swap exact tokens for tokens | ✅ |
| Swap tokens for exact tokens | ✅ |
| Multi-hop swaps | ✅ |
| Split route swaps | 📋 |
| Cross-DEX aggregation | ✅ |
| Limit orders | 📋 |
| TWAP orders (time-weighted) | 📋 |
| Stop-loss orders | 📋 |
| Get slippage estimate | ✅ |
| Get price impact | ✅ |
| MEV protection (private transactions) | 📋 |

#### Liquidity Provision
| Feature | Status |
|---------|--------|
| Add liquidity | ✅ |
| Remove liquidity | ✅ |
| Get LP token balance | ✅ |
| Get pool reserves | ✅ |
| Get pool APY/APR | 📋 |
| Get impermanent loss estimate | 📋 |
| Concentrated liquidity (Uniswap V3) | 📋 |
| Set price range | 📋 |
| Collect fees | 📋 |
| Rebalance position | 📋 |
| Add liquidity with native token | ✅ |
| Calculate arbitrage opportunities | ✅ |

#### AMM Types Support
| Feature | Status |
|---------|--------|
| Constant product (x*y=k) | ✅ |
| Stable swap (Curve) | 📋 |
| Concentrated liquidity | 📋 |
| Order book hybrid | 📋 |
| Virtual AMM (perpetuals) | 📋 |

---

### 🏦 DeFi - Lending & Borrowing

#### Lending
| Feature | Status |
|---------|--------|
| Supply/deposit assets | ✅ |
| Withdraw assets | ✅ |
| Get supply APY | ✅ |
| Get supplied balance | ✅ |
| Get utilization rate | 📋 |
| Enable/disable as collateral | 📋 |

#### Borrowing
| Feature | Status |
|---------|--------|
| Borrow assets | ✅ |
| Repay debt | ✅ |
| Get borrow APY | ✅ |
| Get borrowed balance | ✅ |
| Get health factor | ✅ |
| Get liquidation threshold | ✅ |
| Get max borrowable amount | 📋 |
| Flash loans | ✅ |
| Get borrow limit | 📋 |
| Get flash loan info | ✅ |

#### Liquidations
| Feature | Status |
|---------|--------|
| Liquidate unhealthy positions | 📋 |
| Get liquidatable positions | ✅ |
| Get liquidation bonus | 📋 |
| Partial liquidations | 📋 |

#### Isolated Markets
| Feature | Status |
|---------|--------|
| Supply to isolated pool | 📋 |
| Borrow from isolated pool | 📋 |
| Get isolation mode debt ceiling | 📋 |

---

### 🥩 DeFi - Staking

#### Native Staking
| Feature | Status |
|---------|--------|
| Stake native tokens | ✅ |
| Unstake/withdraw | ✅ |
| Claim rewards | ✅ |
| Get staking APY | ✅ |
| Get validator list | 📋 |
| Delegate to validator | 📋 |
| Redelegate | 📋 |
| Get unbonding period | 📋 |

#### Liquid Staking
| Feature | Status |
|---------|--------|
| Stake for liquid staking tokens (stETH, rETH) | ✅ |
| Unwrap liquid staking tokens | ✅ |
| Get exchange rate | ✅ |
| Get staking rewards rate | ✅ |

#### LP Staking/Farming
| Feature | Status |
|---------|--------|
| Stake LP tokens | ✅ |
| Unstake LP tokens | ✅ |
| Claim farming rewards | ✅ |
| Get farming APY | ✅ |
| Compound rewards | 📋 |
| Get pending rewards | ✅ |
| Boost rewards (veTokens) | 📋 |

#### Restaking
| Feature | Status |
|---------|--------|
| Restake assets (EigenLayer) | 📋 |
| Get restaking points | 📋 |
| Choose operators | 📋 |
| Withdraw from restaking | 📋 |

---

### 📊 DeFi - Derivatives

#### Perpetual Futures
| Feature | Status |
|---------|--------|
| Open long/short position | 📋 |
| Close position | 📋 |
| Add/remove margin | 📋 |
| Set leverage | 📋 |
| Get funding rate | 📋 |
| Get open interest | 📋 |
| Get liquidation price | 📋 |
| Set stop-loss/take-profit | 📋 |
| Get PnL | 📋 |
| Partial close | 📋 |

#### Options
| Feature | Status |
|---------|--------|
| Buy call/put options | 📋 |
| Sell/write options | 📋 |
| Exercise options | 📋 |
| Get option greeks | 📋 |
| Get implied volatility | 📋 |
| Get option chain | 📋 |
| Spread strategies | 📋 |

#### Synthetics
| Feature | Status |
|---------|--------|
| Mint synthetic assets | 📋 |
| Burn synthetic assets | 📋 |
| Get collateral ratio | 📋 |
| Get synthetic price feed | 📋 |
| Liquidate synthetic positions | 📋 |

---

### 🌉 Cross-Chain & Bridges

#### Bridging
| Feature | Status |
|---------|--------|
| Bridge tokens cross-chain | ✅ |
| Get bridge quote | ✅ |
| Get bridge status | ✅ |
| Get supported chains | ✅ |
| Get supported tokens | ✅ |
| Claim bridged tokens | 📋 |
| Get bridge fees | ✅ |
| Get estimated time | ✅ |

#### Cross-Chain Messaging
| Feature | Status |
|---------|--------|
| Send cross-chain message | 📋 |
| Receive cross-chain message | 📋 |
| LayerZero operations | 📋 |
| Axelar operations | 📋 |
| Wormhole operations | 📋 |
| CCIP (Chainlink) | 📋 |
| Hyperlane operations | 📋 |

#### Atomic Swaps
| Feature | Status |
|---------|--------|
| Initiate atomic swap | 📋 |
| Complete atomic swap | 📋 |
| Refund atomic swap | 📋 |

---

### 🗳️ Governance

#### Voting
| Feature | Status |
|---------|--------|
| Create proposal | ✅ |
| Vote on proposal | ✅ |
| Delegate votes | ✅ |
| Get voting power | ✅ |
| Get proposal state | ✅ |
| Queue proposal | ✅ |
| Execute proposal | ✅ |
| Cancel proposal | ✅ |
| Get vote receipt | ✅ |

#### Token Locking
| Feature | Status |
|---------|--------|
| Lock tokens for voting (veTokens) | 📋 |
| Extend lock period | 📋 |
| Increase locked amount | 📋 |
| Withdraw unlocked tokens | 📋 |
| Get lock info | 📋 |

#### Snapshot (Off-chain)
| Feature | Status |
|---------|--------|
| Create space | 📋 |
| Create off-chain proposal | 📋 |
| Vote off-chain | 📋 |
| Get snapshot results | 📋 |

---

### 🔐 Security & Analysis

#### Contract Analysis
| Feature | Status |
|---------|--------|
| Verify contract source | ✅ |
| Get contract ABI | ✅ |
| Check if contract is proxy | ✅ |
| Get implementation address | ✅ |
| Detect honeypots | ✅ |
| Check for rug pull risks | ✅ |
| Audit score | 📋 |
| Get contract creator | ✅ |
| Get contract age | ✅ |
| Detect malicious functions | ✅ |

#### Token Security
| Feature | Status |
|---------|--------|
| Check token safety | ✅ |
| Get holder distribution | ✅ |
| Check if mintable | ✅ |
| Check if pausable | ✅ |
| Check for hidden fees | ✅ |
| Check liquidity locked | ✅ |
| Get top holders | ✅ |
| Check ownership renounced | ✅ |

#### Wallet Security
| Feature | Status |
|---------|--------|
| Get approval list | ✅ |
| Revoke approvals | ✅ |
| Check for drainers | ✅ |
| Simulate transaction safety | ✅ |
| Get wallet risk score | 📋 |

---

### 📈 Price & Market Data

#### Price Feeds
| Feature | Status |
|---------|--------|
| Get current price | ✅ |
| Get historical prices | ✅ |
| Get OHLCV data | 📋 |
| Get price from DEX | ✅ |
| Get price from oracle (Chainlink, Pyth) | ✅ |
| Get TWAP price | ✅ |
| Get price across exchanges | 📋 |
| Get volume | 📋 |
| Get market cap | 📋 |

#### Analytics
| Feature | Status |
|---------|--------|
| Get TVL (Total Value Locked) | 📋 |
| Get protocol metrics | 📋 |
| Get yield farming APYs | 📋 |
| Get gas tracker | ✅ |
| Get whale transactions | 📋 |
| Get token flow analysis | 📋 |
| Get DEX volume | 📋 |
| Get lending metrics | 📋 |

---

### 🆔 Identity & Domains

#### ENS (Ethereum Name Service)
| Feature | Status |
|---------|--------|
| Register domain | ✅ |
| Resolve name to address | ✅ |
| Reverse resolve address to name | ✅ |
| Set primary name | 📋 |
| Set records (text, address, content hash) | ✅ |
| Transfer domain | ✅ |
| Renew domain | ✅ |
| Get expiry date | 📋 |
| Set subdomains | ✅ |

#### Other Name Services
| Feature | Status |
|---------|--------|
| Unstoppable Domains | 📋 |
| Space ID (.bnb) | 📋 |
| Bonfida (.sol) | 📋 |
| ANS (.avax) | 📋 |

#### DIDs & Verifiable Credentials
| Feature | Status |
|---------|--------|
| Create DID | 📋 |
| Resolve DID | 📋 |
| Issue verifiable credential | 📋 |
| Verify credential | 📋 |
| Revoke credential | 📋 |

---

### 🖼️ NFT & Metaverse

#### NFT Marketplace
| Feature | Status |
|---------|--------|
| List NFT for sale | 📋 |
| Buy NFT | 📋 |
| Make offer | 📋 |
| Accept offer | 📋 |
| Cancel listing | 📋 |
| Auction NFT | 📋 |
| Bid on auction | 📋 |
| Get floor price | 📋 |
| Get collection stats | 📋 |

#### NFT Creation
| Feature | Status |
|---------|--------|
| Deploy NFT collection | 📋 |
| Mint NFTs | 📋 |
| Set royalties | 📋 |
| Set metadata | 📋 |
| Reveal NFTs | 📋 |
| Whitelist management | 📋 |
| Airdrop NFTs | 📋 |

#### NFT Finance
| Feature | Status |
|---------|--------|
| NFT collateralized loans | 📋 |
| NFT fractionalization | 📋 |
| NFT renting | 📋 |
| NFT staking | 📋 |

#### Metaverse
| Feature | Status |
|---------|--------|
| Buy virtual land | 📋 |
| Sell virtual land | 📋 |
| Build on land | 📋 |
| Transfer assets between metaverses | 📋 |

---

### 🔔 Events & Subscriptions

#### Event Listening
| Feature | Status |
|---------|--------|
| Subscribe to contract events | 📋 |
| Subscribe to pending transactions | 📋 |
| Subscribe to new blocks | 📋 |
| Subscribe to logs | 📋 |
| Filter events by topic | ✅ |
| Get historical events | ✅ |
| Decode event logs | ✅ |

#### Webhooks & Notifications
| Feature | Status |
|---------|--------|
| Set up webhook for events | 📋 |
| Get transaction notifications | 📋 |
| Get price alerts | 📋 |
| Get whale alerts | 📋 |
| Get governance notifications | 📋 |

---

### 📜 Smart Contract Interaction

#### Read Operations
| Feature | Status |
|---------|--------|
| Call view/pure functions | ✅ |
| Get storage at slot | ✅ |
| Get contract bytecode | ✅ |
| Multicall (batch reads) | ✅ |
| Static call simulation | ✅ |

#### Write Operations
| Feature | Status |
|---------|--------|
| Send transaction to contract | ✅ |
| Encode function call | ✅ |
| Decode function result | ✅ |
| Estimate gas for call | ✅ |
| Batch transactions | ✅ |

#### Contract Deployment
| Feature | Status |
|---------|--------|
| Deploy contract | ✅ |
| Deploy with CREATE2 | ✅ |
| Deploy proxy contract | ✅ |
| Upgrade proxy | ✅ |
| Verify on explorer | ✅ |

---

### 🤖 Advanced Features

#### MEV & Flashbots
| Feature | Status |
|---------|--------|
| Submit private transaction | ✅ |
| Submit bundle | ✅ |
| Get MEV opportunities | ✅ |
| Backrun protection | ✅ |
| Frontrun protection | ✅ |
| Sandwich protection | ✅ |

#### Account Abstraction (ERC-4337)
| Feature | Status |
|---------|--------|
| Create smart account | 📋 |
| Execute user operation | 📋 |
| Batch operations | 📋 |
| Sponsor gas (Paymaster) | 📋 |
| Session keys | 📋 |
| Social recovery | 📋 |

#### Intents & Solvers
| Feature | Status |
|---------|--------|
| Submit intent | 📋 |
| Get solver quotes | 📋 |
| Execute via solver | 📋 |

#### Oracles
| Feature | Status |
|---------|--------|
| Get Chainlink price | ✅ |
| Get Pyth price | 📋 |
| Get Band Protocol price | 📋 |
| Get API3 price | 📋 |
| Request randomness (VRF) | 📋 |
| Request external data | 📋 |

---

### 🛠️ Utility Functions

#### Gas
| Feature | Status |
|---------|--------|
| Get gas price | ✅ |
| Get priority fee | ✅ |
| Get base fee | ✅ |
| Get gas history | ✅ |
| Estimate gas for transaction | ✅ |
| Get EIP-1559 fees | ✅ |

#### Encoding/Decoding
| Feature | Status |
|---------|--------|
| ABI encode | ✅ |
| ABI decode | ✅ |
| Keccak256 hash | ✅ |
| Pack/unpack data | ✅ |
| Sign typed data (EIP-712) | ✅ |

#### Address Utils
| Feature | Status |
|---------|--------|
| Validate address | ✅ |
| Checksum address | ✅ |
| Get address from ENS | ✅ |
| Check if contract | ✅ |
| Get contract type | 📋 |

---

### 📰 Data & Information

#### News & Social
| Feature | Status |
|---------|--------|
| Get crypto news | ✅ |
| Search crypto news | ✅ |
| Get DeFi news | ✅ |
| Get Bitcoin news | ✅ |
| Get breaking news | ✅ |
| Get social sentiment | 📋 |
| Get Twitter mentions | 📋 |
| Get Discord activity | 📋 |
| Get GitHub activity | 📋 |

#### On-Chain Data
| Feature | Status |
|---------|--------|
| Get token holders | 📋 |
| Get whale wallets | 📋 |
| Get smart money movements | 📋 |
| Get protocol users | 📋 |
| Get daily active addresses | 📋 |
| Get network hash rate | 📋 |

---

### 🏛️ Institutional & Compliance

#### KYC/AML
| Feature | Status |
|---------|--------|
| Wallet screening | 📋 |
| Transaction monitoring | 📋 |
| Risk scoring | 📋 |
| Sanctions checking | 📋 |

#### Custody
| Feature | Status |
|---------|--------|
| Multi-sig operations | 📋 |
| Cold storage | 📋 |
| Hot wallet management | 📋 |
| Policy enforcement | 📋 |

#### Reporting
| Feature | Status |
|---------|--------|
| Tax reporting | 📋 |
| Portfolio tracking | ✅ |
| P&L reporting | 📋 |
| Transaction history export | 📋 |

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))

## License

MIT

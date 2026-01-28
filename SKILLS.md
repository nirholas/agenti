# 🎯 Agenti Skills Manifest

A comprehensive Model Context Protocol server for blockchain and DeFi operations.

## 📊 Skills Overview

| Category | Tools | Description |
|----------|-------|-------------|
| [Blockchain Core](#blockchain-core) | 50 | Balances, transactions, contracts |
| [DeFi Operations](#defi-operations) | 80 | Swaps, lending, staking |
| [Security Analysis](#security-analysis) | 40 | Honeypot, rug detection, audits |
| [Market Data](#market-data) | 60 | Prices, analytics, sentiment |
| [NFT Operations](#nft-operations) | 14 | Metadata, transfers, marketplace |
| [x402 Payments](#x402-payments) | 14 | Autonomous agent payments |
| [Cross-Chain](#cross-chain) | 8 | Bridges, multi-chain |
| **Total** | **380+** | |

---

## Blockchain Core

### Network Operations
| Skill | Complexity | Description |
|-------|------------|-------------|
| `get_chain_info` | ⭐ | Get chain ID, block number, RPC |
| `get_supported_networks` | ⭐ | List all 20+ supported networks |
| `get_block` | ⭐ | Fetch block by number or hash |
| `get_gas_price` | ⭐ | Current gas prices (EIP-1559) |
| `estimate_gas` | ⭐⭐ | Estimate transaction gas cost |

### Wallet Operations
| Skill | Complexity | Description |
|-------|------------|-------------|
| `get_balance` | ⭐ | Native + token balances |
| `get_wallet_portfolio` | ⭐⭐ | Full portfolio breakdown |
| `get_wallet_history` | ⭐⭐ | Transaction history |
| `sign_message` | ⭐⭐ | Sign arbitrary messages |
| `sign_typed_data` | ⭐⭐⭐ | EIP-712 typed data signing |

### Transaction Operations
| Skill | Complexity | Description |
|-------|------------|-------------|
| `send_transaction` | ⭐⭐⭐ | Send with confirmation |
| `simulate_transaction` | ⭐⭐ | Dry run simulation |
| `get_transaction` | ⭐ | Fetch transaction details |
| `cancel_transaction` | ⭐⭐⭐ | Cancel pending transaction |
| `decode_transaction` | ⭐⭐ | Decode transaction data |

### Contract Operations
| Skill | Complexity | Description |
|-------|------------|-------------|
| `deploy_contract` | ⭐⭐⭐⭐ | Deploy smart contract |
| `call_contract` | ⭐⭐ | Read contract state |
| `write_contract` | ⭐⭐⭐ | Write with signing |
| `get_contract_source` | ⭐⭐ | Fetch verified source |
| `verify_contract` | ⭐⭐⭐ | Submit for verification |

---

## DeFi Operations

### DEX & Swaps
| Skill | Complexity | Description |
|-------|------------|-------------|
| `get_quote` | ⭐⭐ | Aggregated best quote |
| `swap_tokens` | ⭐⭐⭐ | Execute swap (1inch, 0x, ParaSwap) |
| `get_liquidity_pools` | ⭐⭐ | Find LP opportunities |
| `add_liquidity` | ⭐⭐⭐ | Add LP position |
| `remove_liquidity` | ⭐⭐⭐ | Remove LP position |

### Lending & Borrowing
| Skill | Complexity | Description |
|-------|------------|-------------|
| `supply_lending` | ⭐⭐⭐ | Supply to Aave/Compound |
| `borrow_lending` | ⭐⭐⭐⭐ | Borrow with collateral |
| `repay_lending` | ⭐⭐⭐ | Repay loan |
| `get_health_factor` | ⭐⭐ | Check liquidation risk |
| `flash_loan` | ⭐⭐⭐⭐⭐ | Execute flash loan |

### Staking
| Skill | Complexity | Description |
|-------|------------|-------------|
| `stake_eth` | ⭐⭐⭐ | Liquid staking (Lido/Rocket) |
| `unstake_eth` | ⭐⭐⭐ | Unstake ETH |
| `get_staking_apy` | ⭐ | Current staking APY |
| `claim_rewards` | ⭐⭐ | Claim staking rewards |
| `compound_rewards` | ⭐⭐⭐ | Auto-compound |

---

## Security Analysis

### Token Security
| Skill | Complexity | Description |
|-------|------------|-------------|
| `check_token_security` | ⭐⭐ | Full GoPlus security scan |
| `detect_honeypot` | ⭐⭐ | Honeypot simulation |
| `check_rug_pull_risk` | ⭐⭐ | Rug pull indicators |
| `get_holder_distribution` | ⭐⭐ | Whale concentration |
| `detect_wash_trading` | ⭐⭐⭐ | Wash trade detection |

### Contract Security
| Skill | Complexity | Description |
|-------|------------|-------------|
| `check_contract_verified` | ⭐ | Verification status |
| `analyze_contract` | ⭐⭐⭐ | Static analysis |
| `check_ownership` | ⭐⭐ | Owner/admin analysis |
| `get_token_audit` | ⭐⭐ | Audit reports |
| `validate_contract` | ⭐⭐ | Contract validation |

### Approval Management
| Skill | Complexity | Description |
|-------|------------|-------------|
| `check_approvals` | ⭐⭐ | Audit all approvals |
| `revoke_approval` | ⭐⭐ | Revoke permission |
| `simulate_revoke` | ⭐⭐ | Safe revoke simulation |
| `check_allowance` | ⭐ | Check specific allowance |
| `batch_revoke` | ⭐⭐⭐ | Revoke multiple |

---

## Market Data

### Price Data
| Skill | Complexity | Description |
|-------|------------|-------------|
| `get_price` | ⭐ | Real-time price |
| `get_price_history` | ⭐⭐ | OHLCV history |
| `get_market_cap` | ⭐ | Market capitalization |
| `get_volume` | ⭐ | 24h volume |
| `compare_prices` | ⭐⭐ | Cross-exchange prices |

### DeFi Analytics
| Skill | Complexity | Description |
|-------|------------|-------------|
| `get_defi_tvl` | ⭐ | Protocol TVL |
| `get_chain_tvl` | ⭐ | Chain TVL |
| `get_yields` | ⭐⭐ | Yield opportunities |
| `get_protocol_fees` | ⭐⭐ | Fee revenue |
| `compare_protocols` | ⭐⭐ | Protocol comparison |

### Sentiment & Social
| Skill | Complexity | Description |
|-------|------------|-------------|
| `get_fear_greed` | ⭐ | Fear & Greed Index |
| `get_trending` | ⭐ | Trending tokens |
| `get_social_sentiment` | ⭐⭐ | Social analysis |
| `get_gainers_losers` | ⭐ | Top movers |
| `get_market_sentiment` | ⭐⭐ | Overall sentiment |

---

## NFT Operations

| Skill | Complexity | Description |
|-------|------------|-------------|
| `get_nft_metadata` | ⭐ | NFT details |
| `transfer_nft` | ⭐⭐ | Transfer NFT |
| `get_collection_stats` | ⭐⭐ | Floor, volume, holders |
| `list_nft` | ⭐⭐⭐ | List on marketplace |
| `buy_nft` | ⭐⭐⭐ | Purchase NFT |

---

## x402 Payments

AI agents can autonomously pay for services.

| Skill | Complexity | Description |
|-------|------------|-------------|
| `x402_pay_request` | ⭐⭐⭐ | HTTP request + auto-pay |
| `x402_balance` | ⭐ | Check wallet balance |
| `x402_send` | ⭐⭐ | Direct payment |
| `x402_gasless_send` | ⭐⭐⭐ | Gasless via EIP-3009 |
| `x402_yield` | ⭐ | USDs yield info (~5% APY) |

---

## Cross-Chain

| Skill | Complexity | Description |
|-------|------------|-------------|
| `bridge_tokens` | ⭐⭐⭐⭐ | Cross-chain transfer |
| `get_bridge_quote` | ⭐⭐ | Bridge cost/time |
| `get_bridge_status` | ⭐ | Track bridge tx |
| `claim_bridge` | ⭐⭐⭐ | Claim on destination |
| `estimate_bridge_time` | ⭐ | Time estimate |

---

## Supported Networks

### EVM (Full Support)
ethereum, polygon, arbitrum, optimism, base, bsc, avalanche, fantom, gnosis, celo, moonbeam, aurora, metis, linea, scroll, zksync, mantle, blast, mode, sei

### Non-EVM (Adapter)
solana

---

## Complexity Legend

| Level | Description |
|-------|-------------|
| ⭐ | Read-only, no gas |
| ⭐⭐ | Simple queries |
| ⭐⭐⭐ | Write operations |
| ⭐⭐⭐⭐ | Complex transactions |
| ⭐⭐⭐⭐⭐ | Advanced/multi-step |

---

## Quick Start

```bash
npx @nirholas/agenti
```

## Links

- GitHub: https://github.com/nirholas/agenti
- NPM: https://www.npmjs.com/package/@nirholas/agenti
- Docs: https://nirholas.github.io/agenti/

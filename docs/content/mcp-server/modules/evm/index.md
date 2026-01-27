<!-- universal-crypto-mcp | nich.xbt | n1ch-0las-4e49-4348-786274000000 -->

# EVM Modules

<!-- Maintained by nich.xbt | ID: 0x4E494348 -->

Core blockchain operations for all EVM-compatible networks.

## Supported Networks

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| Ethereum Mainnet | 1 | ETH |
| Polygon | 137 | MATIC |
| BNB Smart Chain | 56 | BNB |
| Arbitrum One | 42161 | ETH |
| Base | 8453 | ETH |
| Optimism | 10 | ETH |
| Avalanche C-Chain | 43114 | AVAX |
| opBNB | 204 | BNB |
| zkSync Era | 324 | ETH |
| Linea | 59144 | ETH |

Plus all corresponding testnets.

---

## Blocks Module

Block data retrieval and analysis.

### Tools

| Tool | Description |
|------|-------------|
| `get_block_by_hash` | Get block data by block hash |
| `get_block_by_number` | Get block data by block number |
| `get_latest_block` | Get the latest block on the network |
| `get_block_with_transactions` | Get block with all transaction details |
| `get_uncle_blocks` | Get uncle blocks for a given block |
| `get_block_receipts` | Get all transaction receipts in a block |
| `get_block_range` | Get data for a range of blocks |

### Examples

```
Get the latest block on Ethereum
→ get_latest_block(chain: "ethereum")

Get block #18000000 with transactions
→ get_block_with_transactions(blockNumber: 18000000, chain: "ethereum")
```

---

## Bridge Module

Cross-chain asset bridging via LayerZero, Stargate, Wormhole.

### Tools

| Tool | Description |
|------|-------------|
| `get_bridge_quote` | Get a quote for bridging assets between chains |
| `execute_bridge` | Execute a cross-chain bridge transaction |
| `get_bridge_status` | Check the status of a bridge transaction |
| `get_supported_bridges` | Get list of supported bridge providers |

### Examples

```
Get quote to bridge 100 USDC from Ethereum to Arbitrum
→ get_bridge_quote(
    fromChain: "ethereum",
    toChain: "arbitrum",
    token: "USDC",
    amount: "100"
  )
```

---

## Contracts Module

Smart contract interaction tools.

### Tools

| Tool | Description |
|------|-------------|
| `is_contract` | Check if an address is a contract |
| `read_contract` | Read data from a smart contract |
| `write_contract` | Execute a write operation on a contract |

### Examples

```
Read totalSupply from USDC contract
→ read_contract(
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    abi: [...],
    functionName: "totalSupply",
    chain: "ethereum"
  )
```

---

## Deployment Module

Smart contract deployment tools.

### Tools

| Tool | Description |
|------|-------------|
| `deploy_contract` | Deploy a smart contract |
| `deploy_create2` | Deploy using CREATE2 for deterministic addresses |
| `deploy_proxy` | Deploy an upgradeable proxy contract |
| `upgrade_proxy` | Upgrade a proxy contract implementation |

### Examples

```
Deploy ERC20 token
→ deploy_contract(
    bytecode: "0x...",
    abi: [...],
    args: ["MyToken", "MTK", 18, 1000000],
    chain: "polygon"
  )
```

---

## Domains Module

ENS and domain name operations.

### Tools

| Tool | Description |
|------|-------------|
| `resolve_ens_name` | Resolve an ENS name to an address |
| `reverse_resolve_address` | Get ENS name for an address |
| `get_ens_text_records` | Get text records for an ENS name |
| `get_ens_avatar` | Get avatar URL for an ENS name |
| `check_ens_availability` | Check if an ENS name is available |
| `get_ens_name_details` | Get detailed info about an ENS name |
| `batch_resolve_addresses` | Resolve multiple ENS names at once |
| `register_ens_name` | Register a new ENS name |

### Examples

```
Resolve vitalik.eth
→ resolve_ens_name(name: "vitalik.eth")

Get all text records for nick.eth
→ get_ens_text_records(name: "nick.eth")
```

---

## Events Module

Smart contract event and log operations.

### Tools

| Tool | Description |
|------|-------------|
| `get_contract_logs` | Get logs/events from a contract |
| `get_erc20_transfers` | Get ERC20 transfer events |
| `get_approval_events` | Get token approval events |
| `get_logs_by_topic` | Get logs filtered by topic |
| `get_event_topics` | Get event signature topics |
| `calculate_event_signature` | Calculate event topic from signature |
| `get_recent_events` | Get recent events for a contract |

### Examples

```
Get USDC transfers in last 100 blocks
→ get_erc20_transfers(
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    fromBlock: -100,
    chain: "ethereum"
  )
```

---

## Gas Module

Gas price and estimation tools.

### Tools

| Tool | Description |
|------|-------------|
| `get_gas_price` | Get current gas price |
| `get_gas_prices_all_chains` | Get gas prices across multiple chains |
| `get_eip1559_fees` | Get EIP-1559 fee estimates |
| `estimate_gas` | Estimate gas for a transaction |
| `get_standard_gas_limits` | Get standard gas limits by tx type |
| `calculate_tx_cost` | Calculate total transaction cost |
| `get_gas_history` | Get historical gas prices |

### Examples

```
Get current gas prices on Ethereum
→ get_gas_price(chain: "ethereum")

Get EIP-1559 fees
→ get_eip1559_fees(chain: "ethereum")
```

---

## Governance Module

DAO governance operations.

### Tools

| Tool | Description |
|------|-------------|
| `get_proposal_details` | Get details of a governance proposal |
| `cast_vote` | Cast a vote on a proposal |
| `get_voting_power` | Get voting power for an address |
| `get_governance_params` | Get governance contract parameters |
| `check_vote_eligibility` | Check if address can vote |

---

## Lending Module

DeFi lending protocol interactions (Aave, Compound).

### Tools

| Tool | Description |
|------|-------------|
| `get_lending_position` | Get user's lending position |
| `get_lending_rates` | Get current lending/borrowing rates |
| `get_lending_protocols` | Get supported lending protocols |
| `calculate_health_factor` | Calculate position health factor |
| `get_flash_loan_info` | Get flash loan availability info |

---

## MEV Module

MEV protection and private transactions via Flashbots.

### Tools

| Tool | Description |
|------|-------------|
| `send_private_transaction` | Send transaction via private mempool |
| `simulate_bundle` | Simulate a bundle of transactions |
| `check_mev_exposure` | Check transaction MEV exposure risk |

---

## Multicall Module

Batched contract calls for efficiency.

### Tools

| Tool | Description |
|------|-------------|
| `execute_multicall` | Execute multiple contract calls in one |
| `get_multi_token_balances` | Get multiple token balances at once |
| `get_multi_token_info` | Get info for multiple tokens |
| `get_multi_native_balances` | Get native balances for multiple addresses |

---

## Network Module

Network information and status.

### Tools

| Tool | Description |
|------|-------------|
| `get_chain_info` | Get blockchain network information |
| `get_supported_networks` | List all supported networks |
| `estimate_block_time` | Estimate time for block confirmation |
| `get_finality_status` | Check transaction finality status |
| `get_pending_transactions_info` | Get pending transaction pool info |
| `get_network_metadata` | Get network metadata |
| `get_gas_oracle` | Get gas oracle data |
| `get_network_health` | Check network health status |

---

## NFT Module

NFT operations (ERC721/ERC1155).

### Tools

| Tool | Description |
|------|-------------|
| `get_nft_info` | Get NFT metadata and details |
| `get_erc1155_token_metadata` | Get ERC1155 token metadata |
| `transfer_nft` | Transfer an ERC721 NFT |
| `transfer_erc1155` | Transfer ERC1155 tokens |
| `get_nft_collection_info` | Get NFT collection information |
| `get_nfts_by_owner` | Get all NFTs owned by an address |
| `check_nft_ownership` | Check if address owns specific NFT |
| `approve_nft_for_marketplace` | Approve NFT for marketplace |
| `revoke_nft_approval` | Revoke NFT approval |

---

## Portfolio Module

Portfolio tracking and analysis.

### Tools

| Tool | Description |
|------|-------------|
| `get_portfolio_overview` | Get portfolio summary |
| `get_token_balance` | Get specific token balance |
| `get_multichain_portfolio` | Get portfolio across multiple chains |
| `get_wallet_activity` | Get recent wallet activity |
| `calculate_portfolio_allocation` | Calculate asset allocation |

---

## Price Feeds Module

Chainlink oracle and price feed operations.

### Tools

| Tool | Description |
|------|-------------|
| `get_chainlink_price` | Get price from Chainlink oracle |
| `get_available_price_feeds` | List available Chainlink feeds |
| `get_custom_price_feed` | Get price from custom oracle |
| `get_multiple_prices` | Get multiple prices at once |
| `get_uniswap_pool_price` | Get price from Uniswap pool |
| `check_price_feed_health` | Check oracle health status |

---

## Security Module

Security analysis tools via GoPlus.

### Tools

| Tool | Description |
|------|-------------|
| `analyze_token_security` | Analyze token for security issues (honeypot, rug pull) |
| `check_approval_risks` | Check token approval risks |
| `verify_contract` | Verify contract source code |

---

## Signatures Module

Cryptographic signature operations.

### Tools

| Tool | Description |
|------|-------------|
| `sign_message` | Sign a message with private key |
| `verify_message_signature` | Verify a message signature |
| `sign_typed_data` | Sign EIP-712 typed data |
| `verify_typed_data_signature` | Verify typed data signature |
| `hash_message` | Hash a message |
| `create_permit_signature` | Create ERC20 permit signature |
| `recover_signer` | Recover signer from signature |

---

## Staking Module

Token staking operations (Lido, etc.).

### Tools

| Tool | Description |
|------|-------------|
| `get_staking_position` | Get staking position details |
| `stake_tokens` | Stake tokens in a protocol |

---

## Swap Module

DEX swap operations via 1inch, 0x, ParaSwap.

### Tools

| Tool | Description |
|------|-------------|
| `get_swap_quote` | Get swap quote from DEX aggregators |
| `execute_swap` | Execute a token swap |
| `get_best_route` | Find best swap route across DEXs |

### Examples

```
Get quote to swap 1 ETH for USDC
→ get_swap_quote(
    fromToken: "ETH",
    toToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    amount: "1",
    chain: "ethereum"
  )
```

---

## Tokens Module

ERC20 token operations.

### Tools

| Tool | Description |
|------|-------------|
| `get_erc20_token_info` | Get ERC20 token details |
| `get_native_balance` | Get native token balance |
| `get_erc20_balance` | Get ERC20 token balance |
| `create_erc20_token` | Deploy a new ERC20 token |
| `wrap_native_token` | Wrap native token (ETH→WETH) |
| `unwrap_native_token` | Unwrap wrapped native token |
| `get_wrapped_native_balance` | Get wrapped token balance |
| `batch_transfer_erc20` | Transfer tokens to multiple addresses |
| `burn_erc20_tokens` | Burn ERC20 tokens |

---

## Transactions Module

Transaction management.

### Tools

| Tool | Description |
|------|-------------|
| `get_transaction` | Get transaction details |
| `estimate_gas` | Estimate gas for transaction |
| `speed_up_transaction` | Speed up pending transaction |
| `cancel_transaction` | Cancel pending transaction |
| `get_pending_transaction_count` | Get pending tx count |
| `simulate_transaction` | Simulate transaction execution |

---

## Wallet Module

Wallet management operations.

### Tools

| Tool | Description |
|------|-------------|
| `get_address_from_private_key` | Derive address from private key |
| `generate_mnemonic` | Generate new mnemonic phrase |
| `derive_addresses_from_mnemonic` | Derive addresses from mnemonic |
| `create_wallet` | Create new wallet |
| `import_wallet_from_mnemonic` | Import wallet from mnemonic |
| `transfer_native_token` | Transfer native tokens |
| `approve_token_spending` | Approve token spending |
| `transfer_erc20` | Transfer ERC20 tokens |
| `get_token_approvals` | Get all token approvals |

### Examples

```
Transfer 0.1 ETH to address
→ transfer_native_token(
    to: "0x...",
    amount: "0.1",
    chain: "ethereum"
  )
```


<!-- EOF: nich.xbt | ucm:n1ch-0las-4e49-4348-786274000000 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->
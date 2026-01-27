<!-- universal-crypto-mcp | nicholas | 0x4E494348 -->

# Complete Tools List

<!-- Maintained by n1ch0las | ID: n1ch-0las-4e49-4348-786274000000 -->

A comprehensive list of all **380+ tools** available in Universal Crypto MCP.

---

## EVM Blockchain Tools (~120 tools)

### Blocks (7 tools)
| Tool | Description |
|------|-------------|
| `get_block_by_hash` | Get block data by block hash |
| `get_block_by_number` | Get block data by block number |
| `get_latest_block` | Get the latest block on the network |
| `get_block_with_transactions` | Get block with all transaction details |
| `get_uncle_blocks` | Get uncle blocks for a given block |
| `get_block_receipts` | Get all transaction receipts in a block |
| `get_block_range` | Get data for a range of blocks |

### Bridge (4 tools)
| Tool | Description |
|------|-------------|
| `get_bridge_quote` | Get a quote for bridging assets between chains |
| `execute_bridge` | Execute a cross-chain bridge transaction |
| `get_bridge_status` | Check the status of a bridge transaction |
| `get_supported_bridges` | Get list of supported bridge providers |

### Contracts (3 tools)
| Tool | Description |
|------|-------------|
| `is_contract` | Check if an address is a contract |
| `read_contract` | Read data from a smart contract |
| `write_contract` | Execute a write operation on a contract |

### Deployment (4 tools)
| Tool | Description |
|------|-------------|
| `deploy_contract` | Deploy a smart contract |
| `deploy_create2` | Deploy using CREATE2 for deterministic addresses |
| `deploy_proxy` | Deploy an upgradeable proxy contract |
| `upgrade_proxy` | Upgrade a proxy contract implementation |

### Domains / ENS (8 tools)
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

### Events (7 tools)
| Tool | Description |
|------|-------------|
| `get_contract_logs` | Get logs/events from a contract |
| `get_erc20_transfers` | Get ERC20 transfer events |
| `get_approval_events` | Get token approval events |
| `get_logs_by_topic` | Get logs filtered by topic |
| `get_event_topics` | Get event signature topics |
| `calculate_event_signature` | Calculate event topic from signature |
| `get_recent_events` | Get recent events for a contract |

### Gas (7 tools)
| Tool | Description |
|------|-------------|
| `get_gas_price` | Get current gas price |
| `get_gas_prices_all_chains` | Get gas prices across multiple chains |
| `get_eip1559_fees` | Get EIP-1559 fee estimates |
| `estimate_gas` | Estimate gas for a transaction |
| `get_standard_gas_limits` | Get standard gas limits by tx type |
| `calculate_tx_cost` | Calculate total transaction cost |
| `get_gas_history` | Get historical gas prices |

### Governance (5 tools)
| Tool | Description |
|------|-------------|
| `get_proposal_details` | Get details of a governance proposal |
| `cast_vote` | Cast a vote on a proposal |
| `get_voting_power` | Get voting power for an address |
| `get_governance_params` | Get governance contract parameters |
| `check_vote_eligibility` | Check if address can vote |

### Lending (5 tools)
| Tool | Description |
|------|-------------|
| `get_lending_position` | Get user's lending position |
| `get_lending_rates` | Get current lending/borrowing rates |
| `get_lending_protocols` | Get supported lending protocols |
| `calculate_health_factor` | Calculate position health factor |
| `get_flash_loan_info` | Get flash loan availability info |

### MEV (3 tools)
| Tool | Description |
|------|-------------|
| `send_private_transaction` | Send transaction via private mempool |
| `simulate_bundle` | Simulate a bundle of transactions |
| `check_mev_exposure` | Check transaction MEV exposure risk |

### Multicall (4 tools)
| Tool | Description |
|------|-------------|
| `execute_multicall` | Execute multiple contract calls in one |
| `get_multi_token_balances` | Get multiple token balances at once |
| `get_multi_token_info` | Get info for multiple tokens |
| `get_multi_native_balances` | Get native balances for multiple addresses |

### Network (8 tools)
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

### NFT (9 tools)
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

### Portfolio (5 tools)
| Tool | Description |
|------|-------------|
| `get_portfolio_overview` | Get portfolio summary |
| `get_token_balance` | Get specific token balance |
| `get_multichain_portfolio` | Get portfolio across multiple chains |
| `get_wallet_activity` | Get recent wallet activity |
| `calculate_portfolio_allocation` | Calculate asset allocation |

### Price Feeds (6 tools)
| Tool | Description |
|------|-------------|
| `get_chainlink_price` | Get price from Chainlink oracle |
| `get_available_price_feeds` | List available Chainlink feeds |
| `get_custom_price_feed` | Get price from custom oracle |
| `get_multiple_prices` | Get multiple prices at once |
| `get_uniswap_pool_price` | Get price from Uniswap pool |
| `check_price_feed_health` | Check oracle health status |

### Security (3 tools)
| Tool | Description |
|------|-------------|
| `analyze_token_security` | Analyze token for security issues |
| `check_approval_risks` | Check token approval risks |
| `verify_contract` | Verify contract source code |

### Signatures (7 tools)
| Tool | Description |
|------|-------------|
| `sign_message` | Sign a message with private key |
| `verify_message_signature` | Verify a message signature |
| `sign_typed_data` | Sign EIP-712 typed data |
| `verify_typed_data_signature` | Verify typed data signature |
| `hash_message` | Hash a message |
| `create_permit_signature` | Create ERC20 permit signature |
| `recover_signer` | Recover signer from signature |

### Staking (2 tools)
| Tool | Description |
|------|-------------|
| `get_staking_position` | Get staking position details |
| `stake_tokens` | Stake tokens in a protocol |

### Swap (3 tools)
| Tool | Description |
|------|-------------|
| `get_swap_quote` | Get swap quote from DEX aggregators |
| `execute_swap` | Execute a token swap |
| `get_best_route` | Find best swap route across DEXs |

### Tokens (9 tools)
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

### Transactions (6 tools)
| Tool | Description |
|------|-------------|
| `get_transaction` | Get transaction details |
| `estimate_gas` | Estimate gas for transaction |
| `speed_up_transaction` | Speed up pending transaction |
| `cancel_transaction` | Cancel pending transaction |
| `get_pending_transaction_count` | Get pending tx count |
| `simulate_transaction` | Simulate transaction execution |

### Wallet (9 tools)
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

---

## Data & Analytics Tools (~100 tools)

### CoinGecko (5 tools)
| Tool | Description |
|------|-------------|
| `coingecko_search` | Search for coins |
| `coingecko_get_prices` | Get current prices |
| `coingecko_get_coin_info` | Get detailed coin information |
| `coingecko_get_global_data` | Get global market data |
| `coingecko_get_trending` | Get trending coins |

### DeFi / DefiLlama (21 tools)
| Tool | Description |
|------|-------------|
| `defi_get_protocols` | Get all DeFi protocols |
| `defi_get_protocol` | Get specific protocol details |
| `defi_get_protocol_tvl` | Get protocol TVL history |
| `defi_get_chains` | Get all chains with DeFi |
| `defi_get_chain_tvl` | Get TVL for a chain |
| `defi_get_chain_protocols` | Get protocols on a chain |
| `defi_get_yields` | Get yield farming opportunities |
| `defi_get_yield_pool` | Get specific yield pool details |
| `defi_get_fees_overview` | Get protocol fees overview |
| `defi_get_protocol_fees` | Get fees for specific protocol |
| `defi_get_chain_fees` | Get fees by chain |
| `defi_get_dex_volume` | Get DEX trading volume |
| `defi_get_dex_protocol_volume` | Get volume for specific DEX |
| `defi_get_chain_dex_volume` | Get DEX volume by chain |
| `defi_get_options_volume` | Get options trading volume |
| `defi_get_stablecoins` | Get stablecoin market data |
| `defi_get_stablecoin` | Get specific stablecoin info |
| `defi_get_stablecoin_chains` | Get stablecoins by chain |
| `defi_get_bridges` | Get bridge protocols |
| `defi_get_bridge` | Get specific bridge details |
| `defi_get_bridge_volume` | Get bridge volume |

### DEX Analytics (17 tools)
| Tool | Description |
|------|-------------|
| `dex_get_networks` | Get supported DEX networks |
| `dex_get_network_dexes` | Get DEXs on a network |
| `dex_get_network_pools` | Get pools on a network |
| `dex_get_dex_pools` | Get pools for a specific DEX |
| `dex_get_pool_details` | Get detailed pool information |
| `dex_get_token_details` | Get token details from DEX |
| `dex_get_token_pools` | Get pools for a token |
| `dex_get_pool_ohlcv` | Get OHLCV data for pool |
| `dex_get_pool_transactions` | Get pool transactions |
| `dex_search` | Search across DEX data |
| `dex_get_stats` | Get DEX statistics |
| `dex_get_multi_prices` | Get prices for multiple tokens |
| `geckoterminal_get_networks` | Get GeckoTerminal networks |
| `geckoterminal_get_dexes` | Get DEXs from GeckoTerminal |
| `geckoterminal_trending_pools` | Get trending pools |
| `geckoterminal_new_pools` | Get newly created pools |
| `geckoterminal_top_pools` | Get top pools by volume |

### Technical Indicators (53 tools)

#### Trend (20 tools)
| Tool | Description |
|------|-------------|
| `indicator_apo` | Absolute Price Oscillator |
| `indicator_aroon` | Aroon Indicator |
| `indicator_bop` | Balance of Power |
| `indicator_cfo` | Chande Forecast Oscillator |
| `indicator_cci` | Commodity Channel Index |
| `indicator_dema` | Double Exponential Moving Average |
| `indicator_ema` | Exponential Moving Average |
| `indicator_mass_index` | Mass Index |
| `indicator_macd` | MACD |
| `indicator_mmax` | Moving Max |
| `indicator_mmin` | Moving Min |
| `indicator_msum` | Moving Sum |
| `indicator_psar` | Parabolic SAR |
| `indicator_qstick` | Qstick |
| `indicator_kdj` | KDJ Indicator |
| `indicator_sma` | Simple Moving Average |
| `indicator_tema` | Triple Exponential Moving Average |
| `indicator_trix` | Triple Exponential Average |
| `indicator_vwma` | Volume Weighted Moving Average |
| `indicator_vortex` | Vortex Indicator |

#### Momentum (9 tools)
| Tool | Description |
|------|-------------|
| `indicator_ao` | Awesome Oscillator |
| `indicator_chaikin_oscillator` | Chaikin Oscillator |
| `indicator_ichimoku` | Ichimoku Cloud |
| `indicator_ppo` | Percentage Price Oscillator |
| `indicator_pvo` | Percentage Volume Oscillator |
| `indicator_roc` | Price Rate of Change |
| `indicator_rsi` | Relative Strength Index |
| `indicator_stochastic` | Stochastic Oscillator |
| `indicator_williams_r` | Williams %R |

#### Volatility (11 tools)
| Tool | Description |
|------|-------------|
| `indicator_acceleration_bands` | Acceleration Bands |
| `indicator_atr` | Average True Range |
| `indicator_bollinger_bands` | Bollinger Bands |
| `indicator_bbw` | Bollinger Bands Width |
| `indicator_chandelier_exit` | Chandelier Exit |
| `indicator_donchian_channel` | Donchian Channel |
| `indicator_keltner_channel` | Keltner Channel |
| `indicator_mstd` | Moving Standard Deviation |
| `indicator_projection_oscillator` | Projection Oscillator |
| `indicator_true_range` | True Range |
| `indicator_ulcer_index` | Ulcer Index |

#### Volume (9 tools)
| Tool | Description |
|------|-------------|
| `indicator_ad` | Accumulation/Distribution |
| `indicator_cmf` | Chaikin Money Flow |
| `indicator_emv` | Ease of Movement |
| `indicator_force_index` | Force Index |
| `indicator_mfi` | Money Flow Index |
| `indicator_nvi` | Negative Volume Index |
| `indicator_obv` | On-Balance Volume |
| `indicator_vpt` | Volume Price Trend |
| `indicator_vwap` | VWAP |

### TradingView Screeners (6 tools)
| Tool | Description |
|------|-------------|
| `screener_top_gainers` | Get top gaining cryptocurrencies |
| `screener_top_losers` | Get top losing cryptocurrencies |
| `screener_bollinger_squeeze` | Find Bollinger Band squeeze setups |
| `screener_rsi_oversold` | Find RSI oversold coins |
| `screener_rsi_overbought` | Find RSI overbought coins |
| `screener_volume_spike` | Find unusual volume spikes |

### Market Data / CoinStats (14 tools)
| Tool | Description |
|------|-------------|
| `market_get_coins` | Get comprehensive crypto data |
| `market_get_coin_by_id` | Get specific coin details |
| `market_get_coin_chart` | Get historical chart data |
| `market_get_coin_avg_price` | Get historical average price |
| `market_get_exchange_price` | Get exchange-specific price |
| `market_get_exchanges` | List cryptocurrency exchanges |
| `market_get_tickers` | Get trading pairs/tickers |
| `market_get_blockchains` | Get supported blockchains |
| `market_get_wallet_balance` | Get wallet balance |
| `market_get_wallet_balances_all` | Get balances across networks |
| `market_get_wallet_transactions` | Get wallet transactions |
| `market_get_global` | Get global market statistics |
| `market_get_news_sources` | Get news sources |
| `market_get_news` | Get crypto news |

### News (6 tools)
| Tool | Description |
|------|-------------|
| `get_crypto_news` | Get latest crypto news |
| `search_crypto_news` | Search news by keywords |
| `get_defi_news` | Get DeFi-specific news |
| `get_bitcoin_news` | Get Bitcoin-specific news |
| `get_breaking_crypto_news` | Get breaking news |
| `get_crypto_news_sources` | List all news sources |

### Research (7 tools)
| Tool | Description |
|------|-------------|
| `research_create_plan` | Create research plan |
| `research_search` | Perform web search |
| `research_fetch_url` | Fetch content from URL |
| `research_update_section` | Update section status |
| `research_get_status` | Get session status |
| `research_add_note` | Add note to session |
| `research_generate_report` | Generate report |

### Rubic (4 tools)
| Tool | Description |
|------|-------------|
| `rubic_get_supported_chains` | Get supported chains |
| `rubic_get_bridge_quote` | Get bridge quote |
| `rubic_get_bridge_quotes` | Get all bridge routes |
| `rubic_get_cross_chain_status` | Check tx status |

### Social / LunarCrush (18 tools)
| Tool | Description |
|------|-------------|
| `social_get_coin_metrics` | Get social metrics for a coin |
| `social_get_coins_list` | Get social metrics for top coins |
| `social_get_coin_time_series` | Get historical social metrics |
| `social_get_feed` | Get social posts about crypto |
| `social_get_trending_posts` | Get viral social posts |
| `social_get_influencers` | Get top crypto influencers |
| `social_get_influencer` | Get influencer details |
| `social_get_influencer_posts` | Get influencer posts |
| `social_get_topics` | Get trending topics |
| `social_get_topic` | Get specific topic metrics |
| `social_get_categories` | Get coin categories |
| `social_get_nft_collections` | Get NFT social metrics |
| `social_get_nft_collection` | Get specific NFT collection |
| `social_get_market_sentiment` | Get market sentiment |
| `social_get_market_sentiment_history` | Get historical sentiment |
| `social_get_reddit_stats` | Get Reddit statistics |
| `social_get_twitter_stats` | Get Twitter/X statistics |
| `social_get_github_stats` | Get GitHub activity stats |

---

## Multi-Chain Tools (~80 tools)

### Bitcoin (4 tools)
| Tool | Description |
|------|-------------|
| `bitcoin_get_balance` | Get Bitcoin address balance |
| `bitcoin_get_transaction_history` | Get BTC transaction history |
| `bitcoin_validate_address` | Validate Bitcoin address format |
| `bitcoin_get_network_info` | Get Bitcoin network info |

### Litecoin (4 tools)
| Tool | Description |
|------|-------------|
| `litecoin_get_balance` | Get Litecoin address balance |
| `litecoin_get_transaction_history` | Get LTC transaction history |
| `litecoin_validate_address` | Validate Litecoin address format |
| `litecoin_get_network_info` | Get Litecoin network info |

### Dogecoin (4 tools)
| Tool | Description |
|------|-------------|
| `dogecoin_get_balance` | Get Dogecoin address balance |
| `dogecoin_get_transaction_history` | Get DOGE transaction history |
| `dogecoin_validate_address` | Validate Dogecoin address format |
| `dogecoin_get_network_info` | Get Dogecoin network info |

### Solana (7 tools)
| Tool | Description |
|------|-------------|
| `solana_get_my_address` | Get your Solana address |
| `solana_get_balance` | Get SOL balance |
| `solana_get_account_info` | Get account information |
| `solana_get_spl_token_balances` | Get SPL token balances |
| `solana_get_swap_quote` | Get Jupiter swap quote |
| `solana_execute_swap` | Execute Jupiter swap |
| `solana_transfer` | Transfer SOL |

### TON (5 tools)
| Tool | Description |
|------|-------------|
| `ton_get_balance` | Get TON balance |
| `ton_get_transaction_history` | Get TON transaction history |
| `ton_validate_address` | Validate TON address |
| `ton_get_network_info` | Get TON network info |
| `ton_send_transaction` | Send TON transaction |

### XRP Ledger (7 tools)
| Tool | Description |
|------|-------------|
| `xrp_get_balance` | Get XRP balance |
| `xrp_get_transaction_history` | Get XRP transaction history |
| `xrp_validate_address` | Validate XRP address |
| `xrp_get_ledger_info` | Get XRP Ledger info |
| `xrp_send_transaction` | Send XRP transaction |
| `xrp_get_token_balances` | Get token balances |
| `xrp_create_trustline` | Create token trustline |

### THORChain (6 tools)
| Tool | Description |
|------|-------------|
| `thorchain_get_balance` | Get RUNE balance |
| `thorchain_get_pool_info` | Get pool information |
| `thorchain_get_swap_quote` | Get swap quote |
| `thorchain_get_pools` | Get all pools |
| `thorchain_get_network_info` | Get network info |
| `thorchain_get_inbound_addresses` | Get vault addresses |

### Cosmos/IBC (9 tools) <span class="new-badge">NEW</span>
| Tool | Description |
|------|-------------|
| `cosmos_get_balance` | Get native/IBC token balance |
| `cosmos_get_delegations` | Get staking delegations |
| `cosmos_get_rewards` | Get staking rewards |
| `cosmos_get_validators` | Get chain validators |
| `cosmos_get_account_info` | Get account information |
| `cosmos_transfer` | Transfer tokens |
| `cosmos_delegate` | Delegate to validator |
| `cosmos_undelegate` | Undelegate from validator |
| `cosmos_claim_rewards` | Claim staking rewards |

### Near Protocol (10 tools) <span class="new-badge">NEW</span>
| Tool | Description |
|------|-------------|
| `near_get_balance` | Get NEAR balance |
| `near_get_account_info` | Get account details |
| `near_get_staking_info` | Get staking information |
| `near_get_validators` | Get validators list |
| `near_get_transaction` | Get transaction details |
| `near_transfer` | Transfer NEAR tokens |
| `near_stake` | Stake NEAR tokens |
| `near_unstake` | Unstake NEAR tokens |
| `near_view_function` | Call view function |
| `near_call_function` | Call change function |

### Sui (10 tools) <span class="new-badge">NEW</span>
| Tool | Description |
|------|-------------|
| `sui_get_balance` | Get SUI balance |
| `sui_get_objects` | Get owned objects |
| `sui_get_coins` | Get coin objects |
| `sui_get_transaction` | Get transaction details |
| `sui_get_staking_info` | Get staking information |
| `sui_transfer` | Transfer SUI tokens |
| `sui_transfer_object` | Transfer object NFT |
| `sui_stake` | Stake SUI tokens |
| `sui_unstake` | Unstake SUI tokens |
| `sui_execute_move_call` | Execute Move function |

### Aptos (11 tools) <span class="new-badge">NEW</span>
| Tool | Description |
|------|-------------|
| `aptos_get_balance` | Get APT balance |
| `aptos_get_account_info` | Get account resources |
| `aptos_get_transactions` | Get account transactions |
| `aptos_get_staking_info` | Get staking delegations |
| `aptos_get_validators` | Get validators list |
| `aptos_transfer` | Transfer APT tokens |
| `aptos_stake` | Stake APT tokens |
| `aptos_unstake` | Unstake APT tokens |
| `aptos_claim_rewards` | Claim staking rewards |
| `aptos_view_function` | Call view function |
| `aptos_execute_function` | Execute entry function |

---

## Trading Strategies (25 tools)

### Trend Strategies (10 tools)
| Tool | Description |
|------|-------------|
| `strategy_macd` | MACD crossover strategy |
| `strategy_awesome_oscillator` | AO zero-cross strategy |
| `strategy_trix` | TRIX crossover strategy |
| `strategy_vortex` | Vortex indicator strategy |
| `strategy_kdj` | KDJ crossover strategy |
| `strategy_aroon` | Aroon crossover strategy |
| `strategy_parabolic_sar` | PSAR trend strategy |
| `strategy_qstick` | Qstick strategy |
| `strategy_triple_ma` | Triple MA crossover |
| `strategy_golden_cross` | Golden cross/death cross |

### Momentum Strategies (6 tools)
| Tool | Description |
|------|-------------|
| `strategy_rsi2` | RSI(2) mean reversion |
| `strategy_stochastic_rsi` | Stochastic RSI crossover |
| `strategy_williams_r` | Williams %R strategy |
| `strategy_ichimoku` | Ichimoku cloud strategy |
| `strategy_ppo` | PPO signal strategy |
| `strategy_chaikin` | Chaikin oscillator strategy |

### Volatility Strategies (3 tools)
| Tool | Description |
|------|-------------|
| `strategy_bollinger_bands` | BB breakout/reversal |
| `strategy_keltner_channel` | Keltner breakout |
| `strategy_donchian` | Donchian breakout |

### Volume Strategies (6 tools)
| Tool | Description |
|------|-------------|
| `strategy_obv` | OBV trend strategy |
| `strategy_cmf` | CMF strategy |
| `strategy_mfi` | MFI strategy |
| `strategy_force_index` | Force Index strategy |
| `strategy_emv` | EMV strategy |
| `strategy_vwap` | VWAP crossover |

---

## Prediction Markets (4 tools)

### Polymarket Integration
| Tool | Description |
|------|-------------|
| `predictions_get_markets` | Get active prediction markets |
| `predictions_get_market` | Get market details by ID |
| `predictions_search_markets` | Search markets by keyword |
| `predictions_get_crypto_markets` | Get crypto-related markets |

---

## WebSocket Subscriptions (8 tools) <span class="new-badge">NEW</span>

### Real-Time Data Streams
| Tool | Description |
|------|-------------|
| `ws_subscribe_price` | Subscribe to real-time price updates |
| `ws_subscribe_trades` | Subscribe to trade stream |
| `ws_subscribe_orderbook` | Subscribe to order book updates |
| `ws_subscribe_blocks` | Subscribe to new blocks |
| `ws_subscribe_mempool` | Subscribe to mempool transactions |
| `ws_unsubscribe` | Unsubscribe from a stream |
| `ws_list_subscriptions` | List active subscriptions |
| `ws_get_connection_status` | Get WebSocket connection status |

---

## Alerts System (13 tools) <span class="new-badge">NEW</span>

### Price Alerts (4 tools)
| Tool | Description |
|------|-------------|
| `alert_create_price` | Create price threshold alert |
| `alert_create_percent_change` | Create % change alert |
| `alert_list_price` | List active price alerts |
| `alert_delete_price` | Delete a price alert |

### Whale Alerts (5 tools)
| Tool | Description |
|------|-------------|
| `alert_create_whale` | Create whale movement alert |
| `alert_configure_whale_threshold` | Set whale threshold amount |
| `alert_list_whale` | List whale alerts |
| `alert_get_recent_whales` | Get recent whale movements |
| `alert_delete_whale` | Delete a whale alert |

### Gas Alerts (4 tools)
| Tool | Description |
|------|-------------|
| `alert_create_gas` | Create gas price alert |
| `alert_configure_gas_threshold` | Set gas threshold |
| `alert_list_gas` | List gas alerts |
| `alert_delete_gas` | Delete a gas alert |

---

## Wallet Analytics (7 tools) <span class="new-badge">NEW</span>

### Wallet Analysis
| Tool | Description |
|------|-------------|
| `analytics_get_wallet_score` | Get wallet reputation score |
| `analytics_get_wallet_activity` | Get wallet activity summary |
| `analytics_get_wallet_pnl` | Get realized/unrealized PnL |
| `analytics_get_top_holders` | Get top token holders |
| `analytics_track_whale` | Add wallet to whale tracking |
| `analytics_untrack_whale` | Remove from whale tracking |
| `analytics_get_tracked_whales` | List tracked whale wallets |

---

## Portfolio Tracker (5 tools) <span class="new-badge">NEW</span>

### Cross-Chain Portfolio
| Tool | Description |
|------|-------------|
| `portfolio_get_overview` | Get full portfolio value across chains |
| `portfolio_get_tokens` | Get all token holdings |
| `portfolio_get_nfts` | Get NFT holdings |
| `portfolio_get_defi_positions` | Get DeFi positions |
| `portfolio_get_history` | Get portfolio value history |

---

## Summary

| Category | Tool Count |
|----------|------------|
| EVM Blockchain | ~120 |
| Data & Analytics | ~100 |
| Multi-Chain | ~120 |
| Trading Strategies | 25 |
| Prediction Markets | 4 |
| WebSocket Subscriptions | 8 |
| Alerts System | 13 |
| Wallet Analytics | 7 |
| Portfolio Tracker | 5 |
| **Total** | **~380** |


<!-- EOF: nicholas | ucm:0x4E494348 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->
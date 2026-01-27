<!-- universal-crypto-mcp | nich | 0x6E696368 -->

# Multi-Chain Modules

<!-- Maintained by nich.xbt | ID: bmljaCBuaXJob2xhcw== -->

Non-EVM blockchain integrations for Bitcoin, Solana, TON, XRP, THORChain, and more.

---

## Bitcoin Module

Bitcoin blockchain operations via xchain-bitcoin.

### Tools

| Tool | Description |
|------|-------------|
| `bitcoin_get_balance` | Get Bitcoin address balance |
| `bitcoin_get_transaction_history` | Get BTC transaction history |
| `bitcoin_validate_address` | Validate Bitcoin address format |
| `bitcoin_get_network_info` | Get Bitcoin network info |

### Supported Address Formats

- Legacy (P2PKH): `1...`
- SegWit (P2SH): `3...`
- Native SegWit (bech32): `bc1q...`
- Taproot (bech32m): `bc1p...`

### Examples

```
Get Bitcoin balance
→ bitcoin_get_balance(address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh")

Validate address
→ bitcoin_validate_address(address: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2")
```

---

## Litecoin Module

Litecoin blockchain operations via xchain-litecoin.

### Tools

| Tool | Description |
|------|-------------|
| `litecoin_get_balance` | Get Litecoin address balance |
| `litecoin_get_transaction_history` | Get LTC transaction history |
| `litecoin_validate_address` | Validate Litecoin address format |
| `litecoin_get_network_info` | Get Litecoin network info |

### Supported Address Formats

- Legacy: `L...`
- SegWit: `ltc1...`

### Examples

```
Get Litecoin balance
→ litecoin_get_balance(address: "ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh")
```

---

## Dogecoin Module

Dogecoin blockchain operations via xchain-doge.

### Tools

| Tool | Description |
|------|-------------|
| `dogecoin_get_balance` | Get Dogecoin address balance |
| `dogecoin_get_transaction_history` | Get DOGE transaction history |
| `dogecoin_validate_address` | Validate Dogecoin address format |
| `dogecoin_get_network_info` | Get Dogecoin network info |

### Supported Address Formats

- P2PKH: `D...`

### Examples

```
Get Dogecoin balance
→ dogecoin_get_balance(address: "D7Pv5KhSv6KQT9EQyMjGN7vFxMhU2eT7dP")
```

---

## Solana Module

Solana blockchain and Jupiter DEX integration.

### Wallet Tools

| Tool | Description |
|------|-------------|
| `solana_get_my_address` | Get your Solana address from env |
| `solana_get_balance` | Get SOL balance for address |
| `solana_get_account_info` | Get detailed account information |
| `solana_get_spl_token_balances` | Get SPL token balances |

### Jupiter DEX Tools

| Tool | Description |
|------|-------------|
| `solana_get_swap_quote` | Get Jupiter DEX swap quote |
| `solana_execute_swap` | Execute Jupiter DEX swap |

### Transfer Tools

| Tool | Description |
|------|-------------|
| `solana_transfer` | Transfer SOL to address |

### Environment Variables

```bash
SOLANA_PRIVATE_KEY=your_base58_private_key
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Examples

```
Get SOL balance
→ solana_get_balance(address: "...")

Get Jupiter swap quote
→ solana_get_swap_quote(
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "1000000000"
  )

Get all SPL token balances
→ solana_get_spl_token_balances(address: "...")
```

---

## TON Module

TON (The Open Network) blockchain operations.

### Tools

| Tool | Description |
|------|-------------|
| `ton_get_balance` | Get TON address balance |
| `ton_get_transaction_history` | Get TON transaction history |
| `ton_validate_address` | Validate TON address format |
| `ton_get_network_info` | Get TON network information |
| `ton_send_transaction` | Send TON transaction |

### Address Formats

TON supports multiple address formats:
- Raw: `0:...` (workchain:hex)
- User-friendly: `EQ...` or `UQ...`
- Bounceable vs Non-bounceable

### Environment Variables

```bash
TON_MNEMONIC=word1 word2 ... word24
TON_NETWORK=mainnet
```

### Examples

```
Get TON balance
→ ton_get_balance(address: "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2")

Send TON
→ ton_send_transaction(to: "EQ...", amount: "1.5")
```

---

## XRP Ledger Module

XRP Ledger operations via xrpl.js.

### Balance Tools

| Tool | Description |
|------|-------------|
| `xrp_get_balance` | Get XRP address balance |
| `xrp_get_token_balances` | Get token balances on XRPL |

### Transaction Tools

| Tool | Description |
|------|-------------|
| `xrp_get_transaction_history` | Get XRP transaction history |
| `xrp_send_transaction` | Send XRP transaction |

### Network Tools

| Tool | Description |
|------|-------------|
| `xrp_validate_address` | Validate XRP address format |
| `xrp_get_ledger_info` | Get XRP Ledger information |

### Token Tools

| Tool | Description |
|------|-------------|
| `xrp_create_trustline` | Create token trustline |

### Address Format

XRP addresses start with `r`:
- Example: `rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh`

### Environment Variables

```bash
XRP_SECRET=sEd...
XRP_NETWORK=mainnet
```

### Examples

```
Get XRP balance
→ xrp_get_balance(address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh")

Create trustline for a token
→ xrp_create_trustline(
    currency: "USD",
    issuer: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    limit: "1000000"
  )
```

---

## THORChain Module

THORChain cross-chain DEX operations.

### Balance Tools

| Tool | Description |
|------|-------------|
| `thorchain_get_balance` | Get RUNE balance |

### Pool Tools

| Tool | Description |
|------|-------------|
| `thorchain_get_pool_info` | Get liquidity pool information |
| `thorchain_get_pools` | Get all available pools |

### Swap Tools

| Tool | Description |
|------|-------------|
| `thorchain_get_swap_quote` | Get THORChain swap quote |

### Network Tools

| Tool | Description |
|------|-------------|
| `thorchain_get_network_info` | Get network information |
| `thorchain_get_inbound_addresses` | Get vault addresses |

### Supported Assets

THORChain supports native cross-chain swaps:
- BTC (Bitcoin)
- ETH (Ethereum + ERC20s)
- BNB (BNB Chain)
- AVAX (Avalanche)
- DOGE (Dogecoin)
- LTC (Litecoin)
- BCH (Bitcoin Cash)
- ATOM (Cosmos)
- RUNE (native)

### Examples

```
Get swap quote BTC → ETH
→ thorchain_get_swap_quote(
    fromAsset: "BTC.BTC",
    toAsset: "ETH.ETH",
    amount: "10000000"
  )

Get pool information
→ thorchain_get_pool_info(asset: "BTC.BTC")

Get all pools
→ thorchain_get_pools()
```

---

## BNB Chain Module

BNB Chain (BSC) specific tools - extending EVM with chain-specific features.

### Network Tools

| Tool | Description |
|------|-------------|
| `get_chain_info` | Get BNB chain information |
| `get_supported_networks` | Get supported BNB networks (BSC, opBNB) |

### Block Tools

| Tool | Description |
|------|-------------|
| `get_block_by_hash` | Get block by hash |
| `get_block_by_number` | Get block by number |
| `get_latest_block` | Get latest block |

### Contract Tools

| Tool | Description |
|------|-------------|
| `is_contract` | Check if address is contract |
| `read_contract` | Read contract data |
| `write_contract` | Write to contract |

### Wallet Tools

| Tool | Description |
|------|-------------|
| `get_address_from_private_key` | Derive address from key |
| `transfer_native_token` | Transfer BNB |
| `approve_token_spending` | Approve token spending |
| `transfer_erc20` | Transfer BEP20 tokens |

### Token Tools

| Tool | Description |
|------|-------------|
| `get_erc20_token_info` | Get BEP20 token info |
| `get_native_balance` | Get BNB balance |
| `get_erc20_balance` | Get BEP20 balance |
| `create_erc20_token` | Create BEP20 token |

### Supported Networks

| Network | Chain ID | Type |
|---------|----------|------|
| BNB Smart Chain | 56 | Mainnet |
| BSC Testnet | 97 | Testnet |
| opBNB Mainnet | 204 | L2 |
| opBNB Testnet | 5611 | L2 Testnet |

---

## Algorand Module

Algorand blockchain operations.

### Tools

| Tool | Description |
|------|-------------|
| `algorand_get_account_info` | Get Algorand account information |
| `algorand_get_balance` | Get ALGO balance |
| `algorand_get_assets` | Get ASA (Algorand Standard Assets) |

*Note: Full Algorand integration in development.*

---

## Cosmos Module

Cosmos SDK chain operations (ATOM, OSMO, JUNO, and more).

### Tools (9 tools)

| Tool | Description |
|------|-------------|
| `cosmos_get_balance` | Get balance of a Cosmos SDK chain address |
| `cosmos_get_account` | Get account info (sequence number, pubkey) |
| `cosmos_get_delegations` | Get staking delegations |
| `cosmos_get_rewards` | Get staking rewards |
| `cosmos_get_validators` | Get list of validators |
| `cosmos_get_ibc_channels` | Get IBC channels for cross-chain transfers |
| `cosmos_get_proposals` | Get governance proposals |
| `cosmos_get_transaction` | Get transaction details |
| `cosmos_get_supported_chains` | List supported Cosmos chains |

### Supported Chains

- Cosmos Hub (ATOM)
- Osmosis (OSMO)
- Juno (JUNO)
- Stargaze (STARS)
- Akash (AKT)
- Injective (INJ)

### Examples

```
Get ATOM balance
→ cosmos_get_balance(address: "cosmos1...", chain: "cosmoshub")

Get Osmosis staking delegations
→ cosmos_get_delegations(address: "osmo1...", chain: "osmosis")

Check validator list
→ cosmos_get_validators(chain: "cosmoshub", limit: 20)
```

---

## Near Protocol Module

Near blockchain operations with full account and contract support.

### Tools (10 tools)

| Tool | Description |
|------|-------------|
| `near_get_balance` | Get NEAR token balance |
| `near_get_account` | Get detailed account information |
| `near_get_access_keys` | Get all access keys for an account |
| `near_get_transaction` | Get transaction details by hash |
| `near_view_contract` | Call view method on a contract |
| `near_get_contract_state` | Get contract state/storage |
| `near_get_block` | Get block by height or finality |
| `near_get_validators` | Get current validator set |
| `near_get_gas_price` | Get current gas price |
| `near_validate_address` | Validate Near account ID format |

### Environment Variables

```bash
NEAR_RPC_URL=https://rpc.mainnet.near.org
```

### Examples

```
Get NEAR balance
→ near_get_balance(accountId: "example.near")

View contract state
→ near_view_contract(
    contractId: "wrap.near",
    methodName: "ft_balance_of",
    args: { account_id: "alice.near" }
  )
```

---

## Sui Module

Sui blockchain operations with object-centric model support.

### Tools (10 tools)

| Tool | Description |
|------|-------------|
| `sui_get_balance` | Get SUI token balance |
| `sui_get_all_balances` | Get all token balances |
| `sui_get_owned_objects` | Get objects owned by address (NFTs, coins) |
| `sui_get_object` | Get object details by ID |
| `sui_get_transaction` | Get transaction block details |
| `sui_get_coins` | Get coins owned by address |
| `sui_get_dynamic_fields` | Get dynamic fields of an object |
| `sui_get_validators` | Get current validator set |
| `sui_get_latest_checkpoint` | Get latest checkpoint |
| `sui_validate_address` | Validate Sui address format |

### Environment Variables

```bash
SUI_RPC_URL=https://fullnode.mainnet.sui.io
```

### Examples

```
Get SUI balance
→ sui_get_balance(address: "0x...")

Get all owned NFTs
→ sui_get_owned_objects(address: "0x...", limit: 50)

Get object details
→ sui_get_object(objectId: "0x...")
```

---

## Aptos Module

Aptos blockchain operations with Move-based account model.

### Tools (11 tools)

| Tool | Description |
|------|-------------|
| `aptos_get_balance` | Get APT token balance |
| `aptos_get_account` | Get account info (sequence number) |
| `aptos_get_resources` | Get all resources owned by account |
| `aptos_get_modules` | Get Move modules deployed by account |
| `aptos_get_transaction` | Get transaction by hash |
| `aptos_get_account_transactions` | Get transactions for account |
| `aptos_get_table_item` | Read from a Move table |
| `aptos_get_token_balance` | Get fungible token balance |
| `aptos_get_block` | Get block by height |
| `aptos_view_function` | Call a view function |
| `aptos_validate_address` | Validate Aptos address format |

### Environment Variables

```bash
APTOS_API_URL=https://fullnode.mainnet.aptoslabs.com/v1
```

### Examples

```
Get APT balance
→ aptos_get_balance(address: "0x...")

Get account resources
→ aptos_get_resources(address: "0x...", limit: 100)

View function call
→ aptos_view_function(
    function: "0x1::coin::balance",
    typeArgs: ["0x1::aptos_coin::AptosCoin"],
    args: ["0x..."]
  )
```

---

## Summary Table

| Chain | Native Token | Main Features |
|-------|--------------|---------------|
| Bitcoin | BTC | Balance, history, validation |
| Litecoin | LTC | Balance, history, validation |
| Dogecoin | DOGE | Balance, history, validation |
| Solana | SOL | Balance, SPL tokens, Jupiter DEX |
| TON | TON | Balance, transfers, validation |
| XRP Ledger | XRP | Balance, tokens, trustlines |
| THORChain | RUNE | Cross-chain swaps, pools |
| BNB Chain | BNB | Full EVM + BSC specifics |
| Algorand | ALGO | Account info, ASAs |
| **Cosmos** | **ATOM** | **Staking, governance, IBC** |
| **Near** | **NEAR** | **Accounts, contracts, access keys** |
| **Sui** | **SUI** | **Objects, NFTs, Move modules** |
| **Aptos** | **APT** | **Resources, Move tables, modules** |

## Cross-Chain Comparison

### Balance Queries

```
Bitcoin:     bitcoin_get_balance(address)
Litecoin:    litecoin_get_balance(address)
Dogecoin:    dogecoin_get_balance(address)
Solana:      solana_get_balance(address)
TON:         ton_get_balance(address)
XRP:         xrp_get_balance(address)
THORChain:   thorchain_get_balance(address)
Cosmos:      cosmos_get_balance(address, chain)
Near:        near_get_balance(accountId)
Sui:         sui_get_balance(address)
Aptos:       aptos_get_balance(address)
EVM Chains:  get_native_balance(address, chain)
```

### Transaction History

```
Bitcoin:     bitcoin_get_transaction_history(address)
Litecoin:    litecoin_get_transaction_history(address)
Dogecoin:    dogecoin_get_transaction_history(address)
TON:         ton_get_transaction_history(address)
XRP:         xrp_get_transaction_history(address)
Near:        near_get_transaction(txHash, sender)
Sui:         sui_get_transaction(txHash)
Aptos:       aptos_get_account_transactions(address)


<!-- EOF: nich | ucm:0x6E696368 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->
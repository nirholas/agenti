# Resources & Prompts

Built-in resources and prompts for AI agents.

---

## Prompts

Prompts provide structured guidance for common tasks.

| Prompt | Description |
|--------|-------------|
| `analyze_block` | Analyze a block and its contents |
| `analyze_transaction` | Analyze a specific transaction |
| `analyze_address` | Analyze an EVM address |
| `interact_with_contract` | Guide for contract interaction |
| `explain_evm_concept` | Explain EVM concepts |
| `compare_networks` | Compare different EVM networks |
| `analyze_token` | Analyze an ERC20 or NFT token |

---

## Using Prompts

### Example: Analyze Transaction

```
Analyze this transaction: 0x123...
```

The AI will use the `analyze_transaction` prompt to provide:
- Transaction details
- Gas usage analysis
- Contract interactions
- Token transfers

### Example: Compare Networks

```
Compare BSC and Arbitrum for DeFi
```

Uses `compare_networks` to explain:
- Gas costs
- Transaction speed
- Ecosystem differences
- Bridge options

---

## Prompt Parameters

Each prompt accepts specific parameters:

### analyze_block

| Parameter | Type | Description |
|-----------|------|-------------|
| `blockNumber` | number | Block to analyze |
| `network` | string | Network name |

### analyze_address

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | EVM address |
| `network` | string | Network name |

### analyze_token

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | Token contract address |
| `network` | string | Network name |

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))

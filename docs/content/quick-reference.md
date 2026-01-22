# Quick Reference Card

> Print this or keep it handy for common commands.

## 🔑 Essential Commands

### Portfolio
```
Check my wallet balance across all chains
Address: 0x...
```

### Swap
```
Swap [amount] [token] to [token] on [chain]
```

### Bridge
```
Bridge [amount] [token] from [chain] to [chain]
```

### Security
```
Is this token safe? Contract: 0x... Chain: [chain]
```

---

## 📊 Market Data

| Prompt | What it does |
|--------|--------------|
| `ETH price` | Current ETH price |
| `BTC 24h change` | Bitcoin daily change |
| `Fear & Greed Index` | Market sentiment |
| `RSI for ETH` | Technical indicator |
| `Top gainers today` | Market movers |

---

## 💱 Swaps

| Prompt | What it does |
|--------|--------------|
| `Quote 1 ETH to USDC on Arbitrum` | Get swap quote |
| `Best DEX for swapping ETH` | Compare prices |
| `Swap 100 USDC to ETH, max 0.5% slippage` | Execute swap |
| `Price impact for 10 ETH swap` | Check slippage |

---

## 🌉 Bridges

| Prompt | What it does |
|--------|--------------|
| `Bridge options ETH → Arbitrum` | List bridges |
| `Cheapest bridge for USDC` | Compare fees |
| `Bridge 100 USDC to Base` | Execute bridge |
| `Bridge time Ethereum to zkSync` | Estimate time |

---

## 🏦 DeFi

| Prompt | What it does |
|--------|--------------|
| `Aave USDC APY` | Lending rates |
| `My Aave health factor` | Position check |
| `Best stablecoin yield` | Find yields |
| `Compound borrow rates` | Borrowing costs |

---

## 🔒 Security

| Prompt | What it does |
|--------|--------------|
| `Honeypot check 0x...` | Detect honeypots |
| `Token security scan 0x...` | Full analysis |
| `Contract owner 0x...` | Check permissions |
| `Liquidity lock status 0x...` | LP analysis |

---

## ⛓️ Chains Quick Reference

| Chain | ID | Native Token |
|-------|-----|--------------|
| Ethereum | 1 | ETH |
| Arbitrum | 42161 | ETH |
| Base | 8453 | ETH |
| Polygon | 137 | MATIC |
| Optimism | 10 | ETH |
| BNB Chain | 56 | BNB |
| Avalanche | 43114 | AVAX |
| zkSync | 324 | ETH |

---

## 🎯 Pro Tips

### Be Specific
❌ `Check balance`
✅ `Check ETH and USDC balance on Arbitrum for 0x...`

### Include Context
❌ `Is it safe?`
✅ `Is this token safe? Contract: 0x1234... on Ethereum`

### Compare Options
✅ `Compare swap rates across Uniswap, 1inch, ParaSwap`

### Ask for Analysis
✅ `Analyze my portfolio and suggest optimizations`

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Tool not found" | Rebuild: `npm run build` |
| Wrong chain | Specify: "on Arbitrum" |
| Stale data | Ask to "refresh" |
| Transaction failed | Check balance + gas |

---

## 📚 Resources

- [Full Documentation](mcp-server/index.md)
- [100+ Example Prompts](prompts/index.md)
- [Tutorials](tutorials/index.md)
- [FAQ](faq.md)

---

<div align="center">

**Universal Crypto MCP** • [GitHub](https://github.com/nirholas/universal-crypto-mcp) • [@nichxbt](https://x.com/nichxbt)

</div>

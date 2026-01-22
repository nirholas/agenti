# Token Security Scanner

> **Tutorial**: Use AI to analyze smart contracts and tokens for security risks before investing.

## Why Security Scanning Matters

In crypto, security risks include:
- 🚨 Honeypots (can buy, can't sell)
- 🚨 Rug pulls (owner can drain liquidity)
- 🚨 Hidden mint functions
- 🚨 Malicious transfer taxes
- 🚨 Proxy contracts with dangerous upgrades

Universal Crypto MCP gives Claude the tools to detect these risks.

## Basic Token Scan

### Quick Security Check

```
Scan this token for security risks:
Contract: 0x1234567890abcdef1234567890abcdef12345678
Chain: Ethereum

Check for:
- Honeypot indicators
- Owner privileges
- Hidden taxes
- Liquidity lock status
```

**Example Response:**

```
🔍 TOKEN SECURITY SCAN
━━━━━━━━━━━━━━━━━━━━━

Token: EXAMPLE (EXM)
Contract: 0x1234...5678
Chain: Ethereum

RISK ASSESSMENT: ⚠️ MEDIUM RISK

✅ Passed Checks:
   • Not a honeypot - sell transactions succeed
   • No hidden mint function
   • Source code verified on Etherscan
   • No transfer pause mechanism

⚠️ Warnings:
   • Owner can modify taxes (currently 2% buy, 2% sell)
   • Liquidity not locked
   • Contract deployed 3 days ago (new)

❌ Red Flags:
   • Owner holds 15% of supply
   • No renounced ownership

RECOMMENDATION: Proceed with caution. Consider waiting 
for liquidity lock and ownership renouncement.
```

## Advanced Security Analysis

### Full Contract Audit

```
Perform a comprehensive security analysis:
Contract: 0xdead...beef
Chain: Arbitrum

Include:
1. Ownership analysis
2. Token distribution
3. Liquidity analysis
4. Function permissions
5. Similar contract comparison
6. Team/deployer history
```

### Check Deployer History

```
Analyze the wallet that deployed this contract:
Contract: 0x1234...5678
Chain: Ethereum

Has this deployer created other tokens?
Were any of them rugs or scams?
```

### Liquidity Analysis

```
Analyze liquidity for this token:
Contract: 0x1234...5678
Chain: Ethereum

Show:
- All liquidity pools
- LP token holders
- Lock status and unlock dates
- Minimum liquidity depth
```

## Pre-Investment Checklist

Use this prompt before buying any new token:

```
Pre-investment security checklist for:
Token: 0x1234...5678
Chain: [CHAIN]

1. CONTRACT VERIFICATION
   - Is source code verified?
   - Any proxy patterns?
   - Compiler version and optimization

2. OWNERSHIP
   - Who owns the contract?
   - What can the owner do?
   - Is ownership renounced?

3. TOKENOMICS
   - Total and circulating supply
   - Top holder distribution
   - Team/dev wallet holdings

4. LIQUIDITY
   - Pool size and depth
   - Is LP locked? Until when?
   - Any large LP holder risks?

5. TRADING
   - Buy/sell tax rates
   - Can taxes be modified?
   - Any transfer restrictions?

6. HISTORY
   - Contract age
   - Deployer reputation
   - Any past incidents

Give me a BUY / CAUTION / AVOID rating with reasoning.
```

## Specific Risk Detection

### Honeypot Check

```
Is this token a honeypot?
Contract: 0x1234...5678
Chain: BSC

Simulate a buy and sell transaction.
Report any failures or unusual behavior.
```

### Tax Analysis

```
What are the actual trading taxes for:
Contract: 0x1234...5678
Chain: Ethereum

Compare:
- Claimed taxes (from website/docs)
- Actual on-chain taxes
- Hidden fees or mechanisms
```

### Whale Alert

```
Show the top 20 holders of:
Token: 0x1234...5678
Chain: Ethereum

Flag any concerning patterns:
- Single wallet > 5% (excluding LP/burn)
- Connected wallets
- Recent large accumulation
```

## Contract Comparison

### Similar Contract Analysis

```
Find contracts with similar bytecode to:
Contract: 0x1234...5678
Chain: Ethereum

Were any of these:
- Rug pulls
- Honeypots  
- Successful projects

Show safety statistics.
```

### Known Scam Pattern Detection

```
Does this contract match any known scam patterns?
Contract: 0x1234...5678
Chain: BSC

Check against:
- Known honeypot templates
- Rug pull patterns
- Pump and dump structures
```

## Monitoring Existing Holdings

### Portfolio Security Scan

```
Scan all tokens in my wallet for security risks:
Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345
Chains: Ethereum, Arbitrum, Base

Flag any tokens that:
- Have changed ownership recently
- Modified their taxes
- Show declining liquidity
- Have unlocking LP events coming
```

### Contract Upgrade Monitoring

```
Check if any tokens I hold have upgradeable contracts:
Address: 0x742d35...

For each upgradeable contract, show:
- Proxy type
- Admin address
- Recent upgrades
- Pending timelock actions
```

## Security Tools Reference

| Tool | Purpose |
|------|---------|
| `security_scanToken` | Full token security scan |
| `security_checkHoneypot` | Honeypot detection |
| `security_analyzeContract` | Contract code analysis |
| `security_getLiquidity` | Liquidity pool analysis |
| `evm_getContractSource` | Get verified source code |
| `evm_getTokenHolders` | Top holder distribution |

## Red Flags Cheat Sheet

### 🚨 Immediate Red Flags (AVOID)
- Unverified contract source
- Owner can mint unlimited tokens
- 100% tax possible
- No liquidity lock
- Deployer has rug history

### ⚠️ Warning Signs (CAUTION)
- High owner token holdings (>10%)
- Recently deployed (<7 days)
- Modifiable taxes
- Single LP provider
- No social media presence

### ✅ Positive Signs
- Verified and audited
- Ownership renounced
- Liquidity locked 6+ months
- Distributed holder base
- Active development

## Best Practices

1. **Always scan before buying** - Takes 30 seconds, saves thousands
2. **Check liquidity locks** - Unlocked LP = rug risk
3. **Verify on multiple sources** - Don't trust one scanner
4. **Monitor your holdings** - Things can change post-purchase
5. **Trust your gut** - If something feels off, skip it

## Next Steps

- [DeFi Analytics](defi-analytics.md) - Analyze protocols safely
- [Portfolio Tracker](cross-chain-portfolio.md) - Monitor your holdings
- [Full API Reference](../mcp-server/tools-complete.md)

---

Built by [Nich](https://x.com/nichxbt) • [GitHub](https://github.com/nirholas/universal-crypto-mcp)

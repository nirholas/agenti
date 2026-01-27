# x402 Quickstart Guide

> **Get your AI agent paying for APIs in 5 minutes!**

---

## Step 1: Install (30 seconds)

### For Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "X402_PRIVATE_KEY": "0xYourPrivateKeyHere"
      }
    }
  }
}
```

**Config file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

### For Cursor

Add to your MCP settings (same JSON format as above).

### For ChatGPT Developer Mode

```bash
npx @nirholas/universal-crypto-mcp --http
```

Then add `http://localhost:3001/mcp` as a custom app.

---

## Step 2: Configure Wallet (1 minute)

### Option A: Use Existing Wallet

Export your private key from MetaMask or another wallet:

```bash
export X402_PRIVATE_KEY=0x...
```

⚠️ **Security**: Use a dedicated wallet for AI payments, not your main wallet!

### Option B: Create New Wallet

```bash
# Generate a new wallet (save this output!)
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

### Environment Variables

```bash
# Required
export X402_PRIVATE_KEY=0x...

# Optional (with defaults)
export X402_CHAIN=arbitrum           # Default chain
export X402_MAX_PAYMENT=1.00         # Max per request in USD
export X402_ENABLE_GASLESS=true      # Use gasless payments
export X402_DEBUG=false              # Debug logging
```

---

## Step 3: Fund Your Wallet (2 minutes)

### Get Your Wallet Address

Ask Claude: *"What's my x402 wallet address?"*

Or use the tool: `x402_address`

### Send Funds

Your agent needs:

1. **USDC or USDs** - For payments (recommended: $20-100 to start)
2. **Native token** - For gas (ETH on Arbitrum, ~$1-5 worth)

**Where to get USDC:**
- Centralized exchanges (Coinbase, Binance)
- Swap on [Uniswap](https://app.uniswap.org)
- Bridge from another chain

**Recommended: USDs (Sperax USD)**
- Earns ~5% APY automatically
- Get it on [SperaxDApp](https://app.sperax.io)

---

## Step 4: Make Your First Paid Request (30 seconds)

### Option A: Ask Claude

```
"Get the premium weather data for Tokyo from the paid weather API"
```

Claude will automatically:
1. Detect the 402 payment requirement
2. Show you the cost
3. Make the payment
4. Return the data

### Option B: Use the Tool Directly

```json
{
  "tool": "x402_pay_request",
  "arguments": {
    "url": "https://api.example.com/weather?city=tokyo",
    "method": "GET",
    "maxPayment": "0.10"
  }
}
```

---

## Step 5: Check Your Balance

```
"Check my x402 wallet balance"
```

Response:
```json
{
  "address": "0x1234...5678",
  "chain": "arbitrum",
  "balances": {
    "usds": "45.23",
    "native": "0.001"
  },
  "yieldInfo": {
    "pending": "0.05",
    "apy": "5.2%"
  }
}
```

---

## Quick Reference

### Essential Commands for Claude

| Say This | Does This |
|----------|-----------|
| "Check my x402 balance" | Shows wallet balance |
| "What's my wallet address?" | Shows address for funding |
| "Get [data] from [paid API]" | Auto-pays and fetches |
| "Send $5 to 0x..." | Direct payment |
| "How much yield have I earned?" | USDs yield info |

### MCP Tools

| Tool | Purpose |
|------|---------|
| `x402_pay_request` | Make paid HTTP requests |
| `x402_balance` | Check balance |
| `x402_send` | Send payments |
| `x402_address` | Get wallet address |
| `x402_estimate` | Check costs before paying |

---

## Troubleshooting

### "X402_PRIVATE_KEY not configured"

**Problem**: Wallet not set up.

**Solution**: Add your private key to the environment:
```json
{
  "env": {
    "X402_PRIVATE_KEY": "0x..."
  }
}
```

### "Insufficient funds"

**Problem**: Wallet is empty or low balance.

**Solution**: 
1. Get your address: `x402_address`
2. Send USDC + gas tokens to that address

### "Amount exceeds maximum allowed"

**Problem**: Payment is larger than your configured max.

**Solution**: Either:
- Increase `X402_MAX_PAYMENT` in config
- Use a smaller `maxPayment` in the request

### "Transaction failed"

**Problem**: Gas issues or network problems.

**Solutions**:
- Ensure you have native tokens for gas
- Try a different network (Base often cheapest)
- Wait and retry (network congestion)

### "Cannot connect to facilitator"

**Problem**: Network issues reaching x402.org.

**Solution**: 
- Check your internet connection
- The facilitator might be temporarily down
- Try again in a few minutes

---

## Next Steps

- 📖 [Full Tools Reference](MCP_TOOLS.md) - Learn all 14 tools
- 🏗️ [Architecture Guide](ARCHITECTURE.md) - Understand the protocol
- 💡 [Examples](EXAMPLES.md) - Real-world use cases
- 🔒 [Security Guide](SECURITY.md) - Best practices

---

## Need Help?

- **GitHub Issues**: https://github.com/nirholas/universal-crypto-mcp/issues
- **Discord**: https://discord.gg/cdp
- **x402 Docs**: https://docs.x402.org

---

<p align="center">
  <b>💰 Give Claude Money!</b><br>
  <code>npx @nirholas/universal-crypto-mcp</code>
</p>

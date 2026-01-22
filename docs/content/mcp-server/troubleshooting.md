# Troubleshooting

Common issues and solutions when using Universal Crypto MCP.

---

## 🔴 Connection Issues

### MCP Server Not Starting

**Symptom:** Server doesn't start, no response from Claude/ChatGPT

**Solutions:**

1. **Check Node.js version**
   ```bash
   node --version  # Must be >= 18.0.0
   ```

2. **Reinstall dependencies**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check for port conflicts** (HTTP/SSE mode)
   ```bash
   lsof -i :3001  # Check if port is in use
   ```

4. **Verify config path** (Claude Desktop)
   ```bash
   # macOS
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # Windows
   type %APPDATA%\Claude\claude_desktop_config.json
   
   # Linux
   cat ~/.config/Claude/claude_desktop_config.json
   ```

---

### "Tool not found" Error

**Symptom:** Claude says it can't find a tool

**Solutions:**

1. **Restart Claude Desktop** after config changes
2. **Check tool name spelling** - use exact names from docs
3. **Verify server is running**:
   ```bash
   # Test with MCP Inspector
   npx @modelcontextprotocol/inspector npx @nirholas/universal-crypto-mcp
   ```

---

### ChatGPT Not Connecting (HTTP Mode)

**Symptom:** ChatGPT can't reach the MCP server

**Solutions:**

1. **Ensure server is running**:
   ```bash
   npx @nirholas/universal-crypto-mcp --http
   # Should see: "HTTP server listening on port 3001"
   ```

2. **Check firewall settings** - allow port 3001

3. **Verify URL in ChatGPT**:
   - Correct: `http://localhost:3001/mcp`
   - Wrong: `http://localhost:3001` (missing `/mcp`)

4. **Try with explicit host**:
   ```bash
   HOST=0.0.0.0 npx @nirholas/universal-crypto-mcp --http
   ```

---

## 🟡 Transaction Errors

### "Insufficient Funds"

**Symptom:** Transaction fails with insufficient balance

**Solutions:**

1. **Check native token balance** for gas:
   ```
   What's my ETH balance on Arbitrum?
   ```

2. **Check token balance**:
   ```
   What's my USDC balance on Arbitrum?
   ```

3. **Reduce amount** to leave room for gas

---

### "Transaction Reverted"

**Symptom:** Transaction submitted but reverted on-chain

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Slippage too low | Increase slippage to 1-3% |
| Token has transfer tax | Account for tax in amount |
| Approval not set | Approve token first |
| Contract paused | Check if protocol is active |
| Price moved | Get fresh quote and retry |

**Debug Steps:**

1. **Simulate first**:
   ```
   Simulate swapping 100 USDC for ETH on Arbitrum
   ```

2. **Check token security**:
   ```
   Is this token safe? 0x...
   ```

---

### "Nonce Too Low"

**Symptom:** Transaction rejected with nonce error

**Solutions:**

1. **Wait for pending transactions** to confirm
2. **Cancel pending transaction**:
   ```
   Cancel my pending transaction on Ethereum
   ```
3. **Speed up transaction**:
   ```
   Speed up my pending transaction with 20% more gas
   ```

---

### "Gas Estimation Failed"

**Symptom:** Can't estimate gas for transaction

**Solutions:**

1. **Check if contract allows the operation**
2. **Verify you have required approvals**
3. **Try with explicit gas limit**:
   ```json
   {
     "gasLimit": "500000"
   }
   ```

---

## 🟠 API & Data Issues

### "API Key Required"

**Symptom:** Tool returns API key error

**Solutions:**

| API | How to Get Key |
|-----|----------------|
| CoinGecko | [coingecko.com/api](https://www.coingecko.com/en/api) |
| LunarCrush | [lunarcrush.com/developers](https://lunarcrush.com/developers) |
| CryptoPanic | [cryptopanic.com/developers](https://cryptopanic.com/developers/api/) |

Set in environment:
```bash
export COINGECKO_API_KEY=your_key_here
```

Or in Claude config:
```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "env": {
        "COINGECKO_API_KEY": "your_key_here"
      }
    }
  }
}
```

---

### "Rate Limited"

**Symptom:** API returns 429 error

**Solutions:**

1. **Wait and retry** - usually 1 minute
2. **Use API key** for higher limits
3. **Reduce request frequency**
4. **Use cached data** when possible

---

### Stale/Wrong Price Data

**Symptom:** Prices seem outdated or incorrect

**Solutions:**

1. **Specify the source**:
   ```
   Get Bitcoin price from CoinGecko
   ```

2. **Check multiple sources**:
   ```
   Compare ETH price across exchanges
   ```

3. **Use on-chain price**:
   ```
   Get ETH/USDC price from Uniswap on Ethereum
   ```

---

## 🔵 Security Issues

### "Honeypot Detected"

**Symptom:** Token flagged as honeypot

**What It Means:**
- Token cannot be sold after buying
- Common scam tactic

**Action:** 
- ❌ **DO NOT BUY** this token
- Report to community

---

### "High Risk Score"

**Symptom:** Token has risk score > 7/10

**Check These Factors:**

| Factor | Why It's Risky |
|--------|---------------|
| Ownership not renounced | Owner can rug |
| Hidden mint function | Unlimited supply |
| Blacklist function | Can block your wallet |
| High holder concentration | Whale dump risk |
| Liquidity not locked | Can pull liquidity |

**Action:**
- Proceed with extreme caution
- Never invest more than you can lose

---

### Approval Concerns

**Symptom:** Worried about token approvals

**Check Your Approvals:**
```
Show all my token approvals on Ethereum
```

**Revoke Suspicious Approvals:**
```
Revoke approval for 0xSuspiciousContract on my USDC
```

---

## 🟣 Environment Issues

### Private Key Not Working

**Symptom:** Transactions fail with signing errors

**Checklist:**

1. **Format check** - Must start with `0x`:
   ```bash
   # Correct
   PRIVATE_KEY=0x123abc...
   
   # Wrong
   PRIVATE_KEY=123abc...
   ```

2. **No quotes in .env**:
   ```bash
   # Correct
   PRIVATE_KEY=0x123abc...
   
   # Wrong
   PRIVATE_KEY="0x123abc..."
   ```

3. **Correct length** - 64 hex characters after `0x`

4. **Test with read-only first**:
   ```
   What's the balance of my wallet?
   ```

---

### Wrong Network

**Symptom:** Operations happening on wrong chain

**Solutions:**

1. **Always specify network**:
   ```
   Swap 1 ETH for USDC on Arbitrum  # Good
   Swap 1 ETH for USDC              # Ambiguous
   ```

2. **Check supported networks**:
   ```
   List all supported networks
   ```

---

## 🔧 Debug Mode

### Enable Verbose Logging

```bash
LOG_LEVEL=DEBUG npx @nirholas/universal-crypto-mcp
```

### Use MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx @nirholas/universal-crypto-mcp
```

This opens a web UI where you can:
- See all available tools
- Test tools manually
- View request/response logs

---

## 📞 Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Search [existing issues](https://github.com/nirholas/universal-crypto-mcp/issues)
3. ✅ Try with latest version:
   ```bash
   npx @nirholas/universal-crypto-mcp@latest
   ```

### How to Report a Bug

Include:

1. **Environment**:
   - Node.js version
   - OS (macOS/Windows/Linux)
   - Client (Claude/ChatGPT/Cursor)

2. **Steps to reproduce**

3. **Expected vs actual behavior**

4. **Error messages** (full text)

5. **Relevant logs** (with `LOG_LEVEL=DEBUG`)

[Open an Issue →](https://github.com/nirholas/universal-crypto-mcp/issues/new?template=bug_report.yml)

---

## 💡 Pro Tips

### Speed Up Transactions

```
Submit this swap privately via Flashbots on Ethereum
```

### Avoid MEV

```
Execute swap with MEV protection enabled
```

### Batch Operations

```
Get balances for ETH, USDC, and WBTC on Arbitrum in one call
```

### Test Before Mainnet

```
Swap 0.01 ETH for USDC on Arbitrum Sepolia testnet
```

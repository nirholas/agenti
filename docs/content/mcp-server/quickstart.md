# Quick Start

Get up and running in under 2 minutes.

---

## ⚡ 30-Second Setup

### For Claude Desktop

1. Open Claude Desktop settings → Developer → Edit Config

2. Paste this:
```json
{
  "mcpServers": {
    "crypto": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"]
    }
  }
}
```

3. Restart Claude Desktop

4. Try it:
> "What's the price of Bitcoin?"

**That's it!** 🎉

---

## 🔧 Optional: Add Write Capabilities

To execute transactions (swaps, transfers, etc.), add your private key:

```json
{
  "mcpServers": {
    "crypto": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "0xYourPrivateKeyHere"
      }
    }
  }
}
```

⚠️ **Security Warning**: Use a dedicated wallet with small amounts for testing!

---

## 🌐 For ChatGPT

1. Start the server:
```bash
npx @nirholas/universal-crypto-mcp@latest --http
```

2. In ChatGPT → Settings → Apps → Create app

3. Enter: `http://localhost:3001/mcp`

4. Select the app in Developer mode menu

---

## 🎯 Try These First

### Read Operations (No Private Key Needed)

| Try This | What It Does |
|----------|--------------|
| "What's the price of ETH?" | Get current price |
| "Show trending coins" | See what's hot |
| "Is 0x... a safe token?" | Security check |
| "What's the gas price on Arbitrum?" | Check gas costs |
| "Get Aave TVL" | DeFi analytics |

### Write Operations (Needs Private Key)

| Try This | What It Does |
|----------|--------------|
| "Swap 0.01 ETH for USDC on Base" | Execute a swap |
| "Send 10 USDC to 0x..." | Transfer tokens |
| "Approve USDC for Uniswap" | Set approval |

---

## 📚 Next Steps

- [Full Examples →](examples.md)
- [All Tools Reference →](tools.md)
- [Troubleshooting →](troubleshooting.md)
- [Architecture →](architecture.md)

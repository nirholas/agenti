# Awesome OpenRouter PR - Multi-App Submission

This folder contains app.yaml files for all nirholas public repos that qualify for awesome-openrouter.

## OpenRouter Requirements

To qualify, apps must:
1. ✅ Use OpenRouter for AI model access
2. ✅ Allow BYOK (Bring Your Own Key)  
3. ✅ Be publicly accessible
4. ✅ Have a logo.png (128x128 or 256x256)

---

## 📋 Qualifying Repos (20 apps)

| # | Repo | Stars | Tags | Status |
|---|------|-------|------|--------|
| 1 | **agenti** | 20 | coding, productivity | ✅ Ready |
| 2 | **XActions** | 58 | productivity | ✅ Ready |
| 3 | **free-crypto-news** | 20 | research, productivity | ✅ Ready |
| 4 | **universal-crypto-mcp** | 10 | coding, productivity | ✅ Ready |
| 5 | **UCAI** | 13 | coding | ✅ Ready |
| 6 | **defi-agents** | 10 | coding | ✅ Ready |
| 7 | **lyra-registry** | 9 | coding, research | ✅ Ready |
| 8 | **mcp-notify** | 9 | productivity | ✅ Ready |
| 9 | **lyra-intel** | 9 | coding, research | ✅ Ready |
| 10 | **AI-Agents-Library** | 9 | coding | ✅ Ready |
| 11 | **plugin.delivery** | 9 | coding | ✅ Ready |
| 12 | **sperax-crypto-mcp** | 8 | coding | ✅ Ready |
| 13 | **lyra-tool-discovery** | 6 | coding, research | ✅ Ready |
| 14 | **github-to-mcp** | 5 | coding | ✅ Ready |
| 15 | **lyra-web3-playground** | 5 | coding, creative | ✅ Ready |
| 16 | **crypto-data-aggregator** | 4 | research | ✅ Ready |
| 17 | **Binance-MCP** | 4 | coding, productivity | ✅ Ready |
| 18 | **Binance-US-MCP** | 4 | coding | ✅ Ready |
| 19 | **extract-llms-docs** | 4 | coding, research | ✅ Ready |
| 20 | **bnbchain-mcp** | 3 | coding | ✅ Ready |

---

## ⚠️ LOGO REQUIREMENTS

**Every submission needs a `logo.png`** (128x128 or 256x256 PNG)

You need to create 20 logos before submitting!

---

## 🚀 Submission Commands

```bash
# Fork the repo
gh repo fork OpenRouterTeam/awesome-openrouter --clone
cd awesome-openrouter

# Create all app folders
for app in agenti xactions free-crypto-news universal-crypto-mcp ucai defi-agents lyra-registry mcp-notify lyra-intel ai-agents-library plugin-delivery sperax-crypto-mcp lyra-tool-discovery github-to-mcp lyra-web3-playground crypto-data-aggregator binance-mcp binance-us-mcp extract-llms-docs bnbchain-mcp; do
  mkdir -p "apps/$app"
done

# Copy all app.yaml files from this folder
# Add logo.png to each folder

# Validate
npm install
npm run validate

# Submit PR
git add apps/
git commit -m "Add nirholas MCP ecosystem (20 apps)"
gh pr create
```

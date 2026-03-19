# 🖥️ Setup Instructions

## This Book

This book is available at the following url:

```
https://smartcontractkit.github.io/x402-cre-price-alerts/
```


## Important Prerequisites

To get the most out of this session, we recommend you have the following prepared **before the masterclass**. Some of this will be covered briefly and fast so we can spend time on the LinkLab's code.

### Required Setup

- **Node.js v18 or higher** - [Download here](https://nodejs.org/)
- **BunJs v1.3 or higher** - [Download here](https://bun.com/docs/installation)
- **Install CRE CLI** - [Installation instructions](https://docs.chain.link/cre/getting-started/cli-installation)
- **Add Base Sepolia to your wallet** - [Add network here](https://chainlist.org/chain/84532)
 - **Get ETH from the Coinbase Faucet** - [Coinbase Faucet](https://portal.cdp.coinbase.com/products/faucet) (make sure it's for Base Sepolia!)
- **Get USDC from the Circle Faucet** - [Circle Faucet](https://faucet.circle.com/) (make sure it's for Base Sepolia!)
- **Gemini LLM API key** - [Get from Google AI Studio](https://aistudio.google.com/app/apikey)
- **Sign up to Pushover** - [Get User Key and Application Key](https://pushover.net/)
  - If you want to see your workflow work live, install the small devtool mobile app too!

### Nice to Have

- 📚 **Install mdBook** - So you can read the accompanying LinkLab docs easily
  ```bash
  cargo install mdbook
  ```

## Repository

Once you have the prerequisites ready, clone the repository:

```bash
git clone https://github.com/smartcontractkit/x402-cre-price-alerts.git
cd x402-cre-price-alerts
npm install
```

Note that the project uses NPM workspaces, so you must use NPM to install packages.


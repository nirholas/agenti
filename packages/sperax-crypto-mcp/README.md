<h1 align="center">Sperax Ecosystem Crypto & DeFI MCP Server</h1>

<p align="center">
  <strong>Model Context Protocol Server for Sperax DeFi Ecosystem</strong>
</p>

<p align="center">
  <a href="https://arbitrum.io"><img src="https://img.shields.io/badge/network-Arbitrum%20One-blue?style=flat-square" alt="Arbitrum"/></a>
  <a href="https://www.bnbchain.org"><img src="https://img.shields.io/badge/network-BNB%20Chain-yellow?style=flat-square" alt="BNB Chain"/></a>
  <a href="https://ethereum.org"><img src="https://img.shields.io/badge/network-Ethereum-purple?style=flat-square" alt="Ethereum"/></a>
</p>

<p align="center">
  Enable AI agents to interact with USDs (auto-yield stablecoin), SPA governance, veSPA staking, and Demeter yield farms, and Plutus on BNB Chain and Arbitrum.
</p>

## 🔧 Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup

```bash
# Clone repository
git clone https://github.com/nirholas/sperax-crypto-mcp
cd sperax-crypto-mcp

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run in development mode (with auto-rebuild)
pnpm dev
```

### Running

```bash
# Start stdio server (for Claude Desktop)
pnpm start

# Start HTTP server (for integrations)
pnpm start:http

# Run with BNB Chain RPC
CUSTOM_RPC_URL="https://..." pnpm start

# Run with Arbitrum RPC
ARBITRUM_RPC_URL="https://..." pnpm start
```

### Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Test with MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js
```

### Linting & Type Checking

```bash
# Lint code
pnpm lint

# Type check
pnpm typecheck
```
---

## 🤝 Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sperax": {
      "command": "npx",
      "args": ["-y", "@sperax/mcp-server"]
    }
  }
}
```

**Config file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

### Cursor / VS Code

Add to your MCP settings:

```json
{
  "mcp.servers": {
    "sperax": {
      "command": "npx",
      "args": ["-y", "@sperax/mcp-server"]
    }
  }
}
```

### With Custom RPC Endpoint

For better performance and reliability, use your own Arbitrum RPC:

```json
{
  "mcpServers": {
    "sperax": {
      "command": "npx",
      "args": ["-y", "@sperax/mcp-server"],
      "env": {
        "ARBITRUM_RPC_URL": "https://your-rpc-endpoint.com"
      }
    }
  }
}
```

### HTTP Server Mode

For advanced integrations, run as an HTTP server:

```bash
# Start HTTP server on port 3000
pnpm start:http

# Or with custom port
PORT=8080 pnpm start:http
```
<details>
  <summary>  Sperax MCP Server Repository </summary>
  
For best compatability, use within SperaxOS. The servers provided in this repo largely are based upon the already built and tested products on [app.sperax.io](https://app.sperax.io). The Sperax Crypto and Defi MCP Server project is an additional product of Sperax and SperaxOS, created for the open source community. For the millions of developers that may not have had the tools available to use cryptocurrency, blockchain, defi, and web3 tools within their usual workspace, we are thrilled to be laying the groundworks for the use of blockchain and cryptocurrency use paired with the Model Context Protocol. 
Sperax is building an autonomous financial infrastructure, centered around its auto-yield stablecoin USDs and its utility/governance token SPA, using AI-driven agents to automate yield generation and financial management across blockchains like Arbitrum and BNB Chain. It combines collateralized stability with algorithmic mechanisms, aiming to offer passive income for users through its integrated system, which includes the SperaxOS AI infrastructure. SperaxOS is the world's first AI-native operating system for decentralized finance, transforming how enterprises, developers, and DeFi protocols manage on-chain capital. SperaxOS replaces manual DeFi workflows with autonomous, intelligent automation. While traditional AI agents generate content or answer questions, SperaxOS agents execute capital, automatically optimizing yields, rebalancing portfolios, defending against risks, and managing treasury operations 24/7 with zero human intervention. This repo will initially focus on Sperax ecosystem products such as USDs and SPA. For organizational purposes, SperaxOS documents and tools are seperated in their respective repositories.
</details>

## 🛠️ Available Tools

### USDs Stablecoin (7 tools)

| Tool | Description |
|------|-------------|
| `usds_get_info` | Get USDs overview including supply, APR, and last rebase time |
| `usds_get_balance` | Get USDs balance and rebase state for any address |
| `usds_get_rebase_state` | Check if an address receives yield rebases |
| `usds_get_mint_params` | Get current mint fees and parameters |
| `usds_get_yield_info` | Get current yield metrics, APR, and distribution |
| `usds_get_collateral_ratio` | Get protocol collateralization ratio |
| `usds_estimate_mint` | Simulate minting USDs with specific collateral |

### Vault & Collateral (10 tools)

| Tool | Description |
|------|-------------|
| `vault_get_status` | Get Vault TVL, health status, utilization, and fees |
| `vault_get_collaterals` | List all supported collaterals with current allocations |
| `vault_get_collateral_details` | Get detailed info for specific collateral (USDC, USDT, DAI, FRAX) |
| `vault_get_strategies` | List all active yield strategies and their performance |
| `vault_get_strategy_details` | Get specific strategy allocation and APY |
| `vault_get_oracle_prices` | Get all collateral oracle prices from Chainlink |
| `vault_get_peg_status` | Check USDs peg health and deviation from $1 |
| `vault_simulate_mint` | Simulate mint with fees and expected output |
| `vault_simulate_redeem` | Simulate redemption with fees and slippage |
| `vault_get_allocation_targets` | Get target vs actual collateral allocations |

### SPA & Staking (8 tools)

| Tool | Description |
|------|-------------|
| `spa_get_info` | Get SPA token overview including supply and staking stats |
| `spa_get_balance` | Get SPA, veSPA, and xSPA balances for address |
| `vespa_get_position` | Get veSPA lock position details and voting power |
| `vespa_calculate_power` | Calculate voting power for specific lock amount/duration |
| `vespa_get_stats` | Get global veSPA statistics (total locked, holders) |
| `xspa_get_position` | Get xSPA vesting position and pending redemptions |
| `xspa_calculate_redemption` | Calculate SPA output for xSPA redemption |
| `buyback_get_stats` | Get SPA buyback & burn statistics |

### Demeter Farms (7 tools)

| Tool | Description |
|------|-------------|
| `demeter_list_farms` | List all active farms with APR, TVL, and filters |
| `demeter_get_farm_details` | Get specific farm detailed info and mechanics |
| `demeter_get_user_position` | Get user's positions across all Demeter farms |
| `demeter_calculate_rewards` | Calculate pending rewards for user in farm |
| `demeter_estimate_apr` | Estimate APR for specific deposit amount |
| `demeter_get_top_farms` | Get highest APR farms with optional filters |
| `demeter_get_farm_types` | Get supported farm types (UniV3, Camelot, Balancer) |

### Dripper (5 tools)

| Tool | Description |
|------|-------------|
| `dripper_get_status` | Get Dripper operational status and health |
| `dripper_get_balance` | Get pending yield balance waiting to be distributed |
| `dripper_get_config` | Get drip period and distribution configuration |
| `dripper_estimate_next_rebase` | Estimate next rebase time and expected amount |
| `dripper_calculate_earnings` | Calculate projected earnings for USDs holdings |

### Oracle (5 tools)

| Tool | Description |
|------|-------------|
| `oracle_get_all_prices` | Get all collateral prices from Chainlink oracles |
| `oracle_get_price` | Get specific asset price with timestamp |
| `oracle_check_staleness` | Check if oracle data is fresh (within heartbeat) |
| `oracle_check_deviation` | Check price deviation from $1 peg |
| `oracle_get_sources` | Get oracle source information and configuration |

### Analytics (6 tools)

| Tool | Description |
|------|-------------|
| `analytics_get_tvl` | Get Total Value Locked breakdown by component |
| `analytics_get_revenue` | Get protocol revenue metrics and trends |
| `analytics_get_apy_history` | Get historical APY data (7d, 30d, 90d, 1y) |
| `analytics_get_user_stats` | Get comprehensive user statistics |
| `analytics_compare_yields` | Compare USDs yields with competitors (Aave, Compound) |
| `analytics_get_protocol_health` | Get overall protocol health score and indicators |

### Governance (5 tools)

| Tool | Description |
|------|-------------|
| `governance_get_overview` | Get governance overview and current state |
| `governance_get_proposals` | List recent/active governance proposals |
| `governance_get_proposal_details` | Get specific proposal details and voting status |
| `governance_get_voting_power` | Get voting power for address (veSPA-based) |
| `governance_get_delegates` | Get delegation information for address |

### Yield Reserve (4 tools)

| Tool | Description |
|------|-------------|
| `yield_reserve_get_status` | Get yield reserve status and balance |
| `yield_reserve_get_balance` | Get available yield for distribution |
| `yield_reserve_get_config` | Get reserve configuration parameters |
| `yield_reserve_get_history` | Get historical yield collection data |

---

## 📚 Available Resources

| Resource URI | Description |
|--------------|-------------|
| `sperax://docs/overview` | Complete protocol overview and architecture |
| `sperax://docs/usds` | USDs stablecoin documentation and mechanics |
| `sperax://docs/staking` | veSPA/xSPA staking guide with formulas |
| `sperax://docs/demeter` | Demeter yield farming guide |
| `sperax://docs/vault` | Vault and collateral management documentation |
| `sperax://docs/oracles` | Oracle system documentation and addresses |
| `sperax://docs/governance` | DAO governance guide and voting |
| `sperax://docs/security` | Security audits and bug bounty program |
| `sperax://docs/formulas` | Key protocol formulas and calculations |
| `sperax://docs/api` | Complete API reference for all tools |
| `sperax://contracts/addresses` | All deployed contract addresses on Arbitrum |

---
## 💡 Example Conversations

### Check USDs Yield

> **User:** "What's the current USDs APY and how much would I earn on $10,000?"
>
> **Agent:** *Uses `usds_get_yield_info` and calculates projections*

### Find Best Farms

> **User:** "Show me Demeter farms with over 20% APR"
>
> **Agent:** *Uses `demeter_get_top_farms` with minApr filter*

### Calculate veSPA Power

> **User:** "How much voting power would I get locking 1000 SPA for 2 years?"
>
> **Agent:** *Uses `vespa_calculate_power` with amount=1000, days=730*

### Protocol Health Check

> **User:** "Give me an overview of the Sperax protocol health"
>
> **Agent:** *Uses multiple tools to compile health dashboard*

### Portfolio Analysis

> **User:** "Check my USDs balance at 0x..."
>
> **Agent:** *Uses `usds_get_balance` and `usds_get_yield_info`*

---

## 💬 Example Prompts

| Prompt | Description |
|--------|-------------|
| `what_is_usds` | Learn about USDs auto-yield stablecoin |
| `how_to_mint` | Step-by-step guide for minting USDs |
| `how_to_redeem` | Guide for redeeming USDs to stablecoins |
| `my_usds_balance` | Check USDs balance and yield info |
| `my_yield_earnings` | Calculate potential yield earnings |
| `stake_spa` | Guide for staking SPA to get veSPA |
| `my_staking_position` | Check veSPA staking position |
| `best_yield_farms` | Find the best Demeter yield farms |
| `my_farm_rewards` | Check pending farm rewards |
| `protocol_health` | Get overall protocol health report |
| `spa_tokenomics` | Explain SPA token economics |
| `compare_yields` | Compare USDs yield to other options |
| `rebase_calculator` | Calculate potential rebase earnings |
| `vespa_calculator` | Calculate veSPA voting power |

---

## 📖 How USDs Works

### The Auto-Yield Mechanism

USDs is unique among stablecoins because it generates yield **automatically**:

1. **Deposit Collateral** → User deposits USDC, USDT, DAI, or FRAX
2. **Mint USDs** → Protocol mints USDs 1:1 (minus small fee)
3. **Deploy to Strategies** → Collateral deployed to Aave, Compound, Stargate, Fluid
4. **Generate Yield** → Strategies earn yield from lending/liquidity
5. **Collect & Distribute** → Protocol collects yield daily
6. **Auto-Rebase** → Your USDs balance increases automatically!

### Yield Distribution

| Recipient | Share | Purpose |
|-----------|-------|---------|
| USDs Holders | 70% | Distributed via auto-rebase |
| SPA Buyback | 30% | Buy and burn SPA tokens |

### Why It's Special

- ✅ **No claiming** — Yield appears in your wallet automatically
- ✅ **No staking** — Just hold USDs in any wallet
- ✅ **Composable** — Use USDs in DeFi while earning yield
- ✅ **Fully backed** — 100%+ collateralized by stablecoins
- ✅ **Transparent** — All operations visible on-chain


## 🏗️ Protocol Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SPERAX PROTOCOL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   USDs      │◄───│   Vault     │───►│  Strategies │          │
│  │ Stablecoin  │    │  (TVL Hub)  │    │ Aave/Comp/  │          │
│  │  ~5% APY    │    │             │    │  Stargate   │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         ▲                  │                   │                │
│         │                  ▼                   ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Dripper   │◄───│Yield Reserve│◄───│   Oracles   │          │
│  │ (Daily Drip)│    │ (70%/30%)   │    │ (Chainlink) │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌─────────────┐    ┌─────────────┐                             │
│  │   Rebase    │    │ SPA Buyback │                             │
│  │  (70% →     │    │   (30% →    │                             │
│  │   Holders)  │    │    Burn)    │                             │
│  └─────────────┘    └─────────────┘                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      GOVERNANCE LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │    SPA      │───►│   veSPA     │───►│  Governance │          │
│  │   Token     │    │   (Locked)  │    │  (Snapshot) │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐    ┌─────────────┐                             │
│  │   xSPA      │───►│   Demeter   │                             │
│  │  (Rewards)  │    │   (Farms)   │                             │
│  └─────────────┘    └─────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📐 Key Protocol Formulas

### veSPA Voting Power

```
veSPA = SPA × (lockDays / 365)
```

| Lock Duration | 1000 SPA → veSPA |
|---------------|------------------|
| 7 days | 19.2 veSPA |
| 1 year | 1,000 veSPA |
| 2 years | 2,000 veSPA |
| 4 years | 4,000 veSPA |

> ⚠️ **Note:** Voting power decays linearly as unlock time approaches. No early unlock!

### xSPA Redemption

```
SPA_out = xSPA × (vestingDays + 150) / 330
```

| Vesting Period | SPA Received |
|----------------|--------------|
| 15 days (min) | 50% |
| 30 days | 54.5% |
| 90 days | 72.7% |
| 180 days (max) | 100% |

### USDs Rebase (Auto-Yield)

USDs uses a credit system for automatic yield distribution:

```
balance = credits / creditsPerToken
```

When yield is distributed:
1. Protocol collects yield from strategies (Aave, Compound, Stargate, Fluid)
2. 70% is distributed to USDs holders via rebase
3. `creditsPerToken` decreases globally
4. Your balance increases automatically!

**No claiming required. Your wallet balance grows daily.**
---

## 🔒 Security

| Feature | Description |
|---------|-------------|
| **Read-Only** | No transaction execution—server only reads blockchain state |
| **No Private Keys** | Server never handles or stores private keys |
| **Rate Limited** | Built-in RPC rate limiting prevents abuse |
| **Validated Inputs** | All inputs validated with Zod schemas |
| **Audited Contracts** | Sperax contracts audited by leading firms |

### Security Considerations

- This server provides **read-only** access to on-chain data
- Transaction signing must happen through user's wallet
- Always verify contract addresses before interacting
- Use official RPC endpoints or trusted providers


## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ARBITRUM_RPC_URL` | Arbitrum One RPC endpoint | `https://arb1.arbitrum.io/rpc` |
| `LOG_LEVEL` | Logging level (`debug`, `info`, `warn`, `error`) | `info` |
| `PORT` | HTTP server port (for HTTP mode) | `3000` |

---

## 🔗 Links

| Resource | Link |
|----------|------|
| 🌐 Website | [sperax.io](https://sperax.io) |
| 📖 Documentation | [docs.sperax.io](https://docs.sperax.io) |
| 🚀 App | [app.sperax.io](https://app.sperax.io) |
| 🐦 Twitter | [@SperaxUSD](https://twitter.com/SperaxUSD) |
| 💬 Discord | [discord.gg/sperax](https://discord.gg/sperax) |
| 📊 DeFiLlama | [defillama.com/protocol/sperax](https://defillama.com/protocol/sperax) |
| 🔍 Arbiscan (USDs) | [arbiscan.io/token/0xD74f...5748](https://arbiscan.io/token/0xD74f5255D557944cf7Dd0E45FF521520002D5748) |
| 🗳️ Governance | [snapshot.org/#/speraxdao.eth](https://snapshot.org/#/speraxdao.eth) |
| 🐙 GitHub | [github.com/sperax](https://github.com/sperax) |

---
## 📋 Contract Addresses (Arbitrum One)

### Core Protocol

| Contract | Address |
|----------|---------|
| USDs Token | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` |
| SPA Token | `0x5575552988A3A80504bBaeB1311674fCFd40aD4B` |
| Vault | `0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca` |
| Collateral Manager | `0xdA6B48BA29fE5F0f32eB52FBA21D26DACA04E5e7` |

### Staking

| Contract | Address |
|----------|---------|
| veSPA | `0x2e2071180682Ce6C247B1eF93d382D509F5F6A17` |
| xSPA | `0x0966E72256d6055145902F72F9D3B6a194B9cCc3` |

### Yield Distribution

| Contract | Address |
|----------|---------|
| SPA Buyback | `0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3` |
| Yield Reserve | `0x0CB89A7A6a9E0d9E06EE0c52De040db0e2B079E6` |
| Dripper | `0xEaA79893D17d4c1b3e76c684e7A89B3D46a6fb03` |
| Rebase Manager | `0xC21b3b55Db3cb0B6CA6F96c18E9534c96E1d4cfc` |

### Oracles

| Contract | Address |
|----------|---------|
| Master Price Oracle | `0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50` |
| Chainlink Oracle | `0xB9e5A70e1B1F3C99Db6Ed28f67d8d7d1248F8b3B` |
| SPA Oracle | `0x5Fb534B4B07a0E417B449E264A8c7A6f9C5C2C69` |
| USDs Oracle | `0x1C27c2a4aD63DE5F44f5a0e7a651e3FC7F3BBBe3` |

### Demeter Protocol

| Contract | Address |
|----------|---------|
| Farm Registry | `0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0` |
| Rewarder Factory | `0x926477bAF60C25857419CC9Bf52E914881E1bDD3` |
| Farm Deployer | `0x0d9EFD8f11c0a09DB8C2CCBfF4cC6c26Ad98b956` |

### Yield Strategies

| Contract | Address |
|----------|---------|
| Aave Strategy | `0x5E8422345238F34275888049021821E8E08CAa1f` |
| Compound Strategy | `0x8c9532a60E0E7C6BbD2B2c1303F63aCE1c3e9811` |
| Stargate Strategy | `0x6cD7bEF920f4C05aF3386A2c0070e1e26CD85c85` |
| Fluid Strategy | `0xE0f51Ec5f35B0D7Ce31b26b8C15b9B9f3fF1f5C5` |

### Supported Collaterals

| Token | Address | Decimals |
|-------|---------|----------|
| USDC (Native) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| USDC.e (Bridged) | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | 6 |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 |
| DAI | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | 18 |
| FRAX | `0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F` | 18 |

---

### 📊 Server Capabilities

| Capability | Count | Description |
|------------|-------|-------------|
| **Tools** | 57 | Comprehensive protocol interaction capabilities across 9 categories |
| **Resources** | 11 | Complete documentation and contract references |
| **Prompts** | 19 | Pre-built conversation starters for common tasks |
---

## ✨ Features

| Category | Description |
|----------|-------------|
| 🪙 **USDs Stablecoin** | Query balances, yields, rebase mechanics, mint/redeem simulations |
| ⚡ **Auto-Yield** | ~5% APY distributed automatically via daily rebase |
| 🗳️ **veSPA Governance** | Vote-escrowed staking with 7-day to 4-year locks |
| 🌾 **Demeter Farms** | Discover and analyze yield farming opportunities |
| 🏛️ **Vault System** | Collateral management and yield strategies |
| 🔮 **Oracle Integration** | Chainlink price feeds and monitoring |
| 📈 **Yield Reserve** | Protocol yield collection and distribution |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ by the Sperax Team</strong>
</p>

<p align="center">
  <sub>Empowering Autonomous Finance on Arbitrum and BNB Chain</sub>
</p>


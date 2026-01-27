# SperaxOS MCP Server

A **Model Context Protocol** server that supports Arbitrum, BSC, opBNB, and other popular EVM-compatible networks.

---

## � Start Here

!!! tip "New to SperaxOS MCP?"
    1. **[Installation](#installation)** - Set up in Claude Desktop, Cursor, or VS Code
    2. **[Tools Reference](mcp-server/tools.md)** - See all available MCP tools  
    3. **[Protocol Overview](overview.md)** - Understand USDs, SPA, and the Sperax ecosystem

---

## 📖 Documentation

Use the **sidebar navigation** or the cards below to explore all documentation pages.

<div class="grid cards" markdown>

-   :material-wrench:{ .lg .middle } **Tools Reference**

    ---

    Core MCP tools for USDs, SPA, veSPA, and Demeter

    [:octicons-arrow-right-24: View Tools](mcp-server/tools.md)

-   :material-tools:{ .lg .middle } **Extended Tools**

    ---

    Advanced tools for analytics, governance, and agents

    [:octicons-arrow-right-24: Extended Tools](mcp-server/tools-extended.md)

-   :material-ethereum:{ .lg .middle } **EVM Module**

    ---

    General blockchain operations, tokens, transactions

    [:octicons-arrow-right-24: EVM Docs](mcp-server/evm-module.md)

-   :material-link-variant:{ .lg .middle } **Universal EVM MCP**

    ---

    Full multi-chain toolkit (BSC, opBNB, Arbitrum, etc.)

    [:octicons-arrow-right-24: Universal EVM](mcp-server/universal-evm.md)

-   :material-file-document-outline:{ .lg .middle } **Resources & Prompts**

    ---

    Built-in resources and prompt templates

    [:octicons-arrow-right-24: Resources](mcp-server/resources-prompts.md)

-   :material-code-braces:{ .lg .middle } **Development**

    ---

    Setup, architecture, and contributing guide

    [:octicons-arrow-right-24: Dev Guide](mcp-server/development.md)

-   :material-bank:{ .lg .middle } **Protocol Docs**

    ---

    USDs, Vault, Staking, Oracles, Demeter Farms

    [:octicons-arrow-right-24: Protocol](protocol/index.md)

-   :material-file-code:{ .lg .middle } **Smart Contracts**

    ---

    Contract addresses and ABIs

    [:octicons-arrow-right-24: Contracts](contracts/index.md)

</div>
---

## Overview

SperaxOS MCP enables AI agents to interact with:

- **USDs** - Auto-yield stablecoin
- **SPA/veSPA** - Governance and staking
- **Demeter** - Yield farming
- **EVM** - General blockchain operations

---

## Installation

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "speraxos": {
      "command": "npx",
      "args": ["-y", "@sperax/os"]
    }
  }
}
```

### Cursor / VS Code

```json
{
  "mcp.servers": {
    "speraxos": {
      "command": "npx",
      "args": ["-y", "@sperax/os"]
    }
  }
}
```

### With Custom RPC

```json
{
  "mcpServers": {
    "speraxos": {
      "command": "npx",
      "args": ["-y", "@sperax/os"],
      "env": {
        "ARBITRUM_RPC_URL": "https://your-rpc.com"
      }
    }
  }
}
```

---

## Modules

### Sperax (57 tools)

| Category | Tools | Description |
|----------|-------|-------------|
| USDs | 7 | Stablecoin queries, yield info, balances |
| Vault | 10 | Collateral, strategies, mint/redeem |
| SPA | 8 | Token info, staking, buyback stats |
| Demeter | 7 | Farm discovery, positions, rewards |
| Dripper | 5 | Yield distribution status |
| Oracle | 5 | Price feeds, staleness checks |
| Analytics | 6 | TVL, revenue, health metrics |
| Governance | 5 | Proposals, voting power |
| Yield Reserve | 4 | Yield collection status |

### EVM (General)

| Category | Tools | Description |
|----------|-------|-------------|
| Blocks | Query block data |
| Contracts | Read contract state |
| Tokens | ERC20 operations |
| NFT | ERC721/1155 queries |
| Wallet | Balance lookups |
| Transactions | Tx status, history |
| Network | Chain info |



---

## Tools Reference

### USDs Tools

```
usds_get_info          - Get USDs overview (supply, APR)
usds_get_balance       - Get balance for address
usds_get_rebase_state  - Check if receiving yield
usds_get_mint_params   - Get mint fees
usds_get_yield_info    - Current yield metrics
usds_get_collateral_ratio - Protocol collateralization
usds_estimate_mint     - Simulate mint output
```

### Vault Tools

```
vault_get_status           - TVL, health, fees
vault_get_collaterals      - List supported collaterals
vault_get_collateral_details - Specific collateral info
vault_get_strategies       - Active yield strategies
vault_get_strategy_details - Strategy performance
vault_get_oracle_prices    - All collateral prices
vault_get_peg_status       - USDs peg health
vault_simulate_mint        - Simulate with fees
vault_simulate_redeem      - Simulate redemption
vault_get_allocation_targets - Target vs actual
```

### SPA & Staking Tools

```
spa_get_info              - SPA token overview
spa_get_balance           - SPA/veSPA/xSPA balances
vespa_get_position        - Lock position details
vespa_calculate_power     - Calculate voting power
vespa_get_stats           - Global staking stats
xspa_get_position         - Vesting position
xspa_calculate_redemption - Calculate SPA output
buyback_get_stats         - Burn statistics
```

### Demeter Tools

```
demeter_list_farms        - List active farms
demeter_get_farm_details  - Farm info
demeter_get_user_position - User farm positions
demeter_calculate_rewards - Pending rewards
demeter_estimate_apr      - APR for deposit
demeter_get_top_farms     - Highest APR farms
demeter_get_farm_types    - Supported types
```

### Dripper Tools

```
dripper_get_status        - Operational status
dripper_get_balance       - Pending yield
dripper_get_config        - Distribution config
dripper_estimate_next_rebase - Next rebase timing
dripper_calculate_earnings - Projected earnings
```

### Oracle Tools

```
oracle_get_all_prices     - All collateral prices
oracle_get_price          - Specific asset price
oracle_check_staleness    - Oracle freshness
oracle_check_deviation    - Price deviation
oracle_get_sources        - Oracle sources
```

### Analytics Tools

```
analytics_get_tvl           - TVL breakdown
analytics_get_revenue       - Protocol revenue
analytics_get_apy_history   - Historical APY
analytics_get_user_stats    - User statistics
analytics_compare_yields    - Yield comparison
analytics_get_protocol_health - Health score
```

### Governance Tools

```
governance_get_overview      - Governance state
governance_get_proposals     - Active proposals
governance_get_proposal_details - Proposal info
governance_get_voting_power  - Address voting power
governance_get_delegates     - Delegation info
```

---

## Resources

| URI | Description |
|-----|-------------|
| `sperax://docs/overview` | Protocol overview |
| `sperax://docs/usds` | USDs documentation |
| `sperax://docs/staking` | veSPA/xSPA guide |
| `sperax://docs/demeter` | Farming guide |

---

## Prompts

| Prompt | Description |
|--------|-------------|
| `what_is_usds` | Learn about USDs |
| `how_to_mint` | Minting guide |
| `how_to_redeem` | Redemption guide |
| `my_usds_balance` | Check balance |
| `stake_spa` | Staking guide |
| `best_yield_farms` | Find farms |
| `protocol_health` | Health report |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ARBITRUM_RPC_URL` | Arbitrum RPC | Public endpoint |
| `PRIVATE_KEY` | For write operations | None |
| `LOG_LEVEL` | Logging level | `info` |

---

## Development

```bash
# Clone
git clone https://github.com/sperax/speraxos
cd speraxos

# Install
pnpm install

# Dev mode
pnpm dev

# Build
pnpm build

# Test with Inspector
npx @modelcontextprotocol/inspector bun dev
```

---

## Security

- **Read-Only by Default** - No transactions without explicit keys
- **No Private Key Storage** - Keys only in environment
- **Rate Limited** - Built-in RPC limiting
- **Input Validation** - All inputs validated with Zod

---

## Related Documentation

- [../protocol/index.md](../protocol/index.md) - Protocol docs
- [../protocol/addresses.md](../protocol/addresses.md) - Contracts

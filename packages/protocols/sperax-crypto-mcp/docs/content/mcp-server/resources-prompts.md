# Resources & Prompts

MCP resources and prompts for AI-native documentation.

---

## Resources

Resources provide structured documentation accessible via `sperax://` URIs.

### Available Resources

| URI | Description |
|-----|-------------|
| `sperax://docs/overview` | Protocol overview and architecture |
| `sperax://docs/usds` | USDs stablecoin documentation |
| `sperax://docs/staking` | veSPA and xSPA staking guide |
| `sperax://docs/demeter` | Demeter farming guide |
| `sperax://contracts/addresses` | Contract addresses by network |
| `sperax://contracts/abis` | Contract ABIs |

---

### Accessing Resources

Resources are automatically available to AI clients. Example usage:

**Claude:**
```
Can you read the sperax://docs/usds resource and explain how rebasing works?
```

**Programmatic:**
```typescript
const resource = await client.readResource("sperax://docs/usds");
```

---

## Prompts

Pre-built prompts for common user intents.

### Learning Prompts

#### what_is_usds

Learn about the USDs stablecoin.

**Intent:** User wants to understand USDs
**Output:** Comprehensive explanation of:
- What USDs is
- How auto-yield works
- How to get USDs
- Rebasing mechanics

---

#### how_to_mint

Guide to minting USDs.

**Intent:** User wants to mint USDs
**Output:** Step-by-step guide:
1. Supported collaterals
2. Current fees
3. Transaction steps
4. Post-mint options (rebasing)

---

#### how_to_redeem

Guide to redeeming USDs.

**Intent:** User wants to redeem USDs for collateral
**Output:** Step-by-step guide:
1. Available collaterals
2. Redemption fees
3. Transaction steps
4. Timing considerations

---

### Balance & Portfolio

#### my_usds_balance

Check USDs balance and yield status.

**Parameters:**
| Name | Type | Required |
|------|------|----------|
| address | string | Yes |

**Output:**
- Current balance
- Rebasing status
- Earned yield
- APR being received

---

#### my_spa_positions

Check all SPA-related positions.

**Parameters:**
| Name | Type | Required |
|------|------|----------|
| address | string | Yes |

**Output:**
- SPA balance
- veSPA position (if any)
- xSPA position (if any)
- Voting power

---

### Staking

#### stake_spa

Guide to staking SPA.

**Intent:** User wants to stake SPA
**Output:**
- veSPA vs xSPA comparison
- Lock duration options
- Voting power calculation
- Benefits of staking

---

#### unlock_spa

Guide to unlocking staked SPA.

**Intent:** User wants to unlock SPA
**Output:**
- Current lock status
- Early exit options (xSPA)
- Wait time for veSPA
- Steps to unlock

---

### Farming

#### best_yield_farms

Find highest-yield farms.

**Output:**
- Top 10 farms by APR
- TVL and risk info
- Required tokens
- How to deposit

---

#### my_farm_positions

Check farming positions.

**Parameters:**
| Name | Type | Required |
|------|------|----------|
| address | string | Yes |

**Output:**
- Active positions
- Pending rewards
- TVL per position
- Harvest recommendations

---

### Analytics

#### protocol_health

Get protocol health report.

**Output:**
- Overall health score
- Collateralization ratio
- Oracle status
- Peg status
- Risk warnings

---

#### yield_comparison

Compare yields across protocol.

**Output:**
- USDs rebasing APR
- Farm APRs
- Staking APRs
- Risk-adjusted returns

---

## Custom Prompts

Clients can register custom prompts:

```typescript
server.setPromptHandler(async (request) => {
  if (request.name === "custom_prompt") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Custom prompt content..."
          }
        }
      ]
    };
  }
});
```

---

## Best Practices

### For AI Clients

1. **Check resources first** - Read documentation before making tool calls
2. **Use prompts for common tasks** - Prompts provide optimized workflows
3. **Combine tools** - Use multiple tools to build complete answers

### For Developers

1. **Keep resources updated** - Sync with protocol changes
2. **Test prompts** - Ensure prompts produce accurate outputs
3. **Add new prompts** - For common user patterns

---

## What's Next?

<div class="grid cards" markdown>

-   :material-wrench:{ .lg .middle } **Tools Reference**

    ---

    All available MCP tools and their parameters

    [:octicons-arrow-right-24: Tools](tools.md)

-   :material-code-braces:{ .lg .middle } **Development**

    ---

    Create custom resources and prompts

    [:octicons-arrow-right-24: Dev Guide](development.md)

-   :material-bank:{ .lg .middle } **Protocol**

    ---

    Understand the underlying protocol mechanics

    [:octicons-arrow-right-24: Protocol](../protocol/index.md)

</div>

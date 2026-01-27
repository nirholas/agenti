"""
EIP-1559 Resources

Documentation about EIP-1559 fee mechanics.
"""

from mcp.server import Server


EIP1559_CONTENT = """
# EIP-1559: Fee Market Change

## Overview

EIP-1559 (London hard fork, August 2021) fundamentally changed Ethereum's fee market:
- Introduced **base fee** that's burned
- Added **priority fee** (tip) for validators
- Made fees more predictable
- Created deflationary pressure on ETH supply

## Fee Components

### Base Fee
- Set by protocol, not users
- Adjusts based on block fullness
- **Burned** - removed from circulation
- Target: 50% block utilization

### Priority Fee (Tip)
- Set by users
- Goes to block validator
- Incentivizes inclusion
- Higher tip = faster inclusion

### Max Fee
- Maximum total fee user will pay
- Protects against fee spikes
- Unused portion refunded

## Fee Calculation

```
effective_gas_price = min(max_fee, base_fee + priority_fee)
actual_cost = effective_gas_price * gas_used
refund = (max_fee - effective_gas_price) * gas_used
```

## Transaction Parameters

### maxFeePerGas
- Maximum total fee per gas unit
- Should be: `base_fee + priority_fee + buffer`
- Buffer accounts for base fee increase

### maxPriorityFeePerGas
- Maximum tip per gas unit
- Typical values:
  - Low: 1-2 gwei (slower)
  - Medium: 2-3 gwei (normal)
  - High: 3-5+ gwei (fast)
  - Urgent: 10+ gwei

## Base Fee Mechanics

### Adjustment Formula
```python
if parent_gas_used == parent_gas_target:
    base_fee = parent_base_fee  # No change
elif parent_gas_used > parent_gas_target:
    # Increase up to 12.5%
    gas_used_delta = parent_gas_used - parent_gas_target
    base_fee_delta = parent_base_fee * gas_used_delta // parent_gas_target // 8
    base_fee = parent_base_fee + max(base_fee_delta, 1)
else:
    # Decrease up to 12.5%
    gas_used_delta = parent_gas_target - parent_gas_used
    base_fee_delta = parent_base_fee * gas_used_delta // parent_gas_target // 8
    base_fee = parent_base_fee - base_fee_delta
```

### Block Target
- Target: 15M gas (50% of 30M limit)
- If block > 15M gas: base fee increases
- If block < 15M gas: base fee decreases

### Maximum Change
- Max increase: 12.5% per block
- Max decrease: 12.5% per block
- Minimum base fee: 7 wei

## Setting Fees

### Strategy 1: Query + Buffer
```javascript
const baseFee = await getBaseFee()
const priorityFee = 2_000_000_000 // 2 gwei
const maxFee = baseFee * 2 + priorityFee // 100% buffer
```

### Strategy 2: Historical Analysis
```javascript
const feeHistory = await eth_feeHistory(10, "latest", [25, 50, 75])
// Use percentiles to set appropriate fees
```

### Strategy 3: Dynamic Adjustment
- Monitor pending pool
- Adjust priority fee based on urgency
- Use higher buffer during congestion

## Comparison with Legacy

| Aspect | Legacy | EIP-1559 |
|--------|--------|----------|
| Fee parameter | gasPrice | maxFeePerGas + maxPriorityFeePerGas |
| Who sets price | User guesses | Protocol + User tip |
| Fee destination | All to miner | Base burned + tip to validator |
| Overpayment | All goes to miner | Refunded to user |
| Predictability | Poor | Good |
| First-price auction | Yes | No (tip only) |

## Benefits

1. **Better UX**: Don't need to guess gas price
2. **Fee Predictability**: Base fee changes max 12.5%/block
3. **Reduced Overpayment**: Excess refunded
4. **ETH Burning**: Deflationary pressure
5. **Miner Manipulation**: Harder to manipulate

## Common Patterns

### Simple Transaction
```javascript
{
    maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("2", "gwei"),
    gasLimit: 21000
}
```

### Urgent Transaction
```javascript
{
    maxFeePerGas: baseFee * 3,
    maxPriorityFeePerGas: ethers.utils.parseUnits("10", "gwei"),
    gasLimit: 21000
}
```

### Gas-Sensitive (DEX, etc.)
```javascript
{
    maxFeePerGas: ethers.utils.parseUnits("100", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("3", "gwei"),
    gasLimit: estimatedGas * 1.2
}
```

## Useful RPC Methods

### eth_gasPrice
Returns suggested gasPrice (for legacy compatibility)

### eth_maxPriorityFeePerGas
Returns suggested priority fee

### eth_feeHistory
```javascript
eth_feeHistory(
    blockCount,      // Number of blocks
    newestBlock,     // "latest" or block number
    rewardPercentiles // [25, 50, 75] for tip distribution
)
```

Returns:
- baseFeePerGas per block
- gasUsedRatio per block
- reward at each percentile

## Troubleshooting

### Transaction Pending Too Long
- Priority fee too low
- Solution: Increase maxPriorityFeePerGas

### "Max fee less than block base fee"
- maxFeePerGas < current base fee
- Solution: Increase maxFeePerGas

### Overpaying
- maxFeePerGas much higher than needed
- Solution: Set tighter maxFeePerGas
"""


def register_eip1559_resources(server: Server) -> None:
    """Register EIP-1559 documentation resources."""
    
    @server.resource("transaction://eip1559/overview")
    async def get_eip1559_overview() -> str:
        """
        Comprehensive guide to EIP-1559 fee mechanics.
        """
        return EIP1559_CONTENT

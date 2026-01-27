"""
Gas Optimization Workflow Prompts

Guided prompts for gas management.
"""

from mcp.server import Server


def register_gas_prompts(server: Server) -> None:
    """Register gas workflow prompts."""
    
    @server.prompt()
    async def gas_estimation_guide() -> str:
        """
        Guide for estimating transaction gas costs.
        """
        return """# Gas Estimation Guide

## Understanding Gas Costs

Total cost = Gas Used × Gas Price

### Gas Used
- Determined by transaction complexity
- Fixed for simple transfers (21,000)
- Variable for contract calls

### Gas Price
- Legacy: Single gasPrice
- EIP-1559: baseFee + priorityFee

## Estimation Workflow

### Step 1: Determine Operation Type

Use `get_gas_estimate` to get baseline:
```
operation: "transfer" → 21,000
operation: "erc20_transfer" → 65,000
operation: "uniswap_swap" → 150,000
```

### Step 2: Calculate Data Costs

If transaction has data, use `calculate_gas_for_data`:
```
data: "0xa9059cbb..."
```

Returns gas cost for calldata.

### Step 3: Add Buffer

For contract calls:
```
gas_limit = estimated × 1.1 to 1.2
```

### Step 4: Calculate Cost

Use `estimate_transaction_cost`:
```
gas_limit: from above
max_fee_per_gas_gwei: current market rate
value_eth: ETH being sent (if any)
```

## Current Gas Price Context

Check network conditions:
- Low congestion: 10-20 gwei
- Normal: 20-50 gwei
- High congestion: 50-200+ gwei
- NFT mint/major event: 200-1000+ gwei

## Cost Examples

At 30 gwei gas price:

| Operation | Gas | Cost (ETH) | Cost ($2000/ETH) |
|-----------|-----|------------|------------------|
| ETH Transfer | 21,000 | 0.00063 | $1.26 |
| Token Transfer | 65,000 | 0.00195 | $3.90 |
| Token Approval | 46,000 | 0.00138 | $2.76 |
| Uniswap Swap | 150,000 | 0.0045 | $9.00 |

## Optimization Tips

1. **Batch when possible**: Multiple operations in one tx
2. **Time your transactions**: Gas is lower during off-peak
3. **Use EIP-1559**: More predictable, potential savings
4. **Set appropriate limits**: Don't over-provision
"""
    
    @server.prompt()
    async def eip1559_fee_setting() -> str:
        """
        Guide for setting EIP-1559 fees optimally.
        """
        return """# EIP-1559 Fee Setting Guide

## Components

### Base Fee
- Set by protocol
- Changes based on network demand
- You cannot control this

### Priority Fee (Tip)
- You set this
- Goes to validator
- Higher = faster inclusion

### Max Fee
- Maximum you'll pay per gas
- Should be: baseFee + priorityFee + buffer

## Setting Strategy

### Conservative (Save Money)
```
maxPriorityFeePerGas: 1-2 gwei
maxFeePerGas: baseFee × 1.5 + priorityFee
```
- May take longer
- Lower cost
- Good for non-urgent

### Standard
```
maxPriorityFeePerGas: 2-3 gwei
maxFeePerGas: baseFee × 2 + priorityFee
```
- Usually next few blocks
- Balanced cost
- Most transactions

### Urgent
```
maxPriorityFeePerGas: 5-10 gwei
maxFeePerGas: baseFee × 3 + priorityFee
```
- Very fast inclusion
- Higher cost
- Time-sensitive operations

## Calculation Examples

Current baseFee: 20 gwei

### Standard Transaction
```
priorityFee = 2 gwei
maxFee = 20 × 2 + 2 = 42 gwei
```

Actual cost if included at baseFee = 20:
```
effectiveGasPrice = 20 + 2 = 22 gwei
cost = 22 × gasUsed
```

Savings from maxFee: 20 gwei/gas

### Using the Tool

`estimate_transaction_cost`:
```
gas_limit: 21000
max_fee_per_gas_gwei: 42
base_fee_gwei: 20
priority_fee_gwei: 2
```

## Common Mistakes

❌ Setting maxFee = priorityFee only
❌ Not accounting for base fee increase
❌ Using same fees during congestion
❌ Forgetting to add buffer

## Dynamic Adjustment

Monitor and adjust:
1. Check current baseFee
2. If tx pending > 2 blocks, increase
3. Replace with higher fees if needed
"""
    
    @server.prompt()
    async def gas_optimization_strategies() -> str:
        """
        Advanced strategies for minimizing gas costs.
        """
        return """# Gas Optimization Strategies

## Timing Strategies

### Daily Patterns
- Lowest: Weekend, early morning UTC
- Highest: Weekday, US business hours
- Check: https://etherscan.io/gastracker

### Event Awareness
- NFT mints cause spikes
- Major token launches
- Airdrop claims
- Market volatility

### Gas Price Alerts
Set alerts for target gas price, execute when low.

## Transaction Optimization

### Batch Operations
Instead of:
- Transfer 1: 21,000 gas
- Transfer 2: 21,000 gas
- Transfer 3: 21,000 gas
= 63,000 gas

Use batch contract:
- Batch transfer: ~45,000 gas total

### Efficient Calldata

Zero bytes cost 4 gas, non-zero cost 16 gas.

Less efficient:
```
0x0000000000000001 (1 non-zero, 7 zeros = 44 gas)
```

More efficient when possible:
```
0x01 (1 non-zero = 16 gas)
```

### Access Lists (EIP-2930)

Pre-declare storage access:
- Cold storage read: 2,100 gas
- With access list: 1,900 gas
- Warm read: 100 gas

Useful for contracts accessing many storage slots.

## L2 Considerations

### Use Layer 2 for Small Transactions
- Arbitrum, Optimism, Base
- 10-100x cheaper
- Same security (eventually)

### When to Use L1
- Large value transfers
- Need immediate finality
- L2 not supported

## Unit Conversion

Use `convert_gas_units` to:
- Convert gwei to wei for precision
- Calculate ETH cost from gwei
- Verify amounts

## Cost Planning

For multiple operations:

1. List all needed transactions
2. Estimate gas for each
3. Calculate total at current price
4. Calculate total at target price
5. Decide: execute now or wait

## Monitoring

Track your gas spending:
- Average gas price paid
- Total gas used
- Cost per operation type
- Identify optimization opportunities
"""

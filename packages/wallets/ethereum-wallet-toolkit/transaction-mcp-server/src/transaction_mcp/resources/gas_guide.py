"""
Gas Guide Resources

Documentation about gas mechanics in Ethereum.
"""

from mcp.server import Server


GAS_GUIDE_CONTENT = """
# Ethereum Gas Guide

## What is Gas?

Gas is the unit measuring computational effort in Ethereum. Every operation costs gas:
- Simple transfer: 21,000 gas
- Storage write: 20,000 gas (new) / 5,000 gas (update)
- Storage read: 2,100 gas (cold) / 100 gas (warm)

## Value Units

| Unit | Wei | Common Use |
|------|-----|------------|
| Wei | 1 | Base unit |
| Kwei | 10^3 | Rarely used |
| Mwei | 10^6 | Rarely used |
| Gwei | 10^9 | Gas prices |
| Szabo | 10^12 | Historical |
| Finney | 10^15 | Historical |
| Ether | 10^18 | Main unit |

## Gas Costs by Operation

### Basic Operations
| Operation | Gas |
|-----------|-----|
| ETH transfer | 21,000 |
| ERC-20 transfer | ~65,000 |
| ERC-20 approve | ~46,000 |
| ERC-721 transfer | ~85,000 |

### Storage Operations
| Operation | Gas |
|-----------|-----|
| SSTORE (new value) | 20,000 |
| SSTORE (update) | 5,000 |
| SSTORE (reset to zero) | refund 15,000 |
| SLOAD (cold) | 2,100 |
| SLOAD (warm) | 100 |

### Memory & Computation
| Operation | Gas |
|-----------|-----|
| ADD, SUB, MUL | 3 |
| DIV, MOD | 5 |
| KECCAK256 | 30 + 6/word |
| MLOAD, MSTORE | 3 |
| Memory expansion | quadratic |

## Intrinsic Gas

Every transaction has intrinsic gas:
```
intrinsic_gas = 21000                    // Base cost
             + 16 * non_zero_bytes       // Calldata
             + 4 * zero_bytes            // Calldata
             + 32000 (if contract creation)
```

## Gas Limit vs Gas Used

- **Gas Limit**: Maximum gas you're willing to use
- **Gas Used**: Actual gas consumed
- **Refund**: Unused gas is refunded at same price

Setting gas limit:
- Too low: Transaction fails (out of gas)
- Too high: No penalty, just locks more ETH temporarily
- Optimal: ~10-20% above estimated

## EIP-1559 Fee Mechanics

### Components
1. **Base Fee**: Protocol-determined, burned
2. **Priority Fee**: Tip to validator
3. **Max Fee**: Maximum total you'll pay

### Calculation
```
effective_gas_price = base_fee + priority_fee
actual_cost = effective_gas_price * gas_used
```

### Base Fee Adjustment
- Block > 50% full: base fee increases up to 12.5%
- Block < 50% full: base fee decreases up to 12.5%
- Target: 50% block utilization

## Estimating Gas

### For Simple Transfer
Always 21,000 gas.

### For Contract Calls
```python
# Rough estimation
estimated = eth_estimateGas(tx)
gas_limit = estimated * 1.1  # 10% buffer
```

### Gas Estimation Tips
1. Estimate close to execution time
2. Account for state changes
3. Add buffer for dynamic behavior
4. Watch for reentrancy gas costs

## Cost Optimization

### Reduce Calldata
- Zero bytes cost 4 gas
- Non-zero bytes cost 16 gas
- Pack data efficiently

### Optimize Storage
- Batch writes
- Use mappings over arrays for random access
- Clear unused storage (get refund)

### Access Lists (EIP-2930)
- Pre-declare storage slots
- Reduces cold access costs
- Useful for cross-contract calls

## Common Mistakes

1. **Setting gas too low**: Transaction reverts, gas lost
2. **Not accounting for token decimals**: Wrong amounts
3. **Ignoring base fee volatility**: Transaction pending
4. **Forgetting approval gas**: ERC-20 needs approve first
"""


GAS_ESTIMATION_CONTENT = """
# Gas Estimation Reference

## Common Operation Gas Estimates

### Native ETH Operations
- Simple transfer: 21,000 gas (exact)
- Send with data: 21,000 + calldata gas

### ERC-20 Token Operations
- transfer(): 45,000 - 75,000 gas
- approve(): 25,000 - 50,000 gas
- transferFrom(): 50,000 - 80,000 gas
- First transfer to address: Higher (storage creation)

### ERC-721 NFT Operations
- safeTransferFrom(): 65,000 - 100,000 gas
- approve(): 45,000 - 65,000 gas
- setApprovalForAll(): 45,000 - 65,000 gas

### DeFi Operations
- Uniswap V2 swap: 120,000 - 180,000 gas
- Uniswap V3 swap: 130,000 - 200,000 gas
- Curve swap: 150,000 - 300,000 gas
- Aave deposit: 250,000 - 400,000 gas
- Compound supply: 150,000 - 250,000 gas

### Contract Deployment
- Simple contract: 100,000 - 500,000 gas
- Complex contract: 1,000,000 - 5,000,000 gas
- Proxy deployment: 300,000 - 600,000 gas

## Quick Calculation

### Cost in ETH
```
cost_eth = gas_used * gas_price_gwei * 1e-9
```

### Examples at 30 Gwei
| Operation | Gas | Cost (ETH) | Cost ($2000/ETH) |
|-----------|-----|------------|------------------|
| Transfer | 21,000 | 0.00063 | $1.26 |
| ERC-20 | 65,000 | 0.00195 | $3.90 |
| Swap | 150,000 | 0.0045 | $9.00 |
"""


def register_gas_resources(server: Server) -> None:
    """Register gas documentation resources."""
    
    @server.resource("transaction://gas/guide")
    async def get_gas_guide() -> str:
        """
        Comprehensive guide to Ethereum gas mechanics.
        """
        return GAS_GUIDE_CONTENT
    
    @server.resource("transaction://gas/estimation")
    async def get_gas_estimation() -> str:
        """
        Gas estimation reference for common operations.
        """
        return GAS_ESTIMATION_CONTENT

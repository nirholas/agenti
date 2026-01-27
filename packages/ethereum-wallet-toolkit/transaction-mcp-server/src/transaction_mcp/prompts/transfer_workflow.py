"""
ETH Transfer Workflow Prompts

Guided prompts for ETH transfers.
"""

from mcp.server import Server


def register_transfer_prompts(server: Server) -> None:
    """Register ETH transfer workflow prompts."""
    
    @server.prompt()
    async def eth_transfer_guide() -> str:
        """
        Step-by-step guide for creating and signing an ETH transfer.
        """
        return """# ETH Transfer Guide

## Step 1: Gather Required Information

Before creating a transaction, you need:
- **Sender address**: The address sending ETH
- **Sender private key**: To sign the transaction (NEVER share!)
- **Recipient address**: The destination address
- **Amount**: How much ETH to send
- **Chain ID**: Network identifier (1 = mainnet)
- **Nonce**: Transaction count from sender
- **Gas settings**: Price and limit

## Step 2: Build the Transaction

Use `build_transaction` with these parameters:
```
to: recipient address
value_wei: amount in wei (1 ETH = 10^18 wei)
chain_id: network (1 for mainnet)
nonce: current nonce
gas_limit: 21000 (for simple ETH transfer)
```

For gas, choose:
- Legacy: `gas_price_gwei: 30` (example)
- EIP-1559: `max_fee_per_gas_gwei: 50, max_priority_fee_gwei: 2`

## Step 3: Review the Transaction

Check the built transaction:
- Verify recipient address
- Confirm amount
- Review gas costs
- Check chain ID

## Step 4: Sign the Transaction

Use `sign_transaction` with:
- The transaction object from step 2
- Your private key

## Step 5: Broadcast (External)

The signed transaction can be broadcast using:
- Web3 providers
- Etherscan API
- Direct node RPC

## Example Values

For 0.1 ETH transfer at 30 gwei:
- value_wei: 100000000000000000 (0.1 × 10^18)
- gas_limit: 21000
- gas_price_gwei: 30
- max_cost: 0.00063 ETH ($1.26 at $2000/ETH)

## Security Reminders

⚠️ NEVER share your private key
⚠️ Double-check recipient address
⚠️ Verify chain ID matches intended network
⚠️ Test with small amounts first
"""
    
    @server.prompt()
    async def batch_transfer_planning() -> str:
        """
        Guide for planning multiple ETH transfers efficiently.
        """
        return """# Batch ETH Transfer Planning

## Overview

When sending ETH to multiple recipients, plan carefully to:
- Minimize gas costs
- Ensure correct nonce sequence
- Track all transactions

## Step 1: List All Transfers

Create a list with:
| Recipient | Amount (ETH) | Priority |
|-----------|--------------|----------|
| 0x...abc  | 1.0          | High     |
| 0x...def  | 0.5          | Normal   |

## Step 2: Calculate Total Required

```
total_eth = sum(all_amounts) + (21000 × gas_price × num_transfers)
```

Ensure sender has sufficient balance.

## Step 3: Determine Nonces

Nonces must be sequential:
- Transfer 1: nonce = current_nonce
- Transfer 2: nonce = current_nonce + 1
- Transfer 3: nonce = current_nonce + 2
- ...

## Step 4: Build Transactions

For each transfer, use `build_transaction`:
- Set appropriate nonce
- Same gas settings for consistency
- Consider priority for gas price

## Step 5: Sign All Transactions

Sign each transaction with `sign_transaction`.

## Step 6: Broadcast Sequentially

Broadcast in nonce order:
1. Send lowest nonce first
2. Wait for confirmation or broadcast next
3. Track transaction hashes

## Tips

- **Use same gas price**: Prevents nonce gaps
- **Track hashes**: Record each tx hash
- **Have buffer**: Extra ETH for gas changes
- **Test first**: Try with 2-3 transfers before large batches

## Recovery

If a transaction fails:
- Note the failed nonce
- Can replace with same nonce + higher gas
- Subsequent transactions will wait
"""
    
    @server.prompt()
    async def transaction_replacement_guide() -> str:
        """
        Guide for replacing or canceling pending transactions.
        """
        return """# Transaction Replacement Guide

## When to Replace

- Transaction stuck (low gas price)
- Wrong recipient/amount
- Need to cancel

## How Replacement Works

Ethereum allows replacing a pending transaction by:
1. Using the SAME nonce
2. Using HIGHER gas price (10%+ typically required)

## To Speed Up

Use `build_transaction` with:
- Same nonce as pending tx
- Same recipient, amount, data
- Higher gas price (20-50% more)

Sign and broadcast - miners prefer higher fee.

## To Cancel

Use `build_transaction` with:
- Same nonce as pending tx
- Recipient: YOUR OWN address
- Value: 0
- Higher gas price

This "self-transfer" uses the nonce, canceling the original.

## Minimum Gas Increase

Most nodes require 10% minimum increase:
```
new_gas_price >= old_gas_price × 1.1
```

For EIP-1559:
```
new_max_fee >= old_max_fee × 1.1
new_priority_fee >= old_priority_fee × 1.1
```

## Example: Speed Up

Original: 30 gwei
Replacement: 45 gwei (50% increase)

## Example: Cancel

Original: 30 gwei, sending 1 ETH to 0x...abc
Cancel: 45 gwei, sending 0 ETH to self

## Important Notes

⚠️ Replacement not guaranteed - original may confirm first
⚠️ Both transactions compete - only one will be included
⚠️ Higher gas = higher cost for replacement
⚠️ Once confirmed, cannot be replaced
"""

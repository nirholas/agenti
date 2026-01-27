"""
Token Transfer Workflow Prompts

Guided prompts for ERC-20 token operations.
"""

from mcp.server import Server


def register_token_prompts(server: Server) -> None:
    """Register token workflow prompts."""
    
    @server.prompt()
    async def erc20_transfer_guide() -> str:
        """
        Step-by-step guide for ERC-20 token transfers.
        """
        return """# ERC-20 Token Transfer Guide

## Overview

Unlike ETH transfers, token transfers:
- Require calling the token contract
- Use the `transfer(address,uint256)` function
- Need more gas (~65,000 vs 21,000)

## Step 1: Gather Information

Required:
- **Token contract address**: Where the token lives
- **Your address**: Must have token balance
- **Recipient address**: Where to send tokens
- **Amount**: In smallest unit (consider decimals!)
- **Gas settings**: Higher than ETH transfer

## Step 2: Understand Decimals

Most tokens have 18 decimals (like ETH):
- 1 TOKEN = 1 × 10^18 smallest units

Some tokens differ (USDC = 6 decimals):
- 1 USDC = 1 × 10^6 smallest units

## Step 3: Encode the Transfer

Use `encode_transfer` with:
```
to: recipient address
amount: amount in smallest units
```

Example for 100 USDC (6 decimals):
```
amount = 100 × 10^6 = 100000000
```

## Step 4: Build the Transaction

Use `build_transaction` with:
```
to: TOKEN CONTRACT address (not recipient!)
value_wei: 0 (no ETH being sent)
data: calldata from encode_transfer
gas_limit: 65000 (or more for complex tokens)
```

## Step 5: Sign and Broadcast

Same as ETH transfer - sign with private key.

## Common Token Addresses (Mainnet)

| Token | Address |
|-------|---------|
| USDC | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| DAI | 0x6B175474E89094C44Da98b954EescdeCB5F3F12D |
| WETH | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 |

## Security Notes

⚠️ Double-check token contract address
⚠️ Verify decimal conversion
⚠️ 'to' in transaction is the TOKEN contract
⚠️ Recipient is encoded in the data field
"""
    
    @server.prompt()
    async def erc20_approval_guide() -> str:
        """
        Guide for approving token spending.
        """
        return """# ERC-20 Approval Guide

## Why Approvals?

Before another contract can spend your tokens (DEX, lending, etc.):
1. You must approve that contract
2. Set a spending limit
3. Then it can use `transferFrom`

## Step 1: Understand the Flow

```
1. You call approve(spender, amount) on token
2. DEX/protocol can now call transferFrom(you, recipient, amount)
3. Only up to approved amount
```

## Step 2: Encode Approval

Use `encode_approve` with:
```
spender: address to approve (DEX router, etc.)
amount: maximum they can spend
```

## Approval Amounts

### Exact Amount
- Approve only what's needed
- Must re-approve for each transaction
- Most secure

### Unlimited Approval
- amount = 2^256 - 1 (max uint256)
- One-time approval
- Convenient but riskier

## Step 3: Build Transaction

Use `build_transaction` with:
```
to: TOKEN CONTRACT address
value_wei: 0
data: calldata from encode_approve
gas_limit: 50000
```

## Step 4: Sign and Broadcast

Sign with your private key.

## Security Considerations

### Risks of Unlimited Approval
- If spender contract is hacked, all tokens at risk
- Malicious contracts can drain tokens
- Approval persists until revoked

### Best Practices
1. Approve exact amounts when possible
2. Revoke unused approvals periodically
3. Use reputable protocols only
4. Check approval before signing

## Revoking Approvals

To revoke, approve amount = 0:
```
encode_approve(spender, 0)
```

## Common Spenders

| Protocol | Spender (Mainnet) |
|----------|-------------------|
| Uniswap V2 Router | 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D |
| Uniswap V3 Router | 0xE592427A0AEce92De3Edee1F18E0157C05861564 |
"""
    
    @server.prompt()
    async def token_operations_workflow() -> str:
        """
        Complete workflow for token operations.
        """
        return """# Complete Token Operations Workflow

## Scenario: Swap Tokens on DEX

### Step 1: Check Token Balance
First verify you have the tokens.

### Step 2: Check Existing Approval
See if DEX already has approval for your tokens.

### Step 3: Approve if Needed
If no approval or insufficient:
1. `encode_approve(dex_router, amount)`
2. Build transaction to token contract
3. Sign and send
4. Wait for confirmation

### Step 4: Perform Swap
1. Encode swap function call
2. Build transaction to DEX router
3. Sign and send

## Transaction Ordering

CRITICAL: Approval must confirm before swap!

Option 1: Wait for confirmation
- Approve → Wait for block → Swap

Option 2: Sequential nonces
- Approve (nonce N) → Swap (nonce N+1)
- Swap waits for approve automatically

## Gas Estimation

| Operation | Typical Gas |
|-----------|-------------|
| Approve | 46,000 |
| Transfer | 65,000 |
| Swap | 150,000+ |

## Error Handling

### "Insufficient allowance"
- Approval not confirmed yet
- Or approved amount too low
- Solution: Approve more, wait for confirmation

### "Insufficient balance"
- Not enough tokens
- Check actual balance vs amount

### "Transfer failed"
- Contract may have restrictions
- Check if token has transfer tax
- Some tokens have whitelist/blacklist
"""

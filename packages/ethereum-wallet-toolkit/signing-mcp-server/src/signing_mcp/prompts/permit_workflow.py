"""
Permit Signing Workflow Prompts
"""

from mcp.server import Server


def register_permit_prompts(server: Server) -> None:
    """Register permit-specific workflow prompts."""
    
    @server.prompt()
    async def permit_signing_workflow() -> str:
        """
        Guide through signing an ERC-20 permit.
        """
        return """
# ERC-20 Permit Signing (EIP-2612)

I'll help you sign a gasless token approval permit.

## What is a Permit?

Instead of calling `approve()` on-chain (costs gas), you sign a message
that authorizes spending. The spender submits this signature when needed.

## Benefits:
- **No gas** - Signing is free
- **Better UX** - One-click approvals
- **Bundled operations** - Approve + swap in one tx

## What I need:

1. **Token contract address** - The ERC-20 token
2. **Token name** - Exact name from contract (for domain)
3. **Spender address** - Who can spend your tokens
4. **Amount** - How much to approve (in wei)
5. **Deadline** - When permit expires (Unix timestamp)
6. **Nonce** - Get from `token.nonces(yourAddress)`
7. **Chain ID** - Network (1 for mainnet)
8. **Private key** - Your wallet's private key

## Example values:

```
Token: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
Token name: "USD Coin"
Version: "2" (USDC uses version 2)
Spender: 0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD (Uniswap Router)
Amount: 1000000000 (1000 USDC, 6 decimals)
Deadline: 1893456000 (far future)
Nonce: 0 (first permit)
Chain: 1 (mainnet)
```

## Important Notes:

- Token MUST support EIP-2612 (not all do)
- Get exact token name from contract
- Some tokens use different version strings
- Nonce increments after each permit

Ready to sign a permit? Give me the details!
"""
    
    @server.prompt()
    async def permit2_signing_workflow() -> str:
        """
        Guide through signing a Uniswap Permit2.
        """
        return """
# Uniswap Permit2 Signing

I'll help you sign a Permit2 approval for universal token access.

## What is Permit2?

Uniswap's universal approval system:
1. Approve Permit2 contract once per token (on-chain)
2. Sign permits for any protocol that supports Permit2
3. More secure: granular control, expiring approvals

## Permit2 Contract
Same address on all chains:
`0x000000000022D473030F116dDEE9F6B43aC78BA3`

## What I need:

1. **Token address** - Which token to permit
2. **Spender** - Protocol address (e.g., Uniswap Router)
3. **Amount** - How much to allow
4. **Expiration** - When allowance expires
5. **Signature deadline** - When signature expires
6. **Nonce** - From Permit2.allowance()
7. **Chain ID**
8. **Private key**

## Types of Permit2:

### PermitSingle (most common)
- One token, one spender

### PermitBatch
- Multiple tokens, one spender

### PermitTransferFrom
- Immediate transfer authorization

## Example:

```
Token: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
Spender: 0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD (Universal Router)
Amount: max uint160 (unlimited)
Expiration: 30 days from now
SigDeadline: 30 minutes from now
```

What would you like to approve?
"""
    
    @server.prompt()
    async def dex_order_signing_workflow() -> str:
        """
        Guide through signing a DEX limit order.
        """
        return """
# DEX Limit Order Signing

I'll help you sign an off-chain limit order for a decentralized exchange.

## How DEX Orders Work:

1. You sign an order off-chain (free)
2. Order is stored in an order book
3. When matched, taker submits your signature
4. Smart contract executes the trade

## What I need:

1. **Exchange contract** - The DEX settlement contract
2. **Maker token** - Token you're selling
3. **Taker token** - Token you're buying
4. **Maker amount** - How much you're selling
5. **Taker amount** - How much you want
6. **Expiry** - Order expiration
7. **Salt** - Random number for uniqueness
8. **Chain ID**
9. **Private key**

## Example:

Selling 1 ETH for 3000 USDC:
```
Maker token: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (WETH)
Taker token: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
Maker amount: 1000000000000000000 (1 ETH)
Taker amount: 3000000000 (3000 USDC, 6 decimals)
```

## Order Types:

- **Limit order** - Execute at specific price or better
- **RFQ order** - Request for quote, specific taker
- **Partial fill** - Allow partial execution

Ready to create an order?
"""

# Using W0G (Wrapped 0G) with ChaosChain Facilitator

This guide explains how to use Wrapped 0G (W0G) tokens for x402 payments on the 0G Chain.

## What is W0G?

**W0G (Wrapped 0G)** is an ERC-20 token representation of the native 0G token, similar to how WETH wraps ETH on Ethereum.

- **Native 0G**: Gas token for 0G Chain (like ETH on Ethereum)
- **W0G**: ERC-20 token for DeFi and payments (like WETH)

**Key Details:**
- Contract: `0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c`
- Network: 0G Mainnet (Chain ID: 16661)
- Decimals: 18
- Symbol: W0G

---

## Why Use W0G Instead of Native 0G?

Native 0G cannot be used with x402 payments because:
- It's not an ERC-20 token (no contract address)
- Cannot be transferred programmatically like ERC-20
- x402 protocol requires ERC-20-compatible tokens

W0G solves this by wrapping native 0G into an ERC-20 token.

---

## How to Use W0G for Payments

### Step 1: Wrap Native 0G → W0G

Users need to convert native 0G to W0G before making payments.

**Via Contract Interaction:**
```javascript
// W0G Contract: 0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c
// Precompile: 0x0000000000000000000000000000000000001002

// Wrap 0G → W0G
const w0gContract = new ethers.Contract(
  '0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c',
  ['function mint(address minter, uint256 amount) external'],
  signer
);

// Mint (wrap) 10 W0G
await w0gContract.mint(userAddress, ethers.parseUnits('10', 18));
```

**Via 0G dApp (Recommended):**
- Visit 0G's official wrapping interface
- Connect wallet
- Enter amount to wrap
- Confirm transaction

### Step 2: Approve Facilitator (One-Time)

⚠️ **CRITICAL**: W0G uses the **relayer pattern** (not EIP-3009), so users must approve the facilitator before making payments.

```javascript
const w0gContract = new ethers.Contract(
  '0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c',
  ['function approve(address spender, uint256 amount) external'],
  signer
);

// Approve facilitator for unlimited W0G (one-time setup)
await w0gContract.approve(
  '0xFACILITATOR_ADDRESS',  // Get from facilitator logs
  ethers.MaxUint256
);
```

**Get Facilitator Address:**
```bash
curl https://facilitator.chaoscha.in/ | jq '.facilitatorAddress'
```

### Step 3: Make x402 Payments

Once approved, use W0G for payments normally:

```javascript
// Payment requirements from merchant
const requirements = {
  scheme: 'exact',
  network: '0g-mainnet',
  maxAmountRequired: '1000000000000000000', // 1 W0G (18 decimals)
  payTo: '0xMerchantAddress',
  asset: '0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c', // W0G
  resource: '/api/service',
};

// Create payment payload (SDK handles this)
const payment = await sdk.x402_payment_manager.create_payment(requirements);

// Make request with payment
const response = await fetch('https://merchant.api/service', {
  headers: {
    'X-PAYMENT': payment.header,
  },
});
```

### Step 4: Unwrap W0G → Native 0G (Optional)

Merchants can unwrap W0G back to native 0G if needed:

```javascript
const w0gContract = new ethers.Contract(
  '0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c',
  ['function burn(address minter, uint256 amount) external'],
  signer
);

// Burn (unwrap) 10 W0G → 10 native 0G
await w0gContract.burn(userAddress, ethers.parseUnits('10', 18));
```

---

## Key Differences: W0G vs USDC

| Feature | USDC (Base/Ethereum) | W0G (0G Chain) |
|---------|---------------------|----------------|
| **Settlement Method** | EIP-3009 | ERC-20 Relayer |
| **Gas for Payer** | ❌ None (gasless) | ✅ Yes (for approval only) |
| **Approval Needed** | ❌ No | ✅ Yes (one-time) |
| **Signature Type** | EIP-3009 authorization | Standard payment request |
| **User Experience** | Best (completely gasless) | Good (one-time approval) |

---

## Payment Flow Comparison

### USDC Flow (EIP-3009 - Gasless)
```
1. User signs payment authorization (off-chain, no gas)
2. Facilitator executes transferWithAuthorization (facilitator pays gas)
✅ User never needs to pay gas!
```

### W0G Flow (Relayer - Requires Approval)
```
1. User approves facilitator (on-chain, user pays gas once)
2. User creates payment request (off-chain)
3. Facilitator executes transferFrom (facilitator pays gas)
⚠️ User pays gas only once for approval
```

---

## Error Messages

### "Insufficient allowance"
**Cause:** User hasn't approved facilitator or approval amount is too low.

**Solution:**
```javascript
await w0gContract.approve(facilitatorAddress, ethers.MaxUint256);
```

### "Insufficient W0G balance"
**Cause:** User doesn't have enough W0G tokens.

**Solution:**
1. Check W0G balance: `await w0gContract.balanceOf(userAddress)`
2. Wrap more native 0G → W0G
3. Or get W0G from exchange

### "Token not available on 0g-mainnet"
**Cause:** Facilitator doesn't support the requested token.

**Solution:** Ensure you're using W0G (`0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c`), not native 0G.

---

## Network Configuration

**0G Mainnet Details:**
```
Chain ID: 16661
RPC URL: https://evmrpc.0g.ai
Block Explorer: https://chainscan.0g.ai
Native Token: 0G
Wrapped Token: W0G (0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c)
```

**Add to MetaMask:**
```javascript
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x4115', // 16661 in hex
    chainName: '0G Mainnet',
    nativeCurrency: {
      name: '0G',
      symbol: '0G',
      decimals: 18
    },
    rpcUrls: ['https://evmrpc.0g.ai'],
    blockExplorerUrls: ['https://chainscan.0g.ai']
  }]
});
```

---

## For Merchants: Accepting W0G Payments

### Enable 0G Support

Update your payment requirements to include `0g-mainnet`:

```javascript
const requirements = {
  scheme: 'exact',
  network: '0g-mainnet',  // Use 0G Chain
  maxAmountRequired: '1000000000000000000', // 1 W0G (18 decimals)
  payTo: YOUR_WALLET_ADDRESS,
  asset: '0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c', // W0G
  resource: '/api/service',
  description: 'AI Service on 0G',
};
```

### Receive W0G

When a payment is settled, you receive W0G (ERC-20 token) minus the 1% facilitator fee.

### Convert W0G to Native 0G

If you need native 0G for gas or withdrawals:

```javascript
// Unwrap W0G → native 0G
await w0gContract.burn(yourAddress, amount);
```

---

## FAQ

**Q: Do I need ETH on 0G Chain?**  
A: No! You only need native 0G for gas. There is no ETH on 0G Chain.

**Q: How much does it cost to approve the facilitator?**  
A: Approval costs ~0.001 native 0G in gas fees (one-time).

**Q: Can I use native 0G directly?**  
A: No. You must wrap it to W0G first because native tokens cannot be used with x402.

**Q: Is W0G secure?**  
A: Yes. W0G is deployed and maintained by 0G Foundation. See [0G docs](https://docs.0g.ai) for security details.

**Q: What's the W0G contract code?**  
A: View on [0G Explorer](https://chainscan.0g.ai/address/0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c)

**Q: Can I revoke the approval?**  
A: Yes, call `approve(facilitatorAddress, 0)` to revoke.

---

## Resources

- **0G Documentation**: https://docs.0g.ai
- **W0G Contract**: https://chainscan.0g.ai/address/0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c
- **0G Explorer**: https://chainscan.0g.ai
- **Facilitator**: https://facilitator.chaoscha.in

---

## Support

Need help with W0G payments?
- **0G Community**: [Discord](https://discord.gg/0glabs)
- **GitHub Issues**: https://github.com/ChaosChain/chaoschain-x402/issues


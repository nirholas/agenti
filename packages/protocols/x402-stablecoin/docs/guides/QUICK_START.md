# X402 Quick Start Guide

Get up and running with X402 payments in 5 minutes.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([download](https://nodejs.org/))
- **pnpm** package manager (`npm install -g pnpm`)
- An Arbitrum wallet with some USDs tokens
- Basic familiarity with TypeScript/JavaScript

### Getting USDs Tokens (Testnet)

For testing, you can get USDs tokens on Arbitrum Sepolia:
1. Get testnet ETH from the [Arbitrum Sepolia faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)
2. Swap for USDs at [Sperax testnet DEX](https://app.sperax.io/)

---

## Installation

```bash
# Install the X402 SDK
pnpm add @x402/sdk

# Or with npm
npm install @x402/sdk

# Or with yarn
yarn add @x402/sdk
```

---

## Your First Payment in 10 Lines of Code

```typescript
import { createX402Client, StandardPayment } from '@x402/sdk';
import { privateKeyToAccount } from 'viem/accounts';

// 1. Set up your account
const account = privateKeyToAccount('0x...your-private-key');

// 2. Create the X402 client
const client = createX402Client({ chain: 'arbitrum', account });

// 3. Make a payment
const receipt = await client.pay({
  recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
  amount: '0.01', // $0.01 USDs
});

console.log(`Payment sent! TX: ${receipt.transactionHash}`);
```

That's it! You've just made your first X402 payment.

---

## Complete Working Example

Here's a fuller example that checks your balance, makes a payment, and verifies the yield:

```typescript
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Configuration
const USDS_ADDRESS = '0xD74f5255D557944cf7Dd0E45FF521520002D5748';

// Setup (replace with your private key)
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

const walletClient = createWalletClient({
  chain: arbitrum,
  transport: http(),
  account,
});

// Check balance
async function checkBalance(address: string): Promise<string> {
  const balance = await publicClient.readContract({
    address: USDS_ADDRESS,
    abi: [{ 
      name: 'balanceOf', 
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
  
  return formatUnits(balance, 18);
}

// Make payment
async function makePayment(recipient: string, amount: string) {
  const amountWei = parseUnits(amount, 18);
  
  const hash = await walletClient.writeContract({
    address: USDS_ADDRESS,
    abi: [{
      name: 'transfer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    }],
    functionName: 'transfer',
    args: [recipient as `0x${string}`, amountWei],
  });
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt;
}

// Run example
async function main() {
  console.log('🚀 X402 Quick Start\n');
  
  // 1. Check balance
  const balance = await checkBalance(account.address);
  console.log(`Balance: $${balance} USDs`);
  
  // 2. Make payment
  console.log('\nMaking payment of $0.01...');
  const receipt = await makePayment(
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
    '0.01'
  );
  console.log(`✅ Payment confirmed! TX: ${receipt.transactionHash}`);
  
  // 3. Check new balance
  const newBalance = await checkBalance(account.address);
  console.log(`New balance: $${newBalance} USDs`);
}

main().catch(console.error);
```

---

## Environment Setup

Create a `.env` file in your project root:

```bash
# .env
PRIVATE_KEY=0x...your-private-key-here
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

**⚠️ Security Warning:** Never commit your private key to version control. Use environment variables or a secrets manager in production.

---

## Handling HTTP 402 Responses

X402's main use case is handling HTTP 402 "Payment Required" responses:

```typescript
import { fetchWith402Handling } from '@x402/sdk/http';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Automatically handles 402 responses with payments
const response = await fetchWith402Handling(
  'https://api.example.com/paid-endpoint',
  {
    method: 'GET',
  },
  {
    account,
    chain: 'arbitrum',
    maxAmount: '1.00', // Maximum you're willing to pay
  }
);

const data = await response.json();
console.log('API response:', data);
```

---

## What's Next?

Now that you've made your first payment, explore more advanced topics:

| Guide | Description |
|-------|-------------|
| [AI Agent Integration](./AI_AGENT_INTEGRATION.md) | Set up Claude/GPT to make autonomous payments |
| [Express Middleware](./EXPRESS_MIDDLEWARE.md) | Protect your API routes with 402 payment gates |
| [Smart Contract Integration](./SMART_CONTRACT_INTEGRATION.md) | Interact with X402 contracts directly |
| [Yield Tracking](./YIELD_TRACKING.md) | Monitor and claim USDs auto-yield earnings |

---

## Troubleshooting

### "Insufficient balance" error

Ensure your wallet has enough USDs tokens. Check your balance:

```typescript
const balance = await checkBalance(account.address);
console.log(`Balance: $${balance}`);
```

### "Transaction failed" error

Common causes:
1. **Insufficient gas**: Ensure you have ETH for gas fees
2. **Approval needed**: For some operations, you need to approve the contract first
3. **Network congestion**: Try increasing gas limit

### "Invalid recipient" error

Ensure the recipient address:
- Starts with `0x`
- Is exactly 42 characters long
- Is a valid Ethereum address

### RPC connection issues

Try using a different RPC endpoint:

```typescript
const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http('https://arb-mainnet.g.alchemy.com/v2/YOUR-API-KEY'),
});
```

---

## Resources

- [X402 GitHub Repository](https://github.com/nirholas/x402)
- [API Reference](/docs/API_REFERENCE.md)
- [Architecture Overview](/docs/ARCHITECTURE.md)
- [Sperax USDs Documentation](https://docs.sperax.io/)
- [Arbitrum Documentation](https://docs.arbitrum.io/)

---

## Getting Help

- **Discord**: Join our [community server](https://discord.gg/x402)
- **GitHub Issues**: [Report bugs or request features](https://github.com/nirholas/x402/issues)
- **Twitter**: Follow [@x402protocol](https://twitter.com/x402protocol) for updates

---

*Happy building! 🚀*

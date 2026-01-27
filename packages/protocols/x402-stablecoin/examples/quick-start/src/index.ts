/**
 * X402 Quick Start Example
 * 
 * This example demonstrates:
 * 1. Checking USDs balance
 * 2. Making a payment
 * 3. Verifying yield earned
 */

import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ============================================
// Configuration
// ============================================

const USDS_ADDRESS = '0xD74f5255D557944cf7Dd0E45FF521520002D5748' as const;

const USDS_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'creditBalanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'creditBalance', type: 'uint256' },
      { name: 'creditsPerToken', type: 'uint256' },
    ],
  },
  {
    name: 'rebasingCreditsPerTokenHighres',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ============================================
// Main Example
// ============================================

async function main() {
  console.log('🚀 X402 Quick Start Example\n');

  // Create a public client for reading data
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http(),
  });

  // Example address (replace with your address)
  const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f3bF97';

  // ============================================
  // 1. Check USDs Balance
  // ============================================
  
  console.log('📊 Checking USDs Balance...\n');

  try {
    const balance = await publicClient.readContract({
      address: USDS_ADDRESS,
      abi: USDS_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    console.log(`Balance: $${formatUnits(balance, 18)} USDs`);

    // ============================================
    // 2. Check Yield Earned
    // ============================================

    const [creditBalance, creditsPerToken] = await publicClient.readContract({
      address: USDS_ADDRESS,
      abi: USDS_ABI,
      functionName: 'creditBalanceOf',
      args: [address as `0x${string}`],
    });

    const currentCreditsPerToken = await publicClient.readContract({
      address: USDS_ADDRESS,
      abi: USDS_ABI,
      functionName: 'rebasingCreditsPerTokenHighres',
    });

    // Calculate yield earned
    const currentValue = (creditBalance * 10n ** 18n) / currentCreditsPerToken;
    const originalValue = (creditBalance * 10n ** 18n) / creditsPerToken;
    const yieldEarned = currentValue - originalValue;

    console.log(`Credit Balance: ${creditBalance.toString()}`);
    console.log(`Yield Earned: $${formatUnits(yieldEarned, 18)} USDs\n`);

  } catch (error) {
    console.log('Note: This is a demo. In production, use a real address with USDs.\n');
  }

  // ============================================
  // 3. Example Payment (commented out for safety)
  // ============================================

  console.log('💸 Payment Example (dry run):\n');
  console.log(`
  // To make a payment, you would:
  
  const privateKey = process.env.PRIVATE_KEY;
  const account = privateKeyToAccount(privateKey);
  
  const walletClient = createWalletClient({
    chain: arbitrum,
    transport: http(),
    account,
  });
  
  const txHash = await walletClient.writeContract({
    address: USDS_ADDRESS,
    abi: USDS_ABI,
    functionName: 'transfer',
    args: [recipientAddress, parseUnits('1.00', 18)],
  });
  
  console.log('Payment sent:', txHash);
  `);

  // ============================================
  // 4. Summary
  // ============================================

  console.log('\n✅ Quick Start Complete!\n');
  console.log('Next steps:');
  console.log('1. Get testnet USDs from Sperax');
  console.log('2. Configure your .env with PRIVATE_KEY');
  console.log('3. Run the facilitator server: pnpm facilitator:dev');
  console.log('4. Start accepting X402 payments!\n');
}

main().catch(console.error);

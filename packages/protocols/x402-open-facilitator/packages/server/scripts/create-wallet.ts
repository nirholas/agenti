/**
 * One-off script to create a wallet for an existing user
 * Usage: npx tsx scripts/create-wallet.ts <user-id>
 */
import 'dotenv/config';
import { initializeDatabase } from '../src/db/index.js';
import { generateWalletForUser } from '../src/services/wallet.js';

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: npx tsx scripts/create-wallet.ts <user-id>');
  console.error('Example: npx tsx scripts/create-wallet.ts od8l3YewFK2YGutq0K3099UjK0fD3HLt');
  process.exit(1);
}

// Initialize database
initializeDatabase();

// Create wallet
const result = await generateWalletForUser(userId);

if (result.created) {
  console.log('✅ Wallet created successfully!');
} else {
  console.log('ℹ️  Wallet already exists');
}

console.log(`   Address: ${result.address}`);
console.log(`   Network: solana`);

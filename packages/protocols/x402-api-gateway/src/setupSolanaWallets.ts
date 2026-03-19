/**
 * Solana Wallet Setup Script
 * 
 * This script checks and initializes USDC Associated Token Accounts (ATAs) for all
 * wallets involved in x402 payments: Client, Merchant, and Facilitator.
 * 
 * Usage:
 *   npm run setup:solana
 * 
 * Environment variables used:
 *   - SOLANA_CLIENT_PRIVATE_KEY: Client wallet private key (for paying setup fees)
 *   - PAYMENT_ADDRESS: Merchant wallet address (receives payments)
 *   - SVM_PRIVATE_KEY: Facilitator wallet private key
 *   - NETWORK: Network to use (solana-devnet or solana)
 */

import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { base58 } from '@scure/base';
import dotenv from 'dotenv';

dotenv.config();

// USDC mint addresses
const USDC_MINTS: Record<string, string> = {
  'solana-devnet': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Devnet uses mainnet USDC mint for testing
  'solana': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

// RPC endpoints
const RPC_ENDPOINTS: Record<string, string> = {
  'solana-devnet': 'https://api.devnet.solana.com',
  'solana': 'https://api.mainnet-beta.solana.com',
};

interface WalletInfo {
  name: string;
  address: string;
  keypair?: Keypair;
  solBalance: number;
  hasAta: boolean;
  ataAddress?: string;
  usdcBalance: number;
}

/**
 * Decode a private key from various formats
 */
function decodePrivateKey(key: string): Uint8Array {
  // Try JSON array format
  if (key.startsWith('[')) {
    try {
      const bytes = JSON.parse(key);
      if (Array.isArray(bytes) && bytes.every(b => typeof b === 'number')) {
        return new Uint8Array(bytes);
      }
    } catch {
      // Not valid JSON
    }
  }

  // Try base58 format
  try {
    return base58.decode(key);
  } catch {
    // Not base58
  }

  // Try hex format
  let hexKey = key;
  if (hexKey.startsWith('0x')) {
    hexKey = hexKey.slice(2);
  }
  if (/^[0-9a-fA-F]+$/.test(hexKey) && hexKey.length === 128) {
    const bytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      bytes[i] = parseInt(hexKey.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  throw new Error('Could not decode private key. Supported formats: JSON array, Base58, Hex');
}

/**
 * Get Keypair from private key bytes
 */
function getKeypair(privateKeyBytes: Uint8Array): Keypair {
  if (privateKeyBytes.length === 64) {
    return Keypair.fromSecretKey(privateKeyBytes);
  } else if (privateKeyBytes.length === 32) {
    // Just the secret key, need to derive full keypair
    // For simplicity, we'll require full 64-byte keypair
    throw new Error('Please provide a full 64-byte Solana keypair');
  }
  throw new Error(`Invalid key length: ${privateKeyBytes.length}. Expected 64 bytes.`);
}

/**
 * Format SOL balance for display
 */
function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

/**
 * Format USDC balance for display (6 decimals)
 */
function formatUsdc(amount: number): string {
  return (amount / 1_000_000).toFixed(2);
}

/**
 * Check wallet status
 */
async function checkWallet(
  connection: Connection,
  name: string,
  address: string,
  usdcMint: PublicKey,
  keypair?: Keypair
): Promise<WalletInfo> {
  const pubkey = new PublicKey(address);
  
  // Get SOL balance
  const solBalance = await connection.getBalance(pubkey);
  
  // Get ATA address
  const ataAddress = await getAssociatedTokenAddress(usdcMint, pubkey);
  
  // Check if ATA exists
  let hasAta = false;
  let usdcBalance = 0;
  
  try {
    const ataAccount = await getAccount(connection, ataAddress);
    hasAta = true;
    usdcBalance = Number(ataAccount.amount);
  } catch {
    // ATA doesn't exist
  }
  
  return {
    name,
    address,
    keypair,
    solBalance,
    hasAta,
    ataAddress: ataAddress.toBase58(),
    usdcBalance,
  };
}

/**
 * Create ATA for a wallet
 */
async function createAta(
  connection: Connection,
  payer: Keypair,
  owner: PublicKey,
  usdcMint: PublicKey
): Promise<string> {
  const ataAddress = await getAssociatedTokenAddress(usdcMint, owner);
  
  const instruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ataAddress,
    owner,
    usdcMint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  
  const transaction = new Transaction().add(instruction);
  
  const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
  
  return signature;
}

/**
 * Print wallet status
 */
function printWalletStatus(wallet: WalletInfo): void {
  console.log(`\n📍 ${wallet.name}`);
  console.log(`   Address: ${wallet.address}`);
  console.log(`   SOL Balance: ${formatSol(wallet.solBalance)} SOL ${wallet.solBalance < 0.01 * LAMPORTS_PER_SOL ? '⚠️  Low!' : '✅'}`);
  console.log(`   USDC ATA: ${wallet.hasAta ? '✅ Exists' : '❌ Missing'}`);
  if (wallet.hasAta) {
    console.log(`   USDC Balance: ${formatUsdc(wallet.usdcBalance)} USDC`);
  }
}

async function main() {
  console.log('🔧 Solana Wallet Setup Tool');
  console.log('============================\n');
  
  // Determine network
  const network = process.env.NETWORK || 'solana-devnet';
  const isDevnet = network.includes('devnet');
  
  console.log(`🌐 Network: ${network}`);
  
  const rpcUrl = process.env.SOLANA_RPC_URL || RPC_ENDPOINTS[network];
  if (!rpcUrl) {
    console.error(`❌ Unknown network: ${network}`);
    console.error('   Supported: solana-devnet, solana');
    process.exit(1);
  }
  
  console.log(`🔗 RPC: ${rpcUrl}`);
  
  const usdcMintAddress = USDC_MINTS[network];
  if (!usdcMintAddress) {
    console.error(`❌ No USDC mint configured for ${network}`);
    process.exit(1);
  }
  
  const usdcMint = new PublicKey(usdcMintAddress);
  console.log(`💵 USDC Mint: ${usdcMintAddress}`);
  
  const connection = new Connection(rpcUrl, 'confirmed');
  
  // Collect wallet information
  const wallets: WalletInfo[] = [];
  let payerKeypair: Keypair | undefined;
  
  // 1. Client wallet (from SOLANA_CLIENT_PRIVATE_KEY)
  if (process.env.SOLANA_CLIENT_PRIVATE_KEY) {
    try {
      const keyBytes = decodePrivateKey(process.env.SOLANA_CLIENT_PRIVATE_KEY);
      const keypair = getKeypair(keyBytes);
      payerKeypair = keypair; // Use client as payer for ATA creation
      
      const wallet = await checkWallet(
        connection,
        'Client Wallet',
        keypair.publicKey.toBase58(),
        usdcMint,
        keypair
      );
      wallets.push(wallet);
    } catch (error) {
      console.error('⚠️  Could not load SOLANA_CLIENT_PRIVATE_KEY:', error instanceof Error ? error.message : error);
    }
  } else {
    console.log('ℹ️  SOLANA_CLIENT_PRIVATE_KEY not set - skipping client wallet');
  }
  
  // 2. Merchant wallet (from PAYMENT_ADDRESS)
  if (process.env.PAYMENT_ADDRESS) {
    try {
      const wallet = await checkWallet(
        connection,
        'Merchant Wallet (PAYMENT_ADDRESS)',
        process.env.PAYMENT_ADDRESS,
        usdcMint
      );
      wallets.push(wallet);
    } catch (error) {
      console.error('⚠️  Could not check PAYMENT_ADDRESS:', error instanceof Error ? error.message : error);
    }
  } else {
    console.log('ℹ️  PAYMENT_ADDRESS not set - skipping merchant wallet');
  }
  
  // 3. Facilitator wallet (from SVM_PRIVATE_KEY)
  if (process.env.SVM_PRIVATE_KEY) {
    try {
      const keyBytes = decodePrivateKey(process.env.SVM_PRIVATE_KEY);
      const keypair = getKeypair(keyBytes);
      
      // If no payer set yet, use facilitator
      if (!payerKeypair) {
        payerKeypair = keypair;
      }
      
      const wallet = await checkWallet(
        connection,
        'Facilitator Wallet (SVM_PRIVATE_KEY)',
        keypair.publicKey.toBase58(),
        usdcMint,
        keypair
      );
      wallets.push(wallet);
    } catch (error) {
      console.error('⚠️  Could not load SVM_PRIVATE_KEY:', error instanceof Error ? error.message : error);
    }
  } else {
    console.log('ℹ️  SVM_PRIVATE_KEY not set - skipping facilitator wallet');
  }
  
  if (wallets.length === 0) {
    console.error('\n❌ No wallets configured! Set at least one of:');
    console.error('   - SOLANA_CLIENT_PRIVATE_KEY (client wallet)');
    console.error('   - PAYMENT_ADDRESS (merchant wallet address)');
    console.error('   - SVM_PRIVATE_KEY (facilitator wallet)');
    process.exit(1);
  }
  
  // Print current status
  console.log('\n📊 Current Wallet Status');
  console.log('========================');
  
  for (const wallet of wallets) {
    printWalletStatus(wallet);
  }
  
  // Find wallets missing ATAs
  const missingAtas = wallets.filter(w => !w.hasAta);
  
  if (missingAtas.length === 0) {
    console.log('\n\n✅ All wallets have USDC ATAs!');
    
    // Check for low balances
    const lowSol = wallets.filter(w => w.solBalance < 0.01 * LAMPORTS_PER_SOL);
    const lowUsdc = wallets.filter(w => w.name.includes('Client') && w.usdcBalance < 1_000_000);
    
    if (lowSol.length > 0 || lowUsdc.length > 0) {
      console.log('\n⚠️  Warnings:');
      for (const w of lowSol) {
        console.log(`   - ${w.name} has low SOL balance (${formatSol(w.solBalance)} SOL)`);
        if (isDevnet) {
          console.log(`     Get devnet SOL: https://faucet.solana.com`);
        }
      }
      for (const w of lowUsdc) {
        console.log(`   - ${w.name} has low USDC balance (${formatUsdc(w.usdcBalance)} USDC)`);
        if (isDevnet) {
          console.log(`     Get devnet USDC: https://spl-token-faucet.com`);
        }
      }
    }
    
    console.log('\n🎉 Setup complete! You can now run Solana payments.');
    return;
  }
  
  // Create missing ATAs
  console.log(`\n\n🔨 Creating ${missingAtas.length} missing ATA(s)...`);
  
  if (!payerKeypair) {
    console.error('\n❌ No payer wallet available to create ATAs!');
    console.error('   Set SOLANA_CLIENT_PRIVATE_KEY or SVM_PRIVATE_KEY with a funded wallet.');
    console.error('\n   Alternative: Create ATAs manually using spl-token CLI:');
    for (const w of missingAtas) {
      console.error(`   spl-token create-account ${usdcMintAddress} --owner ${w.address}`);
    }
    process.exit(1);
  }
  
  // Check payer has enough SOL
  const payerBalance = await connection.getBalance(payerKeypair.publicKey);
  const estimatedCost = missingAtas.length * 0.003 * LAMPORTS_PER_SOL; // ~0.003 SOL per ATA
  
  if (payerBalance < estimatedCost) {
    console.error(`\n❌ Payer wallet doesn't have enough SOL!`);
    console.error(`   Balance: ${formatSol(payerBalance)} SOL`);
    console.error(`   Needed: ~${formatSol(estimatedCost)} SOL`);
    if (isDevnet) {
      console.error(`\n   Get devnet SOL: https://faucet.solana.com`);
      console.error(`   Address: ${payerKeypair.publicKey.toBase58()}`);
    }
    process.exit(1);
  }
  
  console.log(`💳 Payer: ${payerKeypair.publicKey.toBase58()}`);
  console.log(`   Balance: ${formatSol(payerBalance)} SOL`);
  
  for (const wallet of missingAtas) {
    console.log(`\n   Creating ATA for ${wallet.name}...`);
    try {
      const owner = new PublicKey(wallet.address);
      const signature = await createAta(connection, payerKeypair, owner, usdcMint);
      console.log(`   ✅ Created! TX: ${signature}`);
      
      if (isDevnet) {
        console.log(`   🔗 https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      } else {
        console.log(`   🔗 https://explorer.solana.com/tx/${signature}`);
      }
    } catch (error) {
      console.error(`   ❌ Failed:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log('\n\n✅ ATA setup complete!');
  
  // Final reminders
  console.log('\n📝 Next steps:');
  if (isDevnet) {
    console.log('   1. Get devnet USDC for the client wallet:');
    console.log('      https://spl-token-faucet.com');
    console.log('   2. Ensure facilitator has SOL for transaction fees:');
    console.log('      https://faucet.solana.com');
  } else {
    console.log('   1. Transfer USDC to the client wallet');
    console.log('   2. Ensure facilitator has SOL for transaction fees');
  }
  console.log('   3. Run your x402 server: npm run dev');
  console.log('   4. Run Solana test: npm run test:solana');
}

main().catch((error) => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});


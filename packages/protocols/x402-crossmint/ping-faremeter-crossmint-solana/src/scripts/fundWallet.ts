import "dotenv/config";
import { readFile } from "fs/promises";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from "@solana/spl-token";
import { checkWalletSetup } from "../utils/checkWalletSetup.js";

/**
 * Helper script to fund a wallet with SOL and USDC on devnet
 * This is useful for testing the keypair wallet adapter
 */

const rpcUrl = process.env.RPC_URL;
const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;

if (!payerKeypairPath || !rpcUrl) {
  throw new Error("PAYER_KEYPAIR_PATH and RPC_URL must be set");
}

// Read keypair
const keypairData = await readFile(payerKeypairPath, "utf-8");
const secretKey = Uint8Array.from(JSON.parse(keypairData));
const keypair = Keypair.fromSecretKey(secretKey);

const connection = new Connection(rpcUrl, "confirmed");

console.log("\n=== Wallet Funding Helper ===");
console.log(`Wallet: ${keypair.publicKey.toBase58()}`);
console.log(`Network: devnet\n`);

// USDC devnet mint
const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// Check current wallet status
console.log("Current wallet status:");
await checkWalletSetup(connection, keypair.publicKey, USDC_MINT);

console.log("\n=== Funding Instructions ===\n");

// Check SOL balance
const solBalance = await connection.getBalance(keypair.publicKey);
if (solBalance < 100000000) {
  // Less than 0.1 SOL
  console.log("1️⃣  Get SOL for transaction fees:");
  console.log(`   solana airdrop 1 ${keypair.publicKey.toBase58()} --url devnet`);
  console.log(`   Or use: https://faucet.solana.com/\n`);
}

// Check if token account exists and has balance
try {
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair, // Fee payer
    USDC_MINT,
    keypair.publicKey,
    true, // allowOwnerOffCurve
  );

  console.log("2️⃣  Get USDC tokens:");
  console.log(`   Token Account: ${tokenAccount.address.toBase58()}`);
  console.log(`   Get devnet USDC from:`);
  console.log(`   - https://spl-token-faucet.com/?token-name=USDC-Dev`);
  console.log(`   - Select "USDC" and paste your wallet address\n`);

  const balance = await connection.getTokenAccountBalance(tokenAccount.address);
  console.log(`   Current USDC balance: ${balance.value.uiAmount || 0} USDC`);

  if (Number(balance.value.amount) === 0) {
    console.log(`\n   ⚠️  Your token account exists but has 0 balance!`);
    console.log(`   Use the faucet above to get some devnet USDC.`);
  } else {
    console.log(`\n   ✅ Wallet is funded and ready!`);
  }
} catch (error) {
  console.error("\n❌ Error creating/checking token account:", error);
  console.log(
    "\nMake sure you have enough SOL for the transaction fee to create the account."
  );
}

console.log("\n=== Quick Test Command ===");
console.log("Once funded, test your wallet with:");
console.log("npm run build && npm run start:keypair\n");

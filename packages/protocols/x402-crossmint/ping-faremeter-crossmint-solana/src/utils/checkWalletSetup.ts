import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

/**
 * Checks if a wallet is properly set up for making payments
 * - Has SOL balance for fees
 * - Has a token account for the specified mint
 * - Has sufficient token balance
 */
export async function checkWalletSetup(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey,
  minimumTokenAmount: number = 0
) {
  console.log("\n=== Wallet Setup Check ===");
  console.log(`Wallet: ${walletPublicKey.toBase58()}`);
  console.log(`Token Mint: ${mint.toBase58()}`);

  // Check SOL balance
  const solBalance = await connection.getBalance(walletPublicKey);
  console.log(`\nSOL Balance: ${solBalance / 1e9} SOL`);

  if (solBalance === 0) {
    console.error("❌ Wallet has no SOL for transaction fees!");
    console.log(`   Get devnet SOL from: https://faucet.solana.com/`);
    console.log(`   Or use: solana airdrop 2 ${walletPublicKey.toBase58()} --url devnet`);
    return false;
  } else {
    console.log("✅ SOL balance sufficient for fees");
  }

  // Check token account
  try {
    const tokenAccount = await getAssociatedTokenAddress(
      mint,
      walletPublicKey,
      true // allowOwnerOffCurve
    );

    console.log(`\nToken Account: ${tokenAccount.toBase58()}`);

    try {
      const accountInfo = await getAccount(connection, tokenAccount);
      const tokenBalance = Number(accountInfo.amount);
      const decimals = 6; // USDC has 6 decimals
      const uiAmount = tokenBalance / Math.pow(10, decimals);

      console.log(`Token Balance: ${tokenBalance} (${uiAmount} USDC)`);

      if (tokenBalance === 0) {
        console.error("❌ Token account exists but has 0 balance!");
        console.log(`   Fund your wallet with USDC on devnet:`);
        console.log(`   - Use https://spl-token-faucet.com/ for devnet USDC`);
        console.log(`   - Or swap SOL for USDC on devnet DEX`);
        return false;
      } else if (tokenBalance < minimumTokenAmount) {
        console.error(`❌ Token balance too low! Need at least ${minimumTokenAmount}`);
        return false;
      } else {
        console.log("✅ Token account has sufficient balance");
        return true;
      }
    } catch (accountError: any) {
      if (accountError.message?.includes("could not find account")) {
        console.error("❌ Token account does not exist!");
        console.log(`\n   To create the token account, run:`);
        console.log(`   spl-token create-account ${mint.toBase58()} --owner ${walletPublicKey.toBase58()} --url devnet`);
        console.log(`\n   Or the account will be auto-created when you receive tokens.`);
        return false;
      }
      throw accountError;
    }
  } catch (error) {
    console.error("❌ Error checking token account:", error);
    return false;
  }
}

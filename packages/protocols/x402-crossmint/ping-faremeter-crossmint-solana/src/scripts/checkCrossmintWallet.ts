import "dotenv/config";

/**
 * Script to check the Crossmint wallet configuration and explore API capabilities.
 */

const crossmintApiKey = process.env.CROSSMINT_API_KEY;
const crossmintWallet = process.env.CROSSMINT_WALLET;
const environment = process.env.CROSSMINT_ENVIRONMENT ?? "staging";

if (!crossmintApiKey || !crossmintWallet) {
  console.error("Missing CROSSMINT_API_KEY or CROSSMINT_WALLET");
  process.exit(1);
}

const baseUrl =
  environment === "production"
    ? "https://www.crossmint.com/api"
    : "https://staging.crossmint.com/api";

console.log("\n=== Crossmint Wallet Investigation ===\n");

try {
  // Get wallet details
  console.log("Fetching wallet configuration...");
  const walletUrl = `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(crossmintWallet)}`;
  const response = await fetch(walletUrl, {
    headers: {
      "X-API-KEY": crossmintApiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch wallet: ${response.status} ${await response.text()}`);
  }

  const wallet = await response.json();

  console.log("\nWallet Configuration:");
  console.log(JSON.stringify(wallet, null, 2));

  console.log("\n=== Analysis ===");
  const adminSignerType = wallet.config?.adminSigner?.type || "None";
  const adminSignerAddress = wallet.config?.adminSigner?.address || "N/A";
  console.log(`\nAdmin Signer: ${adminSignerType}`);
  if (adminSignerAddress !== "N/A") {
    console.log(`Admin Signer Address: ${adminSignerAddress}`);
  }
  console.log(`Delegated Signers: ${wallet.config?.delegatedSigners?.length || 0}`);

  // Check if admin signer is API-key type (bad for delegated signing)
  if (wallet.config?.adminSigner?.type === "api-key") {
    console.log("\n⚠️  ISSUE IDENTIFIED:");
    console.log("Your wallet has an API-key admin signer.");
    console.log("When an API-key admin signer exists, Crossmint uses it by default.");
    console.log("\nFor true delegated signing, you need:");
    console.log("1. An admin signer of type 'external-wallet', OR");
    console.log("2. Only delegated signers (no admin signer)");
    console.log("\nRecommendation: Create a new wallet with external-wallet admin signer:");
    console.log("  npm run create:wallet");
  } else if (wallet.config?.adminSigner?.type === "external-wallet") {
    console.log("\n✅ GOOD CONFIGURATION:");
    console.log("Your wallet has an external-wallet admin signer.");
    console.log("This means YOU control signing with your private key!");
    console.log("\nYour wallet is ready for delegated signing.");
  }

  if (wallet.config?.delegatedSigners?.length > 0) {
    console.log("\nDelegated signers configured:");
    wallet.config.delegatedSigners.forEach((signer: any, i: number) => {
      console.log(`  ${i + 1}. ${signer.type}: ${signer.address}`);
    });
  }

  console.log("\n=== Next Steps ===");

  if (wallet.config?.adminSigner?.type === "external-wallet") {
    console.log("\nYour wallet is configured correctly!");
    console.log("\n1. Make sure wallet is funded:");
    console.log("   - SOL for transaction fees (airdrop via solana CLI)");
    console.log("   - USDC for payments (get from faucet)");
    console.log("\n2. Test delegated signing:");
    console.log("   npm run start:delegated");
  } else if (wallet.config?.adminSigner?.type === "api-key") {
    console.log("\nOption 1: Create new wallet with external-wallet admin:");
    console.log("  npm run create:wallet");
    console.log("\nOption 2: Use this wallet in custodial mode:");
    console.log("  npm run start:test");
  } else {
    console.log("\nContact Crossmint support for assistance with wallet configuration.");
  }

} catch (error) {
  console.error("\nError:", error);
  process.exit(1);
}

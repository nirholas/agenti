import "dotenv/config";
import { readFile } from "fs/promises";
import { Keypair } from "@solana/web3.js";

/**
 * Script to create a new Crossmint smart wallet with ONLY delegated signing.
 * This wallet will NOT have an admin signer, so all transactions require external approval.
 */

const crossmintApiKey = process.env.CROSSMINT_API_KEY;
const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;
const environment = process.env.CROSSMINT_ENVIRONMENT ?? "staging";

if (!crossmintApiKey || !payerKeypairPath) {
  console.error("Missing required environment variables:");
  console.error("  - CROSSMINT_API_KEY");
  console.error("  - PAYER_KEYPAIR_PATH");
  process.exit(1);
}

const baseUrl =
  environment === "production"
    ? "https://www.crossmint.com/api"
    : "https://staging.crossmint.com/api";

const network = environment === "production" ? "solana-mainnet" : "solana-devnet";

console.log("\n=== Create Crossmint Delegated Wallet ===\n");
console.log(`Environment: ${environment}`);
console.log(`Network: ${network}`);
console.log(`API Base URL: ${baseUrl}\n`);

try {
  // Step 1: Read the keypair to get the public key
  console.log("Step 1: Reading external signer keypair...");
  const keypairData = await readFile(payerKeypairPath, "utf-8");
  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairData)));
  const externalSignerPublicKey = keypair.publicKey.toBase58();

  console.log(`✅ External Signer Public Key: ${externalSignerPublicKey}\n`);

  // Step 2: Create wallet with external wallet as admin signer (for delegated signing)
  console.log("Step 2: Creating wallet with delegated signing...");
  const createWalletUrl = `${baseUrl}/2025-06-09/wallets`;

  const ownerEmail = process.env.CROSSMINT_OWNER_EMAIL || "user@example.com";

  const createWalletBody = {
    chainType: "solana",
    type: "smart",
    config: {
      adminSigner: {
        type: "external-wallet",
        address: externalSignerPublicKey,
      },
    },
    owner: `email:${ownerEmail}`,
  };

  console.log("\nRequest payload:");
  console.log(JSON.stringify(createWalletBody, null, 2));
  console.log();

  const createResponse = await fetch(createWalletUrl, {
    method: "POST",
    headers: {
      "X-API-KEY": crossmintApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createWalletBody),
  });

  const createText = await createResponse.text();
  let createJson: any;

  try {
    createJson = JSON.parse(createText);
  } catch {
    createJson = createText;
  }

  if (!createResponse.ok) {
    console.error(`❌ Failed to create wallet: ${createResponse.status} ${createResponse.statusText}`);
    console.error("Response:", createJson);

    if (createJson?.message?.includes("evm")) {
      console.error("\n⚠️  ISSUE: The Crossmint wallet creation API only supports EVM chains.");
      console.error("Solana wallet creation via API is not currently available.");
      console.error("\n=== Alternative Solutions ===\n");
      console.error("Option 1: Create wallet via Crossmint Console");
      console.error("  1. Go to https://staging.crossmint.com/console/wallets");
      console.error("  2. Click 'Create Wallet'");
      console.error("  3. Select 'Solana' as the chain");
      console.error("  4. Configure with ONLY external signers (no admin signer)");
      console.error(`  5. Add external signer: ${externalSignerPublicKey}`);
      console.error("  6. Copy the wallet address to your .env as CROSSMINT_WALLET");
      console.error("\nOption 2: Contact Crossmint Support");
      console.error("  Ask them to create a Solana smart wallet with delegated signing only.");
      console.error(`  Provide your external signer address: ${externalSignerPublicKey}`);
      console.error("\nOption 3: Use your existing wallet in custodial mode");
      console.error("  npm run start:test");
    } else {
      console.error("\nPossible reasons:");
      console.error("  - API key doesn't have wallet creation permissions");
      console.error("  - Delegated signing not enabled for your Crossmint account");
      console.error("  - Invalid wallet configuration");
      console.error("\nContact Crossmint support for assistance.");
    }
    process.exit(1);
  }

  console.log("✅ Wallet created successfully!\n");
  console.log("Full response:");
  console.log(JSON.stringify(createJson, null, 2));
  console.log();

  // Step 3: Extract wallet address
  const walletAddress = createJson.address || createJson.publicKey || createJson.id;

  if (walletAddress) {
    console.log("\n=== SUCCESS ===\n");
    console.log("Your new delegated wallet:");
    console.log(`  Address: ${walletAddress}`);
    console.log(`  External Signer: ${externalSignerPublicKey}`);
    console.log(`  Network: ${network}`);
    console.log();
    console.log("Add this to your .env file:");
    console.log(`  CROSSMINT_WALLET=${walletAddress}`);
    console.log();
    console.log("Next steps:");
    console.log("  1. Update CROSSMINT_WALLET in .env");
    console.log("  2. Fund the wallet with SOL and USDC:");
    console.log(`     npm run fund:wallet`);
    console.log("  3. Test delegated signing:");
    console.log("     npm run start:delegated");
  } else {
    console.log("\n⚠️  Wallet created but address not found in response.");
    console.log("Check the response above for wallet details.");
  }

} catch (error) {
  console.error("\n❌ Wallet creation failed:", error);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}

import "dotenv/config";
import { readFile } from "fs/promises";
import { Keypair } from "@solana/web3.js";

/**
 * Setup script to add external signer to Crossmint smart wallet.
 * This enables delegated signing mode.
 */

const crossmintApiKey = process.env.CROSSMINT_API_KEY;
const crossmintWallet = process.env.CROSSMINT_WALLET;
const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;
const environment = process.env.CROSSMINT_ENVIRONMENT ?? "staging";

if (!crossmintApiKey || !crossmintWallet || !payerKeypairPath) {
  console.error("Missing required environment variables:");
  console.error("  - CROSSMINT_API_KEY");
  console.error("  - CROSSMINT_WALLET");
  console.error("  - PAYER_KEYPAIR_PATH");
  process.exit(1);
}

const baseUrl =
  environment === "production"
    ? "https://www.crossmint.com/api"
    : "https://staging.crossmint.com/api";

console.log("\n=== Crossmint Delegated Wallet Setup ===\n");
console.log(`Environment: ${environment}`);
console.log(`Wallet: ${crossmintWallet}`);
console.log(`API Base URL: ${baseUrl}\n`);

try {
  // Step 1: Read the keypair to get the public key
  console.log("Step 1: Reading external signer keypair...");
  const keypairData = await readFile(payerKeypairPath, "utf-8");
  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairData)));
  const externalSignerPublicKey = keypair.publicKey.toBase58();

  console.log(`✅ External Signer Public Key: ${externalSignerPublicKey}\n`);

  // Step 2: Check current wallet configuration
  console.log("Step 2: Checking current wallet configuration...");
  const walletUrl = `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(crossmintWallet)}`;
  const walletResponse = await fetch(walletUrl, {
    method: "GET",
    headers: {
      "X-API-KEY": crossmintApiKey,
      "Content-Type": "application/json",
    },
  });

  if (!walletResponse.ok) {
    const errorText = await walletResponse.text();
    console.error(`❌ Failed to get wallet info: ${walletResponse.status} ${walletResponse.statusText}`);
    console.error(`Response: ${errorText}`);
    process.exit(1);
  }

  const walletInfo = await walletResponse.json();
  console.log("Current wallet info:");
  console.log(JSON.stringify(walletInfo, null, 2));
  console.log();

  // Step 3: Add external signer
  console.log("Step 3: Adding external signer to wallet...");
  const signersUrl = `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(crossmintWallet)}/signers`;
  const addSignerResponse = await fetch(signersUrl, {
    method: "POST",
    headers: {
      "X-API-KEY": crossmintApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      signer: `external-wallet:${externalSignerPublicKey}`,
    }),
  });

  const addSignerText = await addSignerResponse.text();
  let addSignerJson: any;

  try {
    addSignerJson = JSON.parse(addSignerText);
  } catch {
    addSignerJson = addSignerText;
  }

  if (!addSignerResponse.ok) {
    console.error(`❌ Failed to add signer: ${addSignerResponse.status} ${addSignerResponse.statusText}`);
    console.error(`Response:`, addSignerJson);

    // Check if signer already exists
    if (addSignerResponse.status === 400 || addSignerResponse.status === 409) {
      console.log("\n⚠️  The signer might already be added. Let's verify...\n");
    } else {
      process.exit(1);
    }
  } else {
    console.log("✅ External signer added successfully!");
    console.log("Response:", JSON.stringify(addSignerJson, null, 2));
    console.log();
  }

  // Step 4: Verify the signer was added
  console.log("Step 4: Verifying signer configuration...");
  const verifyWalletResponse = await fetch(walletUrl, {
    method: "GET",
    headers: {
      "X-API-KEY": crossmintApiKey,
      "Content-Type": "application/json",
    },
  });

  if (verifyWalletResponse.ok) {
    const updatedWalletInfo = await verifyWalletResponse.json();
    console.log("Updated wallet info:");
    console.log(JSON.stringify(updatedWalletInfo, null, 2));
    console.log();

    // Check if signer is in the response
    const signers = (updatedWalletInfo as any).signers || [];
    const hasExternalSigner = signers.some((s: any) =>
      s.address === externalSignerPublicKey ||
      s.locator?.includes(externalSignerPublicKey)
    );

    if (hasExternalSigner) {
      console.log("✅ External signer is configured!");
    } else {
      console.log("⚠️  External signer not found in wallet configuration.");
      console.log("You may need to contact Crossmint support to enable delegated signing.");
    }
  }

  console.log("\n=== Setup Complete ===\n");
  console.log("Your wallet is now configured for delegated signing.");
  console.log("You can test it with:");
  console.log("  npm run start:delegated\n");

} catch (error) {
  console.error("\n❌ Setup failed:", error);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}

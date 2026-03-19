import "dotenv/config";
import { Connection, PublicKey } from "@solana/web3.js";
import { createCrossmintDelegatedWallet } from "../wallets/crossmintExternalDelegatedWallet.js";
import { lookupKnownSPLToken, type KnownCluster } from "@faremeter/info/solana";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";
import { wrap as wrapFetch } from "@faremeter/fetch";
import { logResponse } from "../logger.js";
import { checkWalletSetup } from "../utils/checkWalletSetup.js";

const smartWalletAddress = process.env.CROSSMINT_WALLET;
const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;
const crossmintApiKey = process.env.CROSSMINT_API_KEY;
const environment = (process.env.CROSSMINT_ENVIRONMENT as "staging" | "production") ?? "staging";
const rpcUrl = process.env.RPC_URL;

if (!smartWalletAddress || !payerKeypairPath || !crossmintApiKey || !rpcUrl) {
  throw new Error(
    "Missing required environment variables:\n" +
    "  - CROSSMINT_WALLET (smart wallet address)\n" +
    "  - PAYER_KEYPAIR_PATH (path to external signer keypair)\n" +
    "  - CROSSMINT_API_KEY (Crossmint API key)\n" +
    "  - RPC_URL (Solana RPC endpoint)"
  );
}

console.log("=== Crossmint Delegated Wallet Example ===\n");

// Create wallet using Crossmint delegated signing
// Using PAYER_KEYPAIR_PATH to provide the external signer
const wallet = await createCrossmintDelegatedWallet({
  smartWalletAddress,
  externalPrivateKey: payerKeypairPath, // Can be file path or base58 string
  apiKey: crossmintApiKey,
  environment,
  polling: {
    maxAttempts: 30,
    delayMs: 1000,
  },
});

console.log(`\nWallet public key: ${wallet.publicKey.toBase58()}`);

// Setup Solana connection and token info
const network = (process.env.NETWORK || (environment === "production" ? "mainnet-beta" : "devnet")) as KnownCluster;
const splTokenName = "USDC";

const usdcInfo = lookupKnownSPLToken(network, splTokenName);
if (!usdcInfo) {
  throw new Error(`couldn't look up SPLToken ${splTokenName} on ${network}!`);
}

const connection = new Connection(rpcUrl);
const mint = new PublicKey(usdcInfo.address);

// Check if wallet is set up properly before attempting payment
console.log("\n=== Checking Wallet Setup ===");
const isSetup = await checkWalletSetup(connection, wallet.publicKey, mint, 10000); // Check for at least 0.01 USDC

if (!isSetup) {
  console.error("\n❌ Wallet is not properly set up for payments.");
  console.error("Please ensure your Crossmint smart wallet has:");
  console.error("  1. SOL for transaction fees");
  console.error("  2. USDC tokens for payments");
  console.error("\nYou can fund your wallet through the Crossmint dashboard.");
  process.exit(1);
}

console.log("\n✅ Wallet is ready for payments!\n");

// Create payment handler using the delegated wallet
const fetchWithPayer = wrapFetch(fetch, {
  handlers: [
    createPaymentHandler(wallet, mint, connection, {
      features: {
        enableSettlementAccounts: true,
      },
      token: {
        allowOwnerOffCurve: true,
      },
    }),
  ],
});

// Make a request that will use the delegated wallet for payment
console.log("=== Making Payment Request ===");
const resourceUrl = process.env.CROSSMINT_RESOURCE_URL ?? "http://127.0.0.1:3000/protected";
console.log(`Resource URL: ${resourceUrl}\n`);

const req = await fetchWithPayer(resourceUrl);

console.log("\n=== Payment Response ===");
await logResponse(req);

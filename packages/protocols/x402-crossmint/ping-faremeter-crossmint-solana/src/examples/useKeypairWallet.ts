import "dotenv/config";
import { readFile } from "fs/promises";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createKeypairWallet } from "../wallets/keypairWallet.js";
import { lookupKnownSPLToken } from "@faremeter/info/solana";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";
import { wrap as wrapFetch } from "@faremeter/fetch";
import { logResponse } from "../logger.js";

const rpcUrl = process.env.RPC_URL;
const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;

if (!payerKeypairPath || !rpcUrl) {
  throw new Error("PAYER_KEYPAIR_PATH and RPC_URL must be set in your environment");
}

// Read the keypair from the JSON file
const keypairData = await readFile(payerKeypairPath, "utf-8");
const secretKey = Uint8Array.from(JSON.parse(keypairData));
const keypair = Keypair.fromSecretKey(secretKey);

console.log(`Using wallet: ${keypair.publicKey.toBase58()}`);

const network = "devnet";
const splTokenName = "USDC";

const usdcInfo = lookupKnownSPLToken(network, splTokenName);
if (!usdcInfo) {
  throw new Error(`couldn't look up SPLToken ${splTokenName} on ${network}!`);
}

const connection = new Connection(rpcUrl);
const mint = new PublicKey(usdcInfo.address);

// Create wallet using our custom keypair adapter
const wallet = await createKeypairWallet(network, keypair);

// Check if wallet is set up properly before attempting payment
const { checkWalletSetup } = await import("../utils/checkWalletSetup.js");
const isSetup = await checkWalletSetup(connection, keypair.publicKey, mint, 10000); // Check for at least 0.01 USDC

if (!isSetup) {
  console.error("\n❌ Wallet is not properly set up for payments. Please fix the issues above and try again.");
  process.exit(1);
}

console.log("\n✅ Wallet is ready for payments!\n");

// Create payment handler using the custom wallet
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

// Make a request that will use the keypair wallet for payment
const req = await fetchWithPayer("http://127.0.0.1:3000/protected");

await logResponse(req);

import "dotenv/config";
import { logResponse } from "../logger";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createLocalWallet } from "@faremeter/wallet-solana";
import { lookupKnownSPLToken } from "@faremeter/info/solana";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";
import { wrap as wrapFetch } from "@faremeter/fetch";
import fs from "fs";
import { clusterApiUrl } from "@solana/web3.js";

const { PAYER_KEYPAIR_PATH } = process.env;

if (!PAYER_KEYPAIR_PATH) {
  throw new Error("PAYER_KEYPAIR_PATH must be set in your environment");
}

const network = "devnet";

const splTokenName = "USDC";

const usdcInfo = lookupKnownSPLToken(network, splTokenName);
if (!usdcInfo) {
  throw new Error(`couldn't look up SPLToken ${splTokenName} on ${network}!`);
}

const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(PAYER_KEYPAIR_PATH, "utf-8"))),
);

const connection = new Connection(clusterApiUrl(network));

const mint = new PublicKey(usdcInfo.address);
const wallet = await createLocalWallet(network, keypair);
const fetchWithPayer = wrapFetch(fetch, {
  handlers: [createPaymentHandler(wallet, mint, connection)],
});

const req = await fetchWithPayer("http://127.0.0.1:3000/protected");

await logResponse(req);

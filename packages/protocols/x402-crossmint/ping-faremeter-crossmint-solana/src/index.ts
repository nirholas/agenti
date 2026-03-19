import "dotenv/config";
import { logResponse } from "./logger.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { createCrossmintWallet } from "@faremeter/wallet-crossmint";
import { lookupKnownSPLToken } from "@faremeter/info/solana";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";
import { wrap as wrapFetch } from "@faremeter/fetch";

const crossmintWallet = process.env.CROSSMINT_WALLET;
const crossmintApi = process.env.CROSSMINT_API_KEY;
const rpcUrl = process.env.RPC_URL;

if (!crossmintWallet || !crossmintApi || !rpcUrl) {
  throw new Error("CROSSMINT_WALLET, CROSSMINT_API_KEY, and RPC_URL must be set in your environment");
}

const network = "devnet";

const splTokenName = "USDC";

const usdcInfo = lookupKnownSPLToken(network, splTokenName);
if (!usdcInfo) {
  throw new Error(`couldn't look up SPLToken ${splTokenName} on ${network}!`);
}

const connection = new Connection(rpcUrl);

const mint = new PublicKey(usdcInfo.address);
const wallet = await createCrossmintWallet(
  "devnet",
  crossmintApi,
  crossmintWallet,
);
const fetchWithPayer = wrapFetch(fetch, {
  handlers: [createPaymentHandler(wallet, mint, connection, {
    features: {
      enableSettlementAccounts: true,
    },
    token: {
      allowOwnerOffCurve: true,
    },
  })],
});

const req = await fetchWithPayer("http://127.0.0.1:3000/protected");

await logResponse(req);

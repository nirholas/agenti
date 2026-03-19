import "dotenv/config";
import { logResponse } from "../logger";
import { Keypair } from "@solana/web3.js";
import { createLocalWallet } from "@faremeter/wallet-solana";
import { createPaymentHandler } from "@faremeter/x-solana-settlement";
import { wrap as wrapFetch } from "@faremeter/fetch";
import { client } from "@faremeter/types";
import { normalizeNetworkId } from "@faremeter/info";
import fs from "fs";

const { PAYER_KEYPAIR_PATH } = process.env;

if (!PAYER_KEYPAIR_PATH) {
  throw new Error("PAYER_KEYPAIR_PATH must be set in your environment");
}

const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(PAYER_KEYPAIR_PATH, "utf-8"))),
);

const wallet = await createLocalWallet("devnet", keypair);

const fetchWithPayer = wrapFetch(fetch, {
  handlers: [
    client.adaptPaymentHandlerV1ToV2(
      createPaymentHandler(wallet),
      normalizeNetworkId,
    ),
  ],
});

const req = await fetchWithPayer("http://127.0.0.1:3000/protected");
await logResponse(req);

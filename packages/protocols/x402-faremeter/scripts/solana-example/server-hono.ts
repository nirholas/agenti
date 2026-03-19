import "dotenv/config";
import { logger } from "../logger";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createMiddleware } from "@faremeter/middleware/hono";
import { Keypair } from "@solana/web3.js";
import {
  lookupKnownSPLToken,
  x402Exact,
  xSolanaSettlement,
} from "@faremeter/info/solana";
import fs from "fs";

const { PAYTO_KEYPAIR_PATH } = process.env;

if (!PAYTO_KEYPAIR_PATH) {
  throw new Error("PAYTO_KEYPAIR_PATH must be set in your environment");
}

const payToKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(PAYTO_KEYPAIR_PATH, "utf-8"))),
);

const network = "devnet";
const splTokenName = "USDC";

const usdcInfo = lookupKnownSPLToken(network, splTokenName);
if (!usdcInfo) {
  throw new Error(`couldn't look up SPLToken ${splTokenName} on ${network}!`);
}

const payTo = payToKeypair.publicKey.toBase58();

const app = new Hono();

app.get(
  "/protected",
  await createMiddleware({
    facilitatorURL: "http://localhost:4000",
    accepts: [
      // USDC xSolanaSettlement Payment
      xSolanaSettlement({
        network,
        payTo,
        asset: "USDC",
        amount: "10000", // 0.01 USDC
      }),
      // Native SOL xSolanaSettlement Payment
      xSolanaSettlement({
        network,
        payTo,
        asset: "sol",
        amount: "1000000",
      }),
      // USDC Exact Payment
      x402Exact({
        network,
        asset: "USDC",
        amount: "10000", // 0.01 USDC
        payTo,
      }),
    ],
  }),
  (c) => {
    return c.json({
      msg: "success",
    });
  },
);

serve(app, (info) => {
  logger.info(`Listening on http://localhost:${info.port}`);
});

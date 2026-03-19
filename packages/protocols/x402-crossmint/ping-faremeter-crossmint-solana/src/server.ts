"use strict";
import "dotenv/config";
import "./logger.js";
import { default as express } from "express";
import { createMiddleware } from "@faremeter/middleware/express";
import {
  lookupKnownSPLToken,
  x402Exact,
  xSolanaSettlement,
  type KnownCluster,
} from "@faremeter/info/solana";
import { Keypair } from "@solana/web3.js";
import fs from "fs";

const { PAYTO_KEYPAIR_PATH } = process.env;

if (!PAYTO_KEYPAIR_PATH) {
  throw new Error("PAYTO_KEYPAIR_PATH must be set in your environment");
}

const payToKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(PAYTO_KEYPAIR_PATH, "utf-8"))),
);

const network = (process.env.NETWORK || "mainnet-beta") as KnownCluster;
const port = parseInt(process.env.PORT || "3000", 10);

const splTokenName = "USDC";

const usdcInfo = lookupKnownSPLToken(network, splTokenName);
if (!usdcInfo) {
  throw new Error(`couldn't look up SPLToken ${splTokenName} on ${network}!`);
}

const payTo = payToKeypair.publicKey.toBase58();

const run = async () => {
  const app = express();

  const facilitatorURL = process.env.FACILITATOR_URL || "http://localhost:4000";
  console.log(`Server starting on port ${port}`);
  console.log(`Network: ${network}`);
  console.log(`PayTo: ${payTo}`);
  console.log(`Facilitator URL: ${facilitatorURL}`);

  app.get(
    "/protected",
    await createMiddleware({
      facilitatorURL,
      accepts: [
        // // USDC xSolanaSettlement Payment
        // xSolanaSettlement({
        //   network,
        //   payTo,
        //   asset: "USDC",
        //   amount: "10000", // 0.01 USDC
        // }),
        // // Native SOL xSolanaSettlement Payment
        // xSolanaSettlement({
        //   network,
        //   payTo,
        //   asset: "sol",
        //   amount: "1000000",
        // }),
        // USDC Exact Payment
        x402Exact({
          network,
          asset: "USDC",
          amount: "10000", // 0.01 USDC,
          payTo,
        }),
      ],
    }),
    (_, res) => {
      res.json({
        msg: "success",
      });
    },
  );

  const server = app.listen(port);

  function shutdown() {
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

await run();

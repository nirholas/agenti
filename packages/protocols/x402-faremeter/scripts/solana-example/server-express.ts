import "dotenv/config";
import "../logger";
import { default as express } from "express";
import { createMiddleware } from "@faremeter/middleware/express";
import {
  lookupKnownSPLToken,
  x402Exact,
  xSolanaSettlement,
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

const network = "devnet";
const port = 3000;

const splTokenName = "USDC";

const usdcInfo = lookupKnownSPLToken(network, splTokenName);
if (!usdcInfo) {
  throw new Error(`couldn't look up SPLToken ${splTokenName} on ${network}!`);
}

const payTo = payToKeypair.publicKey.toBase58();

const run = async () => {
  const app = express();

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

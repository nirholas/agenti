import "dotenv/config";
import { logger } from "../logger";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

const { PAYER_KEYPAIR_PATH } = process.env;

if (!PAYER_KEYPAIR_PATH) {
  throw new Error("PAYER_KEYPAIR_PATH must be set in your environment");
}

const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(PAYER_KEYPAIR_PATH, "utf-8"))),
);

const { PAYTO_KEYPAIR_PATH } = process.env;

if (!PAYTO_KEYPAIR_PATH) {
  throw new Error("PAYTO_KEYPAIR_PATH must be set in your environment");
}

const payTo = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(PAYTO_KEYPAIR_PATH, "utf-8"))),
);

const decimals = 6;

const network = "devnet";
const connection = new Connection(clusterApiUrl(network), "confirmed");

const mint = await createMint(
  connection,
  payer,
  payer.publicKey,
  payer.publicKey,
  decimals,
);

logger.info(`Created new test token: ${mint.toString()}`);

async function sendMint(publicKey: PublicKey, amountToMint: number) {
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    publicKey,
  );

  await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer.publicKey,
    amountToMint,
  );

  logger.info(
    `Minted ${amountToMint} tokens for ${publicKey.toString()} to ${tokenAccount.address.toString()}`,
  );
}

const amountToMint = 1000000 * Math.pow(10, decimals);

await sendMint(payer.publicKey, amountToMint);
await sendMint(payTo.publicKey, amountToMint);

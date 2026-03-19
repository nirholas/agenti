import { logger } from "./logger";

import { createFacilitatorHandler as createSolanaHandler } from "@faremeter/x-solana-settlement/facilitator";
import { createFacilitatorHandler as createFacilitatorHandlerExact } from "@faremeter/payment-solana/exact";
import { adaptHandlerV1ToV2 } from "@faremeter/facilitator";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createSolanaRpc } from "@solana/kit";
import { isKnownCluster, lookupKnownSPLToken } from "@faremeter/info/solana";
import fs from "fs";
import type { FacilitatorHandler } from "@faremeter/types/facilitator";

export async function createHandlers(network: string, keypairPath: string) {
  if (!isKnownCluster(network)) {
    logger.error(`Solana network '${network}' is invalid`);
    process.exit(1);
  }

  const handlers: FacilitatorHandler[] = [];
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8"))),
  );
  const apiUrl = clusterApiUrl(network);
  const connection = new Connection(apiUrl, "confirmed");
  const rpc = createSolanaRpc(apiUrl);

  const usdcInfo = lookupKnownSPLToken(network, "USDC");
  if (!usdcInfo) {
    throw new Error(`Couldn't look up the USDC SPL Token on ${network}`);
  }

  const mint = new PublicKey(usdcInfo.address);

  // Add Solana handlers
  // Note: x-solana-settlement handlers use legacy v1 types and need to be adapted
  handlers.push(
    // SOL (v1 handler - adapted to v2)
    adaptHandlerV1ToV2(createSolanaHandler(network, connection, adminKeypair)),
    // SPL Token (v1 handler - adapted to v2)
    adaptHandlerV1ToV2(
      createSolanaHandler(network, connection, adminKeypair, mint),
    ),
    // SPL Token with exact scheme (native v2 handler)
    await createFacilitatorHandlerExact(network, rpc, adminKeypair, mint),
  );

  logger.info(`Solana handlers configured for ${network}`);
  return handlers;
}

import "dotenv/config";
import { logger } from "./logger";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { serve } from "@hono/node-server";
import { createFacilitatorRoutes } from "@faremeter/facilitator";

import { argsFromEnv } from "./utils";
import * as solana from "./solana";
import { createFacilitatorHandler as createEVMHandler } from "@faremeter/payment-evm/exact";
import * as evmChains from "viem/chains";

import { configureApp } from "@faremeter/logs";

await configureApp();

const solanaHandlers =
  (await argsFromEnv(["ADMIN_KEYPAIR_PATH"], (...envVars) =>
    solana.createHandlers("devnet", ...envVars),
  )) ?? [];

const evmHandlers =
  (await argsFromEnv(["EVM_PRIVATE_KEY"], async (privateKey) => [
    await createEVMHandler(evmChains.baseSepolia, privateKey, "USDC"),
  ])) ?? [];

const skaleHandlers =
  (await argsFromEnv(["EVM_PRIVATE_KEY"], async (privateKey) => [
    await createEVMHandler(evmChains.skaleEuropaTestnet, privateKey, "USDC"),
  ])) ?? [];

const monadHandlers =
  (await argsFromEnv(["EVM_PRIVATE_KEY"], async (privateKey) => [
    await createEVMHandler(evmChains.monadTestnet, privateKey, "USDC"),
  ])) ?? [];

const handlers = [
  ...solanaHandlers,
  ...evmHandlers,
  ...skaleHandlers,
  ...monadHandlers,
];

if (handlers.length === 0) {
  logger.error(
    "ERROR: No payment handlers configured.\n" +
      "   Set ADMIN_KEYPAIR_PATH for Solana\n" +
      "   Set EVM_PRIVATE_KEY for EVM",
  );
  process.exit(1);
}

const listenPort = process.env.PORT ? parseInt(process.env.PORT) : 4000;

const app = new Hono();
app.use(
  honoLogger((message: string, ...rest: string[]) => {
    logger.info([message, ...rest].join(" "));
  }),
);

app.route(
  "/",
  createFacilitatorRoutes({
    handlers,
    timeout: {
      getRequirements: 5000,
    },
  }),
);

serve({ fetch: app.fetch, port: listenPort }, (info) => {
  logger.info(`Facilitator server listening on port ${info.port}`);
  logger.info(`Active payment handlers: ${handlers.length}`);
  if (solanaHandlers.length > 0) {
    logger.info("   - Solana (SOL & SPL Token)");
  }
  if (evmHandlers.length > 0) {
    logger.info("   - EVM (Base Sepolia)");
  }
});

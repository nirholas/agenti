import "dotenv/config";
import { logger, logResponse } from "../logger";
import { createLocalWallet } from "@faremeter/wallet-evm";
import { createPaymentHandler } from "@faremeter/payment-evm/exact";
import { wrap as wrapFetch } from "@faremeter/fetch";
import { baseSepolia } from "viem/chains";

const { EVM_PRIVATE_KEY } = process.env;

if (!EVM_PRIVATE_KEY) {
  throw new Error("EVM_PRIVATE_KEY must be set in your environment");
}

// Parse command line arguments
const args = process.argv.slice(2);
const port = args[0] ?? "4021";
const endpoint = args[1] ?? "weather";
const url = `http://localhost:${port}/${endpoint}`;

logger.info("Creating wallet for Base Sepolia USDC payments...");
const wallet = await createLocalWallet(baseSepolia, EVM_PRIVATE_KEY);
logger.info(`Wallet address: ${wallet.address}`);

const fetchWithPayer = wrapFetch(fetch, {
  handlers: [createPaymentHandler(wallet)],
});

logger.info(`Making payment request to ${url}...`);
const req = await fetchWithPayer(url);
await logResponse(req);

import "dotenv/config";
import { logger } from "../logger";
import { default as express } from "express";
import { createMiddleware } from "@faremeter/middleware/express";
import { isAddress, Address } from "@faremeter/types/evm";
import { x402Exact } from "@faremeter/info/evm";

const { EVM_RECEIVING_ADDRESS, PORT } = process.env;

const payTo = EVM_RECEIVING_ADDRESS as Address;

if (!isAddress(payTo)) {
  throw new Error(
    "EVM_RECEIVING_ADDRESS must be set in your environment, and be a valid EVM address",
  );
}

const network = "skale-europa-testnet";
const port = PORT ? parseInt(PORT) : 4021;

const run = async () => {
  const app = express();

  app.get(
    "/weather",
    await createMiddleware({
      facilitatorURL: "http://localhost:4000",
      accepts: [
        {
          ...x402Exact({
            network,
            asset: "USDC",
            payTo,
            amount: "10000", // 0.01 USDC
          }),
          extra: {
            name: "USDC Forwarder", // Forwarder Domain Name
            verifyingContract: "0x7779B0d1766e6305E5f8081E3C0CDF58FcA24330", // EIP3009Forwarder.sol for USDC on SKALE Europa Testnet,
            version: "1",
          },
        },
      ],
    }),
    (_, res) => {
      res.json({
        temperature: 72,
        conditions: "sunny",
        message: "Thanks for your payment!",
      });
    },
  );

  const server = app.listen(port, () => {
    logger.info(`Resource server listening on port ${port}`);
  });

  function shutdown() {
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

await run();

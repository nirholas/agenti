import "dotenv/config";
import { logResponse } from "./logger";
import { payer } from "@faremeter/rides";

await payer.addLocalWallet(process.env.PAYER_KEYPAIR_PATH);
await payer.addLocalWallet(process.env.EVM_PRIVATE_KEY);

const req = await payer.fetch("http://localhost:3000/protected");

await logResponse(req);

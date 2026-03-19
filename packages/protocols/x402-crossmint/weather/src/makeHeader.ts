import axios from "axios";
import { createPaymentHeader } from "x402/client";
import { createSigner } from "x402/types";
import { Hex } from "viem";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").startsWith("0x")
  ? (process.env.PRIVATE_KEY as Hex)
  : ("0x" + (process.env.PRIVATE_KEY || "")) as Hex;
const TARGET = process.env.TARGET_URL || "http://localhost:3100/weather?city=San%20Francisco";

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error("Missing PRIVATE_KEY in .env");
    process.exit(1);
  }

  const resp = await axios.get(TARGET, {
    headers: { Accept: "application/json" },
    validateStatus: () => true,
  });

  if (resp.status !== 402) {
    console.error("Expected 402 from target; got:", resp.status);
    process.exit(1);
  }

  const accepts = resp.data?.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    console.error("No payment requirements in response");
    process.exit(1);
  }

  const paymentRequirements = accepts[0];

  const signer = await createSigner(paymentRequirements.network, PRIVATE_KEY);
  const header = await createPaymentHeader(signer, 1, paymentRequirements);

  process.stdout.write(header);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});



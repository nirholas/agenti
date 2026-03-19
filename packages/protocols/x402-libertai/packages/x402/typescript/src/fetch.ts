import { createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { createPaymentHeader } from "./sign.js";
import type { PaymentRequirements } from "./types.js";

export function wrapFetchWithPayment(privateKey: Hex): typeof fetch {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: base, transport: http() });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (input: any, init?: any) => {
    const req = new Request(input, init);
    if (req.headers.get("Authorization") === "Bearer x402") {
      req.headers.delete("Authorization");
    }

    const response = await fetch(req);
    if (response.status !== 402) return response;

    const body = await response.json();
    const requirements: PaymentRequirements = body.accepts?.[0];
    if (!requirements) {
      throw new Error("x402: 402 response missing accepts[0]");
    }

    const paymentHeader = await createPaymentHeader(
      account,
      publicClient,
      requirements,
    );

    const retryReq = new Request(input, init);
    if (retryReq.headers.get("Authorization") === "Bearer x402") {
      retryReq.headers.delete("Authorization");
    }
    retryReq.headers.set("X-PAYMENT", paymentHeader);
    return fetch(retryReq);
  };
}

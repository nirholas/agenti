import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import type { x402HTTPResourceServer } from "@x402/core/http";

import { createElysiaPaymentMiddleware } from "../../src/elysia/index.js";

describe("Elysia payment middleware", () => {
  it("applies payment processing and settlement headers", async () => {
    const paymentRequirements = {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0xtoken",
      amount: "1",
      payTo: "0xrecipient",
    };

    const paymentPayload = {
      x402Version: 2,
      accepted: paymentRequirements,
      payload: {
        signature: "0xsig",
        authorization: {},
      },
    };

    let settlementCalls = 0;

    const httpServer = {
      registerPaywallProvider: () => {},
      initialize: async () => {},
      processHTTPRequest: async () => ({
        type: "payment-verified",
        paymentPayload,
        paymentRequirements,
      }),
      processSettlement: async () => {
        settlementCalls += 1;
        return {
          success: true,
          headers: { "payment-response": "encoded" },
        };
      },
    } as unknown as x402HTTPResourceServer;

    const app = new Elysia()
      .use(
        createElysiaPaymentMiddleware({
          httpServer,
          syncFacilitatorOnStart: false,
        })
      )
      .get("/premium", ({ x402 }) => x402?.result.type ?? "none");

    const response = await app.handle(
      new Request("http://localhost/premium")
    );

    expect(await response.text()).toBe("payment-verified");
    expect(response.headers.get("payment-response")).toBe("encoded");
    expect(settlementCalls).toBe(1);
  });
});

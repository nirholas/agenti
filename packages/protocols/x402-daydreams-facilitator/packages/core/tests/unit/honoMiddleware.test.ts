import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import type { x402HTTPResourceServer } from "@x402/core/http";

import { createHonoPaymentMiddleware } from "../../src/hono/index.js";
import { createUptoModule } from "../../src/upto/module.js";

describe("Hono payment middleware", () => {
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

    const app = new Hono();

    app.use("/*", createHonoPaymentMiddleware({ httpServer }));

    app.get("/premium", (c) => {
      const x402 = c.get("x402");
      return c.text(x402?.result.type ?? "none");
    });

    const response = await app.request("/premium");

    expect(await response.text()).toBe("payment-verified");
    expect(response.headers.get("payment-response")).toBe("encoded");
    expect(settlementCalls).toBe(1);
  });

  it("returns 402 for payment-error responses", async () => {
    const httpServer = {
      registerPaywallProvider: () => {},
      initialize: async () => {},
      processHTTPRequest: async () => ({
        type: "payment-error",
        response: {
          status: 402,
          headers: { "content-type": "application/json" },
          body: { error: "Payment required" },
        },
      }),
      processSettlement: async () => ({ success: false, headers: {} }),
    } as unknown as x402HTTPResourceServer;

    const app = new Hono();
    app.use("/*", createHonoPaymentMiddleware({ httpServer }));
    app.get("/premium", (c) => c.text("should not reach"));

    const response = await app.request("/premium");

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body).toEqual({ error: "Payment required" });
  });

  it("skips settlement for upto scheme and adds session header", async () => {
    const paymentRequirements = {
      scheme: "upto",
      network: "eip155:8453",
      asset: "0xtoken",
      amount: "10",
      payTo: "0xrecipient",
    };

    const paymentPayload = {
      x402Version: 2,
      accepted: paymentRequirements,
      payload: {
        signature: "0xsig",
        authorization: {
          from: "0xuser",
          to: "0xspender",
          value: "100",
          nonce: "1",
          validBefore: String(Math.floor(Date.now() / 1000) + 3600),
        },
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
        return { success: true, headers: {} };
      },
    } as unknown as x402HTTPResourceServer;

    const storeMap = new Map();
    const store = {
      get: (id: string) => storeMap.get(id),
      set: (id: string, session: unknown) => storeMap.set(id, session),
      delete: (id: string) => storeMap.delete(id),
      entries: () => storeMap.entries(),
    };

    const facilitatorClient = {
      settle: async () => ({
        success: true,
        transaction: "",
        network: "eip155:8453",
        payer: undefined,
      }),
    };
    const upto = createUptoModule({ facilitatorClient, store, autoTrack: true });

    const app = new Hono();
    app.use(
      "/*",
      createHonoPaymentMiddleware({
        httpServer,
        upto,
      })
    );
    app.get("/premium", (c) => c.text("ok"));

    const response = await app.request("/premium");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-upto-session-id")).toBeTruthy();
    expect(settlementCalls).toBe(0);
  });

  it("does not settle when autoSettle is false", async () => {
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
        return { success: true, headers: {} };
      },
    } as unknown as x402HTTPResourceServer;

    const app = new Hono();
    app.use("/*", createHonoPaymentMiddleware({ httpServer, autoSettle: false }));
    app.get("/premium", (c) => c.text("ok"));

    await app.request("/premium");

    expect(settlementCalls).toBe(0);
  });
});

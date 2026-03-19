import { describe, it, expect, mock } from "bun:test";
import express from "express";
import type { x402HTTPResourceServer } from "@x402/core/http";

import { createExpressPaymentMiddleware } from "../../src/express/index.js";
import { createUptoModule } from "../../src/upto/module.js";
import type { ResourceTrackingModule } from "../../src/tracking/lib.js";

// Helper to make requests to express app
async function request(
  app: express.Application,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to get server address"));
        return;
      }

      const url = `http://127.0.0.1:${address.port}${path}`;
      fetch(url, options)
        .then((res) => {
          server.close();
          resolve(res);
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe("Express payment middleware", () => {
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

    const app = express();
    app.use(createExpressPaymentMiddleware({ httpServer }));
    app.get("/premium", (req, res) => {
      res.send(req.x402?.result.type ?? "none");
    });

    const response = await request(app, "/premium");

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

    const app = express();
    app.use(createExpressPaymentMiddleware({ httpServer }));
    app.get("/premium", (_req, res) => res.send("should not reach"));

    const response = await request(app, "/premium");

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body).toEqual({ error: "Payment required" });
  });

  it("finalizes tracking on payment-error responses", async () => {
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

    const finalizeTracking = mock(async () => {});
    const resourceTracking = {
      store: {} as unknown,
      captureHeaders: [],
      startTracking: mock(async () => "track-1"),
      recordRequest: mock(async () => {}),
      recordVerification: mock(async () => {}),
      recordSettlement: mock(async () => {}),
      recordUptoSession: mock(async () => {}),
      finalizeTracking,
      list: mock(async () => ({ records: [], total: 0, hasMore: false })),
      getStats: mock(async () => ({})),
      get: mock(async () => undefined),
      prune: mock(async () => 0),
    } as unknown as ResourceTrackingModule;

    const app = express();
    app.use(createExpressPaymentMiddleware({ httpServer, resourceTracking }));
    app.get("/premium", (_req, res) => res.send("should not reach"));

    const response = await request(app, "/premium");

    expect(response.status).toBe(402);
    expect(finalizeTracking.mock.calls.length).toBe(1);
    const [id, status, _responseTimeMs, handlerExecuted] =
      finalizeTracking.mock.calls[0];
    expect(id).toBe("track-1");
    expect(status).toBe(402);
    expect(handlerExecuted).toBe(false);
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

    const app = express();
    app.use(
      createExpressPaymentMiddleware({
        httpServer,
        upto,
      })
    );
    app.get("/premium", (_req, res) => res.send("ok"));

    const response = await request(app, "/premium");

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

    const app = express();
    app.use(createExpressPaymentMiddleware({ httpServer, autoSettle: false }));
    app.get("/premium", (_req, res) => res.send("ok"));

    await request(app, "/premium");

    expect(settlementCalls).toBe(0);
  });
});

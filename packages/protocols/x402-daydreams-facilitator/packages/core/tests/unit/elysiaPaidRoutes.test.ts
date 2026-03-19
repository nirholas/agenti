import { describe, it, expect } from "bun:test";

import {
  createPaidRoutes,
  createElysiaPaidRoutes,
} from "../../src/elysia/paidRoutes.js";
import type { x402ResourceServer } from "@x402/core/server";

describe("createPaidRoutes", () => {
  it("stores payment configs with base path and param normalization", () => {
    const paid = createPaidRoutes({ basePath: "/api" });

    paid.get("/upto-session/:id", () => "ok", {
      payment: {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          payTo: "0xrecipient",
          price: "$0.01",
        },
      },
    });

    const routes = paid.routes as Record<string, unknown>;
    expect(routes["GET /api/upto-session/[id]"]).toBeDefined();
  });

  it("strips payment config before registering routes", () => {
    const paid = createPaidRoutes({ basePath: "/api" });

    paid.get("/premium", () => "ok", {
      payment: {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          payTo: "0xrecipient",
          price: "$0.01",
        },
      },
      beforeHandle: () => undefined,
    });

    const calls: Array<{ path: string; hook?: Record<string, unknown> }> = [];
    const app = {
      get: (path: string, _handler: unknown, hook?: Record<string, unknown>) => {
        calls.push({ path, hook });
        return app;
      },
    };

    paid.apply(app);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/premium");
    expect(calls[0]?.hook?.payment).toBeUndefined();
    expect(typeof calls[0]?.hook?.beforeHandle).toBe("function");
  });

  it("throws on duplicate payment config registration", () => {
    const paid = createPaidRoutes({ basePath: "/api" });

    paid.get("/premium", () => "ok", {
      payment: {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          payTo: "0xrecipient",
          price: "$0.01",
        },
      },
    });

    expect(() =>
      paid.get("/premium", () => "ok", {
        payment: {
          accepts: {
            scheme: "exact",
            network: "eip155:8453",
            payTo: "0xrecipient",
            price: "$0.01",
          },
        },
      })
    ).toThrow("Duplicate payment config for GET /api/premium");
  });
});

describe("createElysiaPaidRoutes", () => {
  it("registers middleware once and collects payment configs", () => {
    const calls: Array<{ path: string; hook?: Record<string, unknown> }> = [];
    let useCalls = 0;

    const app = {
      use: (_plugin: unknown) => {
        useCalls += 1;
        return app;
      },
      get: (path: string, _handler: unknown, hook?: Record<string, unknown>) => {
        calls.push({ path, hook });
        return app;
      },
    };

    const resourceServer = {} as unknown as x402ResourceServer;

    const paid = createElysiaPaidRoutes(app, {
      basePath: "/api",
      middleware: {
        resourceServer,
        syncFacilitatorOnStart: false,
      },
    });

    paid.get("/premium", () => "ok", {
      payment: {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          payTo: "0xrecipient",
          price: "$0.01",
        },
      },
      beforeHandle: () => undefined,
    });

    expect(useCalls).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/premium");
    expect(calls[0]?.hook?.payment).toBeUndefined();
    expect(typeof calls[0]?.hook?.beforeHandle).toBe("function");
    expect(
      (paid.routes as Record<string, unknown>)["GET /api/premium"]
    ).toBeDefined();
  });
});

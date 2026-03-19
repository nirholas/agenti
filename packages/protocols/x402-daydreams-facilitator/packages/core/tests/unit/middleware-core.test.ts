import { describe, it, expect, mock } from "bun:test";
import {
  isUptoModule,
  normalizePathCandidate,
  resolveUrl,
  parseQueryParams,
  resolveHeaderWithAliases,
  resolveRoutes,
  resolveHttpServer,
  resolvePaywallConfig,
  DEFAULT_PAYMENT_HEADER_ALIASES,
  processBeforeHandle,
  processAfterHandle,
  type BasePaymentMiddlewareConfig,
} from "../../src/middleware/core.js";
import type { UptoModule } from "../../src/upto/lib.js";
import type { ResourceTrackingModule } from "../../src/tracking/lib.js";
import type {
  HTTPAdapter,
  HTTPProcessResult,
  x402HTTPResourceServer,
} from "@x402/core/http";
import type { FacilitatorClient } from "@x402/core/server";

const createMockUptoModule = (): UptoModule =>
  ({
    store: {
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve()),
      entries: mock(() => [][Symbol.iterator]()),
    },
    createSweeper: mock(() => ({})),
    settleSession: mock(() => Promise.resolve({ success: true })),
    autoSweeper: false,
    autoTrack: true,
  }) as unknown as UptoModule;

const createMockFacilitatorClient = (): FacilitatorClient =>
  ({
    verify: mock(() => Promise.resolve({ isValid: true })),
    settle: mock(() => Promise.resolve({ success: true })),
    supported: mock(() => Promise.resolve({ supported: true })),
  }) as unknown as FacilitatorClient;

describe("isUptoModule", () => {
  it("returns true for valid UptoModule", () => {
    const module = createMockUptoModule();
    expect(isUptoModule(module)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isUptoModule(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isUptoModule(undefined)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isUptoModule("not a module")).toBe(false);
  });

  it("returns false for object without createSweeper", () => {
    expect(
      isUptoModule({
        settleSession: mock(() => Promise.resolve()),
      })
    ).toBe(false);
  });

  it("returns false for object without settleSession", () => {
    expect(
      isUptoModule({
        createSweeper: mock(() => ({})),
      })
    ).toBe(false);
  });

  it("returns false for object with non-function createSweeper", () => {
    expect(
      isUptoModule({
        createSweeper: "not a function",
        settleSession: mock(() => Promise.resolve()),
      })
    ).toBe(false);
  });
});

describe("normalizePathCandidate", () => {
  it("adds leading slash when missing", () => {
    expect(normalizePathCandidate("api/users")).toBe("/api/users");
  });

  it("keeps existing leading slash", () => {
    expect(normalizePathCandidate("/api/users")).toBe("/api/users");
  });

  it("handles empty string", () => {
    expect(normalizePathCandidate("")).toBe("/");
  });

  it("handles root path", () => {
    expect(normalizePathCandidate("/")).toBe("/");
  });
});

describe("resolveUrl", () => {
  it("parses absolute HTTP URL", () => {
    const url = resolveUrl("http://example.com/path");
    expect(url.hostname).toBe("example.com");
    expect(url.pathname).toBe("/path");
  });

  it("parses absolute HTTPS URL", () => {
    const url = resolveUrl("https://example.com/path");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("example.com");
  });

  it("uses localhost for relative URL", () => {
    const url = resolveUrl("/api/users");
    expect(url.hostname).toBe("localhost");
    expect(url.pathname).toBe("/api/users");
  });

  it("handles URL with query params", () => {
    const url = resolveUrl("https://example.com/path?foo=bar");
    expect(url.pathname).toBe("/path");
    expect(url.searchParams.get("foo")).toBe("bar");
  });
});

describe("parseQueryParams", () => {
  it("parses single value params", () => {
    const url = new URL("http://localhost?foo=bar&baz=qux");
    const params = parseQueryParams(url);
    expect(params.foo).toBe("bar");
    expect(params.baz).toBe("qux");
  });

  it("parses multiple values for same key", () => {
    const url = new URL("http://localhost?items=a&items=b&items=c");
    const params = parseQueryParams(url);
    expect(params.items).toEqual(["a", "b", "c"]);
  });

  it("returns empty object for no params", () => {
    const url = new URL("http://localhost/path");
    const params = parseQueryParams(url);
    expect(Object.keys(params)).toHaveLength(0);
  });

  it("handles mixed single and multiple values", () => {
    const url = new URL("http://localhost?single=one&multi=a&multi=b");
    const params = parseQueryParams(url);
    expect(params.single).toBe("one");
    expect(params.multi).toEqual(["a", "b"]);
  });
});

describe("resolveHeaderWithAliases", () => {
  it("returns direct header value when present", () => {
    const getHeader = (name: string) =>
      name === "payment-signature" ? "direct-value" : null;

    const result = resolveHeaderWithAliases(
      getHeader,
      "payment-signature",
      ["x-payment"]
    );

    expect(result).toBe("direct-value");
  });

  it("falls back to alias for payment-signature", () => {
    const getHeader = (name: string) =>
      name === "x-payment" ? "alias-value" : null;

    const result = resolveHeaderWithAliases(
      getHeader,
      "payment-signature",
      ["x-payment"]
    );

    expect(result).toBe("alias-value");
  });

  it("returns undefined when no header found", () => {
    const getHeader = () => null;

    const result = resolveHeaderWithAliases(
      getHeader,
      "payment-signature",
      ["x-payment"]
    );

    expect(result).toBeUndefined();
  });

  it("does not use alias for non-payment-signature headers", () => {
    const getHeader = (name: string) =>
      name === "x-payment" ? "alias-value" : null;

    const result = resolveHeaderWithAliases(
      getHeader,
      "other-header",
      ["x-payment"]
    );

    expect(result).toBeUndefined();
  });

  it("tries multiple aliases in order", () => {
    const getHeader = (name: string) =>
      name === "x-pay" ? "second-alias" : null;

    const result = resolveHeaderWithAliases(
      getHeader,
      "payment-signature",
      ["x-payment", "x-pay"]
    );

    expect(result).toBe("second-alias");
  });
});

describe("DEFAULT_PAYMENT_HEADER_ALIASES", () => {
  it("includes x-payment", () => {
    expect(DEFAULT_PAYMENT_HEADER_ALIASES).toContain("x-payment");
  });
});

describe("resolveRoutes", () => {
  it("returns routes directly when provided", () => {
    const routes = { "/api": { price: "0.01", network: "eip155:8453" } };
    const config: BasePaymentMiddlewareConfig = { routes };

    const result = resolveRoutes(config, "Test");

    expect(result).toBe(routes);
  });

  it("calls routesResolver when routes not provided", () => {
    const routes = { "/api": { price: "0.01", network: "eip155:8453" } };
    const routesResolver = mock(() => routes);
    const config: BasePaymentMiddlewareConfig = { routesResolver };

    const result = resolveRoutes(config, "Test");

    expect(result).toBe(routes);
    expect(routesResolver).toHaveBeenCalled();
  });

  it("throws when routesResolver returns null", () => {
    const routesResolver = mock(() => null as unknown);
    const config: BasePaymentMiddlewareConfig = {
      routesResolver: routesResolver as () => null,
    };

    expect(() => resolveRoutes(config, "Test")).toThrow(
      "Test payment middleware requires routes from routesResolver"
    );
  });

  it("throws when neither routes nor routesResolver provided", () => {
    const config: BasePaymentMiddlewareConfig = {};

    expect(() => resolveRoutes(config, "Test")).toThrow(
      "Test payment middleware requires routes"
    );
  });
});

describe("resolveHttpServer", () => {
  it("returns existing httpServer when provided", () => {
    const httpServer = { processHTTPRequest: mock(() => ({})) };
    const config: BasePaymentMiddlewareConfig = {
      httpServer: httpServer as unknown as BasePaymentMiddlewareConfig["httpServer"],
    };

    const result = resolveHttpServer(config, "Test");

    expect(result).toBe(httpServer);
  });

  it("throws when no resourceServer or facilitatorClient", () => {
    const config: BasePaymentMiddlewareConfig = {
      routes: { "/api": { price: "0.01", network: "eip155:8453" } },
    };

    expect(() => resolveHttpServer(config, "Test")).toThrow(
      "Test payment middleware requires a resourceServer or facilitatorClient"
    );
  });

  it("creates httpServer from resourceServer when provided", () => {
    const resourceServer = {
      verify: mock(() => Promise.resolve({ isValid: true })),
    };
    const config: BasePaymentMiddlewareConfig = {
      routes: { "/api": { price: "0.01", network: "eip155:8453" } },
      resourceServer: resourceServer as unknown as BasePaymentMiddlewareConfig["resourceServer"],
    };

    const result = resolveHttpServer(config, "Test");

    expect(result).toBeDefined();
  });

  it("creates httpServer from facilitatorClient when provided", () => {
    const facilitatorClient = createMockFacilitatorClient();
    const config: BasePaymentMiddlewareConfig = {
      routes: { "/api": { price: "0.01", network: "eip155:8453" } },
      facilitatorClient,
    };

    const result = resolveHttpServer(config, "Test");

    expect(result).toBeDefined();
  });
});

describe("resolvePaywallConfig", () => {
  it("returns undefined for undefined source", async () => {
    const result = await resolvePaywallConfig(undefined, {});
    expect(result).toBeUndefined();
  });

  it("returns object source directly", async () => {
    const paywallConfig = { title: "Pay Now" };
    const result = await resolvePaywallConfig(paywallConfig, {});
    expect(result).toEqual(paywallConfig);
  });

  it("calls function source with context", async () => {
    const paywallConfig = { title: "Pay Now" };
    const fn = mock(() => paywallConfig);
    const ctx = { request: {} };

    const result = await resolvePaywallConfig(fn, ctx);

    expect(result).toEqual(paywallConfig);
    expect(fn).toHaveBeenCalledWith(ctx);
  });

  it("handles async function source", async () => {
    const paywallConfig = { title: "Pay Now" };
    const fn = mock(() => Promise.resolve(paywallConfig));
    const ctx = { request: {} };

    const result = await resolvePaywallConfig(fn, ctx);

    expect(result).toEqual(paywallConfig);
  });
});

const createMockAdapter = (): HTTPAdapter =>
  ({
    getPath: () => "/free",
    getMethod: () => "GET",
    getUrl: () => "http://localhost/free",
    getHeader: () => null,
    getUserAgent: () => "test-agent",
    getQueryParams: () => ({}),
    getAcceptHeader: () => "application/json",
  }) as unknown as HTTPAdapter;

describe("resource tracking integration", () => {
  it("updates paymentRequired for non-paywall responses", async () => {
    const adapter = createMockAdapter();
    const httpServer = {
      processHTTPRequest: async () =>
        ({ type: "payment-not-required" } as unknown as HTTPProcessResult),
    } as unknown as x402HTTPResourceServer;

    const recordRequest = mock(async () => {});
    const resourceTracking = {
      store: {} as unknown,
      captureHeaders: [],
      startTracking: mock(async () => "track-1"),
      recordRequest,
      recordVerification: mock(async () => {}),
      recordSettlement: mock(async () => {}),
      recordUptoSession: mock(async () => {}),
      finalizeTracking: mock(async () => {}),
      list: mock(async () => ({ records: [], total: 0, hasMore: false })),
      getStats: mock(async () => ({})),
      get: mock(async () => undefined),
      prune: mock(async () => 0),
    } as unknown as ResourceTrackingModule;

    const result = await processBeforeHandle({
      httpServer,
      adapter,
      paywallConfig: undefined,
      uptoModule: undefined,
      autoTrack: false,
      resourceTracking,
    });

    expect(result.action).toBe("continue");
    expect(recordRequest.mock.calls.length).toBe(1);
    const [id, updates] = recordRequest.mock.calls[0];
    expect(id).toBe("track-1");
    expect(updates.paymentRequired).toBe(false);
  });

  it("does not throw when tracking hooks fail in processBeforeHandle", async () => {
    const adapter = createMockAdapter();
    const httpServer = {
      processHTTPRequest: async () =>
        ({
          type: "payment-verified",
          paymentPayload: {},
          paymentRequirements: {
            scheme: "exact",
            network: "eip155:1",
            asset: "0xtoken",
            amount: "1",
            payTo: "0xrecipient",
          },
        }) as unknown as HTTPProcessResult,
    } as unknown as x402HTTPResourceServer;

    const resourceTracking = {
      store: {} as unknown,
      captureHeaders: [],
      startTracking: mock(async () => {
        throw new Error("tracking boom");
      }),
      recordRequest: mock(async () => {
        throw new Error("tracking boom");
      }),
      recordVerification: mock(async () => {
        throw new Error("tracking boom");
      }),
      recordSettlement: mock(async () => {
        throw new Error("tracking boom");
      }),
      recordUptoSession: mock(async () => {
        throw new Error("tracking boom");
      }),
      finalizeTracking: mock(async () => {
        throw new Error("tracking boom");
      }),
      list: mock(async () => ({ records: [], total: 0, hasMore: false })),
      getStats: mock(async () => ({})),
      get: mock(async () => undefined),
      prune: mock(async () => 0),
    } as unknown as ResourceTrackingModule;

    await expect(
      processBeforeHandle({
        httpServer,
        adapter,
        paywallConfig: undefined,
        uptoModule: undefined,
        autoTrack: false,
        resourceTracking,
      })
    ).resolves.toMatchObject({ action: "continue" });
  });

  it("honors handlerExecuted when finalizing tracking", async () => {
    const httpServer = {
      processSettlement: async () => ({ success: true, headers: {} }),
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

    const state = {
      result: {
        type: "payment-error",
        response: {
          status: 402,
          headers: {},
          body: {},
        },
      } as unknown as HTTPProcessResult,
      resourceTrackingId: "track-1",
    };

    await processAfterHandle({
      httpServer,
      state,
      autoSettle: true,
      resourceTracking,
      responseStatus: 402,
      startTimeMs: Date.now(),
      handlerExecuted: false,
    });

    expect(finalizeTracking.mock.calls.length).toBe(1);
    const [id, status, _responseTimeMs, handlerExecuted] =
      finalizeTracking.mock.calls[0];
    expect(id).toBe("track-1");
    expect(status).toBe(402);
    expect(handlerExecuted).toBe(false);
  });

  it("does not throw when tracking hooks fail in processAfterHandle", async () => {
    const httpServer = {
      processSettlement: async () => ({ success: true, headers: {} }),
    } as unknown as x402HTTPResourceServer;

    const resourceTracking = {
      store: {} as unknown,
      captureHeaders: [],
      startTracking: mock(async () => "track-1"),
      recordRequest: mock(async () => {}),
      recordVerification: mock(async () => {}),
      recordSettlement: mock(async () => {
        throw new Error("tracking boom");
      }),
      recordUptoSession: mock(async () => {}),
      finalizeTracking: mock(async () => {
        throw new Error("tracking boom");
      }),
      list: mock(async () => ({ records: [], total: 0, hasMore: false })),
      getStats: mock(async () => ({})),
      get: mock(async () => undefined),
      prune: mock(async () => 0),
    } as unknown as ResourceTrackingModule;

    const state = {
      result: {
        type: "payment-verified",
        paymentPayload: {},
        paymentRequirements: {
          scheme: "exact",
          network: "eip155:1",
          asset: "0xtoken",
          amount: "1",
          payTo: "0xrecipient",
        },
      } as unknown as HTTPProcessResult,
      resourceTrackingId: "track-1",
    };

    await expect(
      processAfterHandle({
        httpServer,
        state,
        autoSettle: true,
        resourceTracking,
        responseStatus: 200,
        startTimeMs: Date.now(),
      })
    ).resolves.toEqual({ headers: {} });
  });
});

/**
 * Tests for App Router middleware
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentMiddleware, createSupportedHandler } from "../src/middleware/app-router";
import type { MiddlewareConfig } from "../src/types";

// Mock Next.js
const mockNext = vi.fn();
const mockHeadersSet = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    next: () => {
      mockNext();
      // Create a proper mock response object
      const headers = {
        set: mockHeadersSet,
        get: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
      };
      return {
        status: 200,
        headers,
      };
    },
    json: (data: any) =>
      new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

describe("createPaymentMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseConfig: MiddlewareConfig = {
    payTo: "0x1234567890abcdef",
    routes: {
      "/api/stream": {
        price: "1000000",
        network: "aptos-testnet",
      },
    },
  };

  it("should allow requests to non-protected routes", async () => {
    const middleware = createPaymentMiddleware(baseConfig);

    const url = new URL("http://localhost/api/public");
    const request = {
      nextUrl: url,
      headers: new Headers(),
    } as any;
    const _response = await middleware(request);

    expect(mockNext).toHaveBeenCalled();
  });

  it("should return 402 for protected route without payment", async () => {
    const middleware = createPaymentMiddleware(baseConfig);

    const url = new URL("http://localhost/api/stream");
    const request = {
      nextUrl: url,
      headers: new Headers(),
    } as any;
    const response = await middleware(request);

    expect(response.status).toBe(402);

    const body = await response.json();
    expect(body.code).toBe("payment_required");
    expect(body.requirements).toBeDefined();
    expect(body.requirements.maxAmountRequired).toBe("1000000");
  });

  it("should return 400 for invalid payment header", async () => {
    const middleware = createPaymentMiddleware(baseConfig);

    const url = new URL("http://localhost/api/stream");
    const headers = new Headers();
    headers.set("X-Payment", "invalid-header");
    const request = {
      nextUrl: url,
      headers,
    } as any;

    const response = await middleware(request as any);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe("invalid_payment");
  });

  it("should call onPaymentRequired hook when payment required", async () => {
    const onPaymentRequired = vi.fn();
    const config = {
      ...baseConfig,
      onPaymentRequired,
    };

    const middleware = createPaymentMiddleware(config);
    const url = new URL("http://localhost/api/stream");
    const request = {
      nextUrl: url,
      headers: new Headers(),
    } as any;

    await middleware(request as any);

    expect(onPaymentRequired).toHaveBeenCalled();
    expect(onPaymentRequired.mock.calls[0][1]).toMatchObject({
      maxAmountRequired: "1000000",
      payTo: "0x1234567890abcdef",
    });
  });

  it("should match wildcard routes", async () => {
    const config: MiddlewareConfig = {
      payTo: "0x123",
      routes: {
        "/api/premium/*": {
          price: "500000",
        },
      },
    };

    const middleware = createPaymentMiddleware(config);
    const url = new URL("http://localhost/api/premium/content");
    const request = {
      nextUrl: url,
      headers: new Headers(),
    } as any;

    const response = await middleware(request as any);
    expect(response.status).toBe(402);

    const body = await response.json();
    expect(body.requirements.maxAmountRequired).toBe("500000");
  });

  it("should support debug logging", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const config = {
      ...baseConfig,
      debug: true,
    };

    const middleware = createPaymentMiddleware(config);
    const url = new URL("http://localhost/api/stream");
    const request = {
      nextUrl: url,
      headers: new Headers(),
    } as any;

    await middleware(request as any);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("createSupportedHandler", () => {
  it("should return supported payment types", async () => {
    const config: MiddlewareConfig = {
      payTo: "0x123",
      routes: {
        "/api/stream": {
          price: "1000000",
          network: "aptos-testnet",
        },
        "/api/premium": {
          price: "500000",
          network: "aptos-mainnet",
        },
      },
    };

    const handler = createSupportedHandler(config);
    const response = await handler();

    expect(response).toBeDefined();

    const text = await response.text();
    const body = JSON.parse(text);

    expect(body.x402Version).toBe(1);
    expect(body.kinds).toHaveLength(2);
    expect(body.kinds[0]).toMatchObject({
      scheme: "exact",
      network: "aptos-testnet",
    });
    expect(body.kinds[1]).toMatchObject({
      scheme: "exact",
      network: "aptos-mainnet",
    });
  });

  it("should use default network for routes without network specified", async () => {
    const config: MiddlewareConfig = {
      payTo: "0x123",
      routes: {
        "/api/stream": {
          price: "1000000",
        },
      },
    };

    const handler = createSupportedHandler(config);
    const response = await handler();

    const text = await response.text();
    const body = JSON.parse(text);

    expect(body.kinds[0].network).toBe("aptos-testnet");
  });
});

/**
 * Tests for middleware utility functions
 */

import { describe, expect, it } from "vitest";
import {
  buildPaymentRequirements,
  create402Response,
  createSuccessResponse,
  matchRoute,
  parsePaymentFromHeader,
} from "../src/middleware/utils";
import type { MiddlewareConfig, RouteConfig } from "../src/types";

describe("matchRoute", () => {
  it("should match exact route", () => {
    const routes: Record<string, RouteConfig> = {
      "/api/stream": { price: "1000000" },
      "/api/premium": { price: "500000" },
    };

    const match = matchRoute("/api/stream", routes);
    expect(match).toEqual({ price: "1000000" });
  });

  it("should match wildcard route", () => {
    const routes: Record<string, RouteConfig> = {
      "/api/*": { price: "1000000" },
    };

    const match = matchRoute("/api/stream", routes);
    expect(match).toEqual({ price: "1000000" });
  });

  it("should match parameter route", () => {
    const routes: Record<string, RouteConfig> = {
      "/api/content/:id": { price: "1000000" },
    };

    const match = matchRoute("/api/content/123", routes);
    expect(match).toEqual({ price: "1000000" });
  });

  it("should return null for non-matching route", () => {
    const routes: Record<string, RouteConfig> = {
      "/api/stream": { price: "1000000" },
    };

    const match = matchRoute("/api/other", routes);
    expect(match).toBeNull();
  });

  it("should prioritize exact match over pattern", () => {
    const routes: Record<string, RouteConfig> = {
      "/api/*": { price: "500000" },
      "/api/stream": { price: "1000000" },
    };

    const match = matchRoute("/api/stream", routes);
    expect(match).toEqual({ price: "1000000" });
  });
});

describe("buildPaymentRequirements", () => {
  it("should build payment requirements from route config", () => {
    const routeConfig: RouteConfig = {
      price: "1000000",
      network: "aptos-testnet",
      description: "Test payment",
    };

    const config: MiddlewareConfig = {
      payTo: "0x123",
      routes: {},
    };

    const requirements = buildPaymentRequirements(routeConfig, config, "/api/stream");

    expect(requirements).toEqual({
      scheme: "exact",
      network: "aptos-testnet",
      maxAmountRequired: "1000000",
      resource: "/api/stream",
      payTo: "0x123",
      description: "Test payment",
      asset: "0x1::aptos_coin::AptosCoin",
    });
  });

  it("should use default network if not specified", () => {
    const routeConfig: RouteConfig = {
      price: "1000000",
    };

    const config: MiddlewareConfig = {
      payTo: "0x123",
      routes: {},
    };

    const requirements = buildPaymentRequirements(routeConfig, config, "/api/stream");

    expect(requirements.network).toBe("aptos-testnet");
  });

  it("should use custom resource if specified", () => {
    const routeConfig: RouteConfig = {
      price: "1000000",
      resource: "custom-resource",
    };

    const config: MiddlewareConfig = {
      payTo: "0x123",
      routes: {},
    };

    const requirements = buildPaymentRequirements(routeConfig, config, "/api/stream");

    expect(requirements.resource).toBe("custom-resource");
  });

  it("should use custom payment requirements if provided", () => {
    const customRequirements = {
      scheme: "exact" as const,
      network: "aptos-mainnet" as const,
      maxAmountRequired: "2000000",
      resource: "custom",
      payTo: "0x999",
      description: "Custom payment",
      asset: "0x1::aptos_coin::AptosCoin",
    };

    const routeConfig: RouteConfig = {
      price: "1000000",
      paymentRequirements: customRequirements,
    };

    const config: MiddlewareConfig = {
      payTo: "0x123",
      routes: {},
    };

    const requirements = buildPaymentRequirements(routeConfig, config, "/api/stream");

    expect(requirements).toEqual(customRequirements);
  });
});

describe("parsePaymentFromHeader", () => {
  it("should return invalid for null header", () => {
    const result = parsePaymentFromHeader(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("No payment header provided");
  });

  it("should return invalid for empty header", () => {
    const result = parsePaymentFromHeader("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("No payment header provided");
  });

  it("should parse valid base64 payment header", () => {
    const payload = {
      data: {
        recipient: "0x123",
        amount: "1000000",
        from: "0x456",
      },
    };
    const header = Buffer.from(JSON.stringify(payload)).toString("base64");

    const result = parsePaymentFromHeader(header);
    expect(result.valid).toBe(true);
    expect(result.payload).toBeDefined();
  });

  it("should return invalid for malformed base64", () => {
    const result = parsePaymentFromHeader("not-valid-base64!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid");
  });
});

describe("create402Response", () => {
  it("should create 402 response with payment requirements", () => {
    const requirements = {
      x402Version: 1,
      scheme: "exact" as const,
      network: "aptos-testnet" as const,
      maxAmountRequired: "1000000",
      resource: "/api/stream",
      payTo: "0x123",
    };

    const response = create402Response(requirements);

    expect(response.status).toBe(402);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("X-Payment-Required")).toBeTruthy();
  });

  it("should include requirements in response body", async () => {
    const requirements = {
      x402Version: 1,
      scheme: "exact" as const,
      network: "aptos-testnet" as const,
      maxAmountRequired: "1000000",
      resource: "/api/stream",
      payTo: "0x123",
    };

    const response = create402Response(requirements);
    const body = await response.json();

    expect(body.requirements).toEqual(requirements);
    expect(body.error).toBe("Payment Required");
    expect(body.code).toBe("payment_required");
  });
});

describe("createSuccessResponse", () => {
  it("should create success headers with payer", () => {
    const headers = createSuccessResponse("0x123");

    expect(headers["X-Payment-Verified"]).toBe("true");
    expect(headers["X-Payment-Payer"]).toBe("0x123");
  });

  it("should include txHash if provided", () => {
    const headers = createSuccessResponse("0x123", "0xabc");

    expect(headers["X-Payment-TxHash"]).toBe("0xabc");
    expect(headers["X-Payment-Response"]).toBeTruthy();
  });

  it("should not include txHash headers if not provided", () => {
    const headers = createSuccessResponse("0x123");

    expect(headers["X-Payment-TxHash"]).toBeUndefined();
    expect(headers["X-Payment-Response"]).toBeUndefined();
  });
});

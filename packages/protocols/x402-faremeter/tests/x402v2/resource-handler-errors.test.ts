#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
} from "@faremeter/test-harness";

await t.test("x402 v2 resource handler errors", async (t) => {
  await t.test("resource handler throws exception", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler(() => {
      throw new Error("Resource handler crashed");
    });

    const fetch = harness.createFetch();

    // Hono catches handler exceptions and returns 500 responses
    const response = await fetch("/test-resource");
    t.equal(
      response.status,
      500,
      "should return 500 when resource handler throws",
    );

    t.end();
  });

  await t.test("resource handler returns 500 error status", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler(() => {
      return {
        status: 500,
        body: { error: "Internal server error" },
      };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 500, "should return 500 from resource handler");
    const body = await response.json();
    t.same(
      body,
      { error: "Internal server error" },
      "should return error body",
    );

    t.end();
  });

  await t.test("resource handler returns 404 error status", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler(() => {
      return {
        status: 404,
        body: { error: "Resource not found" },
      };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 404, "should return 404 from resource handler");
    const body = await response.json();
    t.same(body, { error: "Resource not found" }, "should return error body");

    t.end();
  });

  await t.test("resource handler returns 403 forbidden", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler(() => {
      return {
        status: 403,
        body: { error: "Forbidden - additional permissions required" },
      };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 403, "should return 403 from resource handler");

    t.end();
  });

  await t.test("resource handler throws async error", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler(async () => {
      await Promise.resolve();
      throw new Error("Async resource handler crashed");
    });

    const fetch = harness.createFetch();

    // Hono catches async handler exceptions and returns 500 responses
    const response = await fetch("/test-resource");
    t.equal(
      response.status,
      500,
      "should return 500 when async resource handler throws",
    );

    t.end();
  });

  await t.test("resource handler can access payment context", async (t) => {
    interface CapturedContext {
      hasPaymentRequirements: boolean;
      hasPaymentPayload: boolean;
      hasSettleResponse: boolean;
      transactionPresent: boolean;
    }
    let capturedContext: CapturedContext | undefined;

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler((ctx) => {
      capturedContext = {
        hasPaymentRequirements: !!ctx.paymentRequirements,
        hasPaymentPayload: !!ctx.paymentPayload,
        hasSettleResponse: !!ctx.settleResponse,
        transactionPresent: !!ctx.settleResponse?.transaction,
      };
      return {
        status: 200,
        body: { success: true },
      };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.ok(capturedContext, "should have captured context");
    if (capturedContext) {
      t.ok(
        capturedContext.hasPaymentRequirements,
        "should have payment requirements",
      );
      t.ok(capturedContext.hasPaymentPayload, "should have payment payload");
      t.ok(capturedContext.hasSettleResponse, "should have settle response");
      t.ok(
        capturedContext.transactionPresent,
        "should have transaction in settle response",
      );
    }

    t.end();
  });

  await t.test(
    "resource handler can access verifyResponse in verify-then-settle mode",
    async (t) => {
      let hasVerifyResponse = false;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      harness.setResourceHandler((ctx) => {
        hasVerifyResponse = !!ctx.verifyResponse;
        return {
          status: 200,
          body: { success: true },
        };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.ok(hasVerifyResponse, "should have verifyResponse in context");

      t.end();
    },
  );

  await t.test("resource handler with custom headers", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler(() => {
      return {
        status: 200,
        body: { data: "premium content" },
        headers: {
          "X-Custom-Header": "custom-value",
          "X-Request-Id": "req-12345",
        },
      };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.equal(
      response.headers.get("X-Custom-Header"),
      "custom-value",
      "should have custom header",
    );
    t.equal(
      response.headers.get("X-Request-Id"),
      "req-12345",
      "should have request id header",
    );

    t.end();
  });

  await t.test("reset() restores default resource handler", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    // Set custom handler that returns 418
    harness.setResourceHandler(() => ({
      status: 418,
      body: { error: "I'm a teapot" },
    }));

    const fetch1 = harness.createFetch();
    const response1 = await fetch1("/test-resource");
    t.equal(response1.status, 418, "should use custom handler");

    // Reset
    harness.reset();

    const fetch2 = harness.createFetch();
    const response2 = await fetch2("/test-resource");
    t.equal(response2.status, 200, "should use default handler after reset");

    t.end();
  });
});

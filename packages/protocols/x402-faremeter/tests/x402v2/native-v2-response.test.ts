#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  isResourceContextV2,
} from "@faremeter/test-harness";

/**
 * Tests for the middleware's native v2 response code path.
 *
 * When the middleware is configured with supportedVersions: { x402v2: true },
 * it produces 402 responses with a PAYMENT-REQUIRED header natively (without
 * needing a client-side interceptor to transform v1 responses into v2 format).
 *
 * These tests exercise the native v2 path WITHOUT createV2ResponseInterceptor,
 * verifying the middleware itself sets the PAYMENT-REQUIRED header.
 */
await t.test("middleware native v2 response production", async (t) => {
  await t.test(
    "middleware sets PAYMENT-REQUIRED header when x402v2 is enabled",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        // No clientInterceptors -- no createV2ResponseInterceptor
      });

      // Raw request bypasses wrap() so we see the actual 402 response
      const response = await harness.app.request("/test-resource");

      t.equal(response.status, 402, "should return 402");

      const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
      t.ok(
        paymentRequiredHeader,
        "PAYMENT-REQUIRED header should be present natively",
      );
      if (!paymentRequiredHeader) {
        return t.end();
      }

      const decoded = JSON.parse(atob(paymentRequiredHeader)) as Record<
        string,
        unknown
      >;
      t.equal(
        decoded.x402Version,
        2,
        "decoded header should have x402Version 2",
      );
      t.ok(decoded.resource, "decoded header should have resource");
      t.ok(
        Array.isArray(decoded.accepts),
        "decoded header should have accepts array",
      );

      t.end();
    },
  );

  await t.test(
    "end-to-end flow succeeds with native v2 (no client interceptor)",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        // No createV2ResponseInterceptor -- the middleware produces native v2
        // and the client wrapper (wrap) should handle it directly
      });

      let resourceHandlerCalled = false;
      let wasV2Context = false;

      harness.setResourceHandler((ctx) => {
        resourceHandlerCalled = true;
        wasV2Context = isResourceContextV2(ctx);
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.ok(resourceHandlerCalled, "resource handler should have been called");
      t.ok(wasV2Context, "context should be v2");
      const body = await response.json();
      t.same(
        body,
        { success: true },
        "response body should match resource handler output",
      );

      t.end();
    },
  );

  await t.test(
    "dual-mode server returns both PAYMENT-REQUIRED header and v1 JSON body",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v1: true, x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      // Raw request to inspect the 402 response
      const response = await harness.app.request("/test-resource");

      t.equal(response.status, 402, "should return 402");

      // v2 header should be present
      const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
      t.ok(
        paymentRequiredHeader,
        "PAYMENT-REQUIRED header should be present (v2)",
      );

      // v1 JSON body should also be present
      const body = (await response.json()) as {
        x402Version: number;
        accepts: unknown[];
      };
      t.equal(body.x402Version, 1, "JSON body should be v1 format");
      t.ok(Array.isArray(body.accepts), "JSON body should have accepts array");

      t.end();
    },
  );

  await t.test("end-to-end verify-then-settle with native v2", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    let resourceHandlerCalled = false;
    harness.setResourceHandler((ctx) => {
      resourceHandlerCalled = true;
      t.ok(isResourceContextV2(ctx), "context should be v2");
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.ok(resourceHandlerCalled, "resource handler should have been called");
    const body = await response.json();
    t.same(
      body,
      { success: true },
      "response body should match resource handler output",
    );

    t.end();
  });
});

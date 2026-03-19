#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
} from "@faremeter/test-harness";

/**
 * Tests for v2 client interacting with a v1-only server.
 *
 * In this scenario:
 * - The server only supports v1 (supportedVersions: { x402v1: true, x402v2: false })
 * - The client uses v2 protocol (createV2ResponseInterceptor + PAYMENT-SIGNATURE header)
 * - The middleware should reject v2 payments with a 400 error
 *
 * This tests the rejection path where a v2 client cannot pay against a
 * server that does not support x402 v2.
 */
await t.test("x402 v2 client with v1-only server", async (t) => {
  await t.test(
    "v1-only server returns v1 402 response without PAYMENT-REQUIRED header",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        supportedVersions: { x402v1: true, x402v2: false },
      });

      // Make raw request to inspect the 402 response format
      const response = await harness.app.request("/test-resource");

      t.equal(response.status, 402, "should return 402");

      // v1-only server should NOT set PAYMENT-REQUIRED header
      const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
      t.equal(
        paymentRequiredHeader,
        null,
        "should not have PAYMENT-REQUIRED header (v1-only server)",
      );

      // v1 format: JSON body with x402Version 1
      const body = (await response.json()) as {
        x402Version: number;
        accepts: { maxAmountRequired: string; resource: string }[];
      };
      t.equal(body.x402Version, 1, "should return v1 format response");
      t.ok(Array.isArray(body.accepts), "should have accepts array");
      t.ok(body.accepts.length > 0, "should have at least one accept option");
      t.ok(
        body.accepts[0]?.maxAmountRequired,
        "should have maxAmountRequired (v1 field)",
      );

      t.end();
    },
  );

  await t.test(
    "v2 client payment is rejected with 400 by v1-only server",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        supportedVersions: { x402v1: true, x402v2: false },
      });

      // Simulate a v2 client sending a PAYMENT-SIGNATURE header
      const v2PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: "test",
          network: "test-local",
          amount: "100",
          asset: "TEST",
          payTo: "test-receiver",
          maxTimeoutSeconds: 30,
        },
        payload: {
          testId: "test-123",
          amount: "100",
          timestamp: Date.now(),
        },
      };
      const v2Header = btoa(JSON.stringify(v2PaymentPayload));

      const paymentResponse = await harness.app.request("/test-resource", {
        headers: {
          "PAYMENT-SIGNATURE": v2Header,
        },
      });

      t.equal(paymentResponse.status, 400, "v2 payment should return 400");

      const body = (await paymentResponse.json()) as { error: string };
      t.match(
        body.error,
        /does not support x402 protocol version 2/,
        "error message should indicate v2 not supported",
      );

      t.end();
    },
  );

  await t.test(
    "v2 client with interceptor gets 400 from v1-only server",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        supportedVersions: { x402v1: true, x402v2: false },
        // v2 client interceptor transforms 402 body to v2 header format
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      // The v2 interceptor transforms the v1 402 into v2 format, causing the
      // client to send a PAYMENT-SIGNATURE header. The v1-only server rejects
      // this with a 400 error. wrap() returns non-402 responses directly.
      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        400,
        "should return 400 when v2 payment is rejected by v1-only server",
      );
      const body = (await response.json()) as { error: string };
      t.match(
        body.error,
        /does not support x402 protocol version 2/,
        "error message should indicate v2 not supported",
      );

      t.end();
    },
  );
});

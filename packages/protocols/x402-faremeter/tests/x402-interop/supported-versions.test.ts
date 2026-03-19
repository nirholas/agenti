#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  isResourceContextV1,
  isResourceContextV2,
} from "@faremeter/test-harness";
import { resolveSupportedVersions } from "@faremeter/middleware/common";
import { V2_PAYMENT_REQUIRED_HEADER } from "@faremeter/types/x402v2";

/**
 * Tests for the supportedVersions middleware configuration.
 *
 * This tests the server's ability to:
 * - Send v1 body, v2 header, or both in 402 responses based on config
 * - Reject clients using unsupported protocol versions with 400
 */
await t.test("supportedVersions configuration", async (t) => {
  await t.test("resolveSupportedVersions validation", async (t) => {
    await t.test("defaults to v1 only", async (t) => {
      const resolved = resolveSupportedVersions(undefined);
      t.equal(resolved.x402v1, true, "x402v1 should default to true");
      t.equal(resolved.x402v2, false, "x402v2 should default to false");
      t.end();
    });

    await t.test("accepts explicit configuration", async (t) => {
      const resolved = resolveSupportedVersions({
        x402v1: false,
        x402v2: true,
      });
      t.equal(resolved.x402v1, false, "x402v1 should be false");
      t.equal(resolved.x402v2, true, "x402v2 should be true");
      t.end();
    });

    await t.test("throws when both versions are disabled", async (t) => {
      t.throws(
        () => resolveSupportedVersions({ x402v1: false, x402v2: false }),
        /at least one protocol version must be enabled/,
        "should throw error for invalid config",
      );
      t.end();
    });
    t.end();
  });

  await t.test("402 response format with both versions enabled", async (t) => {
    await t.test(
      "402 response includes both v2 header and v1 body",
      async (t) => {
        const harness = new TestHarness({
          settleMode: "settle-only",
          accepts: [accepts()],
          facilitatorHandlers: [
            createTestFacilitatorHandler({ payTo: "test-receiver" }),
          ],
          clientHandlers: [], // No client handlers - will get 402
          // Explicitly enable both versions
          supportedVersions: { x402v1: true, x402v2: true },
        });

        const response = await harness.app.request("/test-resource");

        t.equal(response.status, 402, "should return 402");

        // Should have v2 header
        const v2Header = response.headers.get(V2_PAYMENT_REQUIRED_HEADER);
        t.ok(v2Header, "should include PAYMENT-REQUIRED header");

        // Decode and verify v2 header content
        if (v2Header) {
          const decoded = JSON.parse(atob(v2Header)) as {
            x402Version: number;
            accepts: { amount: string }[];
          };
          t.equal(decoded.x402Version, 2, "header should contain v2 response");
          t.ok(
            Array.isArray(decoded.accepts),
            "v2 response should have accepts array",
          );
        }

        // Should also have v1 body
        const body = (await response.json()) as {
          x402Version: number;
          accepts: { maxAmountRequired: string }[];
        };
        t.equal(body.x402Version, 1, "body should be v1 format");
        t.ok(Array.isArray(body.accepts), "v1 body should have accepts array");
        t.ok(
          body.accepts[0]?.maxAmountRequired,
          "v1 body should have maxAmountRequired",
        );

        t.end();
      },
    );

    await t.test(
      "client auto-upgrades to v2 when server sends v2 header",
      async (t) => {
        // When both versions are enabled, the server sends the v2 header.
        // Modern clients (like our fetch wrapper) detect the v2 header
        // and automatically use v2 protocol.
        const harness = new TestHarness({
          settleMode: "settle-only",
          accepts: [accepts()],
          facilitatorHandlers: [
            createTestFacilitatorHandler({ payTo: "test-receiver" }),
          ],
          clientHandlers: [createTestPaymentHandler()],
          // Explicitly enable both versions - server sends v2 header
          supportedVersions: { x402v1: true, x402v2: true },
        });

        let wasV2Context = false;
        harness.setResourceHandler((ctx) => {
          wasV2Context = isResourceContextV2(ctx);
          return { status: 200, body: { success: true } };
        });

        const fetch = harness.createFetch();
        const response = await fetch("/test-resource");

        t.equal(response.status, 200, "should complete successfully");
        t.ok(
          wasV2Context,
          "client should auto-upgrade to v2 when server sends v2 header",
        );
        t.end();
      },
    );

    t.end();
  });

  await t.test("402 response format with v2 only", async (t) => {
    await t.test(
      "402 response includes v2 header but no v1 body",
      async (t) => {
        const harness = new TestHarness({
          settleMode: "settle-only",
          accepts: [accepts()],
          facilitatorHandlers: [
            createTestFacilitatorHandler({ payTo: "test-receiver" }),
          ],
          clientHandlers: [],
          supportedVersions: { x402v1: false, x402v2: true },
        });

        const response = await harness.app.request("/test-resource");

        t.equal(response.status, 402, "should return 402");

        // Should have v2 header
        const v2Header = response.headers.get(V2_PAYMENT_REQUIRED_HEADER);
        t.ok(v2Header, "should include PAYMENT-REQUIRED header");

        // Body should be empty or minimal (no v1 format)
        const text = await response.text();
        // Empty body or just whitespace
        t.equal(text, "", "body should be empty when v1 is disabled");

        t.end();
      },
    );

    await t.test("v2 client payment succeeds", async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
        supportedVersions: { x402v1: false, x402v2: true },
      });

      let wasV2Context = false;
      harness.setResourceHandler((ctx) => {
        wasV2Context = isResourceContextV2(ctx);
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.ok(wasV2Context, "should process as v2 protocol");
      t.end();
    });

    await t.test("v1 client payment returns 400", async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        // No v2 interceptor - client uses v1 protocol
        supportedVersions: { x402v1: false, x402v2: true },
      });

      // Make a request that would include a v1 X-PAYMENT header
      // Since the fetch wrapper will retry on 402, we need to test at a lower level
      // First request gets 402, client sends v1 payment, server should return 400

      // Get the 402 response first
      const initialResponse = await harness.app.request("/test-resource");
      t.equal(initialResponse.status, 402, "initial request should get 402");

      // Now simulate a v1 client sending a payment header
      // We need to craft a valid v1 payment header
      const v1PaymentPayload = {
        x402Version: 1,
        scheme: "test",
        network: "test-network",
        asset: "",
        payload: { testId: "test-123" },
      };
      const v1Header = btoa(JSON.stringify(v1PaymentPayload));

      const paymentResponse = await harness.app.request("/test-resource", {
        headers: {
          "X-PAYMENT": v1Header,
        },
      });

      t.equal(paymentResponse.status, 400, "v1 payment should return 400");

      const body = (await paymentResponse.json()) as { error: string };
      t.match(
        body.error,
        /does not support x402 protocol version 1/,
        "error message should indicate v1 not supported",
      );

      t.end();
    });

    t.end();
  });

  await t.test("402 response format with v1 only", async (t) => {
    await t.test(
      "402 response includes v1 body but no v2 header",
      async (t) => {
        const harness = new TestHarness({
          settleMode: "settle-only",
          accepts: [accepts()],
          facilitatorHandlers: [
            createTestFacilitatorHandler({ payTo: "test-receiver" }),
          ],
          clientHandlers: [],
          supportedVersions: { x402v1: true, x402v2: false },
        });

        const response = await harness.app.request("/test-resource");

        t.equal(response.status, 402, "should return 402");

        // Should NOT have v2 header
        const v2Header = response.headers.get(V2_PAYMENT_REQUIRED_HEADER);
        t.equal(v2Header, null, "should NOT include PAYMENT-REQUIRED header");

        // Should have v1 body
        const body = (await response.json()) as {
          x402Version: number;
          accepts: { maxAmountRequired: string }[];
        };
        t.equal(body.x402Version, 1, "body should be v1 format");
        t.ok(Array.isArray(body.accepts), "v1 body should have accepts array");

        t.end();
      },
    );

    await t.test("v1 client payment succeeds", async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        supportedVersions: { x402v1: true, x402v2: false },
      });

      let wasV1Context = false;
      harness.setResourceHandler((ctx) => {
        wasV1Context = isResourceContextV1(ctx);
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.ok(wasV1Context, "should process as v1 protocol");
      t.end();
    });

    await t.test("v2 client payment returns 400", async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        supportedVersions: { x402v1: true, x402v2: false },
      });

      // Get the 402 response first
      const initialResponse = await harness.app.request("/test-resource");
      t.equal(initialResponse.status, 402, "initial request should get 402");

      // Simulate a v2 client sending a payment header
      const v2PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: "test",
          network: "test-network",
          amount: "100",
          asset: "",
          payTo: "test-receiver",
          maxTimeoutSeconds: 30,
        },
        payload: { testId: "test-123" },
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
    });

    t.end();
  });
});

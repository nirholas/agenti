#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  isResourceContextV2,
  createFailureInterceptor,
  matchFacilitatorSettle,
  settleFailedResponseV2,
  suppressConsoleErrors,
  TEST_NETWORK,
} from "@faremeter/test-harness";

/**
 * Tests for v2 client interacting with v2 server infrastructure.
 *
 * In this scenario:
 * - The client uses v2 protocol (PAYMENT-SIGNATURE header)
 * - The server/facilitator handlers use v2 types
 * - Full v2 protocol flow
 *
 * This tests the native v2 path where both client and server use v2 protocol.
 */
await t.test("x402 v2 client with v2 server infrastructure", async (t) => {
  await t.test("v2 client can make payments using v2 protocol", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      // v2 interceptor transforms 402 to v2 format
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    let wasV2Context = false;
    harness.setResourceHandler((ctx) => {
      wasV2Context = isResourceContextV2(ctx);
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.ok(wasV2Context, "context should be v2 (client used v2 protocol)");

    t.end();
  });

  await t.test(
    "v2 client receives PAYMENT-REQUIRED header in 402 response",
    async (t) => {
      // To test this, we need to make a raw request and see the transformed response
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [], // No client handlers
      });

      // Apply v2 interceptor manually
      const v2Interceptor = createV2ResponseInterceptor();
      const v2Fetch = v2Interceptor(async (input, init) => {
        let url: string;
        if (typeof input === "string") {
          url = input;
        } else if (input instanceof URL) {
          url = input.toString();
        } else {
          url = input.url;
        }
        return harness.app.request(url, init);
      });

      const response = await v2Fetch("/test-resource");

      t.equal(response.status, 402, "should return 402");
      t.ok(
        response.headers.has("PAYMENT-REQUIRED"),
        "should have PAYMENT-REQUIRED header",
      );

      // Decode and verify v2 format
      const encoded = response.headers.get("PAYMENT-REQUIRED");
      type V2PaymentRequired = {
        x402Version: number;
        resource: { url: string };
        accepts: { amount: string; maxAmountRequired?: string }[];
      };
      const decoded = JSON.parse(atob(encoded ?? "")) as V2PaymentRequired;

      t.equal(decoded.x402Version, 2, "should be v2 format");
      t.ok(decoded.resource, "should have resource object");
      t.ok(decoded.resource.url, "resource should have url");
      t.ok(Array.isArray(decoded.accepts), "should have accepts array");
      t.ok(
        decoded.accepts[0]?.amount,
        "v2 uses amount instead of maxAmountRequired",
      );
      t.notOk(
        decoded.accepts[0]?.maxAmountRequired,
        "v2 should not have maxAmountRequired",
      );

      t.end();
    },
  );

  await t.test("v2 client payment goes through v2 handlers", async (t) => {
    let handleSettleCalled = false;
    let receivedV2Payload = false;

    const handler = createTestFacilitatorHandler({
      payTo: "test-receiver",
      onSettle: (_requirements, payment) => {
        handleSettleCalled = true;
        // Check that we received v2 types
        receivedV2Payload = payment.x402Version === 2 && "accepted" in payment;
        return undefined;
      },
    });

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [handler],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.ok(handleSettleCalled, "settle handler should be called");
    t.ok(receivedV2Payload, "handler should receive v2 payload format");

    t.end();
  });

  await t.test("v2 client receives v2 format settle response", async (t) => {
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

    let settleResponse: {
      transaction?: string;
      network?: string;
    } | null = null;

    harness.setResourceHandler((ctx) => {
      if (isResourceContextV2(ctx)) {
        settleResponse = ctx.settleResponse ?? null;
      }
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    await fetch("/test-resource");

    t.ok(settleResponse, "should have settle response");
    t.ok(
      "transaction" in (settleResponse ?? {}),
      "v2 response should have transaction (not txHash)",
    );
    t.ok(
      "network" in (settleResponse ?? {}),
      "v2 response should have network (not networkId)",
    );

    t.end();
  });

  await t.test("v2 client verify-then-settle mode", async (t) => {
    let verifyCallOrder = -1;
    let settleCallOrder = -1;
    let callOrder = 0;

    const handler = createTestFacilitatorHandler({
      payTo: "test-receiver",
      onVerify: () => {
        verifyCallOrder = callOrder++;
        return { isValid: true };
      },
      onSettle: () => {
        settleCallOrder = callOrder++;
        return undefined;
      },
    });

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [handler],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    let hasVerifyResponse = false;
    harness.setResourceHandler((ctx) => {
      if (isResourceContextV2(ctx)) {
        hasVerifyResponse = !!ctx.verifyResponse;
      }
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.ok(verifyCallOrder >= 0, "verify should be called");
    t.ok(settleCallOrder >= 0, "settle should be called");
    t.ok(
      verifyCallOrder < settleCallOrder,
      "verify should be called before settle",
    );
    t.ok(hasVerifyResponse, "resource handler should have verify response");

    t.end();
  });

  await t.test("v2 client error handling", async (t) => {
    t.teardown(suppressConsoleErrors());

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorSettle, () =>
          settleFailedResponseV2("transaction_failed", TEST_NETWORK),
        ),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw error on settlement failure");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /failed to complete payment after retries/,
          "v2 client should handle errors",
        );
      }
    }

    t.end();
  });

  await t.test("v2 client with multiple payment options", async (t) => {
    let resourceHandlerCalled = false;
    let facilitatorSettleCalled = false;

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [
        accepts({ maxAmountRequired: "100" }),
        accepts({ maxAmountRequired: "200" }),
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: () => {
            facilitatorSettleCalled = true;
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler(() => {
      resourceHandlerCalled = true;
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(
      response.status,
      200,
      "should complete successfully with multiple options",
    );
    t.ok(resourceHandlerCalled, "resource handler should have been called");
    t.ok(facilitatorSettleCalled, "facilitator settle should have been called");
    const body = await response.json();
    t.same(
      body,
      { success: true },
      "response body should match resource handler output",
    );

    t.end();
  });
});

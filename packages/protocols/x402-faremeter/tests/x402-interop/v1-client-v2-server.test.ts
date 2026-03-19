#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  isResourceContextV1,
  createFailureInterceptor,
  matchFacilitatorSettle,
  settleFailedResponse,
  suppressConsoleErrors,
} from "@faremeter/test-harness";

/**
 * Tests for v1 client interacting with v2 server infrastructure.
 *
 * In this scenario:
 * - The client uses v1 protocol (X-PAYMENT header)
 * - The server/facilitator handlers use v2 types internally
 * - The middleware adapts between v1 and v2
 *
 * This tests the backwards compatibility path where existing v1 clients
 * continue to work with updated server infrastructure.
 */
await t.test("x402 v1 client with v2 server infrastructure", async (t) => {
  await t.test(
    "v1 client can make payments to server with v2 handlers",
    async (t) => {
      // The test harness uses v2 handlers internally
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        // No v2 interceptor - client uses v1 protocol
      });

      let wasV1Context = false;
      harness.setResourceHandler((ctx) => {
        // Should receive v1 context since client sent v1 header
        wasV1Context = isResourceContextV1(ctx);
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.ok(wasV1Context, "context should be v1 (client used v1 protocol)");

      t.end();
    },
  );

  await t.test("v1 client receives correct 402 response format", async (t) => {
    // Create a minimal handler that doesn't match our test scheme
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [], // No client handlers - will get 402
    });

    // Make raw request without wrap() to see the 402 response
    const response = await harness.app.request("/test-resource");

    t.equal(response.status, 402, "should return 402");

    // V1 format: JSON body
    const body = (await response.json()) as {
      x402Version: number;
      accepts: {
        maxAmountRequired: string;
        resource: string;
      }[];
    };
    t.equal(body.x402Version, 1, "should return v1 format response");
    t.ok(Array.isArray(body.accepts), "should have accepts array");
    t.ok(body.accepts.length > 0, "should have at least one accept option");
    t.ok(body.accepts[0]?.maxAmountRequired, "should have maxAmountRequired");
    t.ok(body.accepts[0]?.resource, "should have resource in each accept");

    t.end();
  });

  await t.test(
    "v1 client payment goes through v2 handlers successfully",
    async (t) => {
      let handleSettleCalled = false;
      let handleVerifyCalled = false;

      const handler = createTestFacilitatorHandler({
        payTo: "test-receiver",
        onVerify: () => {
          handleVerifyCalled = true;
          return { isValid: true };
        },
        onSettle: () => {
          handleSettleCalled = true;
          return undefined; // Use default response
        },
      });

      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [handler],
        clientHandlers: [createTestPaymentHandler()],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.ok(handleVerifyCalled, "v2 verify handler should be called");
      t.ok(handleSettleCalled, "v2 settle handler should be called");

      t.end();
    },
  );

  await t.test("v1 client receives v1 format settle response", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    let settleResponse: {
      transaction?: string | null;
      network?: string | null;
    } | null = null;

    harness.setResourceHandler((ctx) => {
      if (isResourceContextV1(ctx)) {
        settleResponse = ctx.settleResponse;
      }
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    await fetch("/test-resource");

    t.ok(settleResponse, "should have settle response");
    t.ok(
      "transaction" in (settleResponse ?? {}),
      "v1 response should have transaction (spec-compliant field name)",
    );
    t.ok(
      "network" in (settleResponse ?? {}),
      "v1 response should have network (spec-compliant field name)",
    );

    t.end();
  });

  await t.test("v1 client with multiple payment options", async (t) => {
    let resourceHandlerCalled = false;
    let facilitatorSettleCalled = false;

    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [
        accepts({ maxAmountRequired: "100" }),
        accepts({ maxAmountRequired: "200" }),
        accepts({ maxAmountRequired: "300" }),
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

  await t.test("v1 client error handling with v2 server errors", async (t) => {
    t.teardown(suppressConsoleErrors());

    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorSettle, () =>
          settleFailedResponse("server_error"),
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
          "v1 client should receive error in compatible format",
        );
      }
    }

    t.end();
  });
});

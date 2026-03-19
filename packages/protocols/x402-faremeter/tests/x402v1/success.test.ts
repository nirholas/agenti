#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  acceptsV2,
  TEST_SCHEME,
  TEST_NETWORK,
  TEST_ASSET,
} from "@faremeter/test-harness";

await t.test("x402 v1 protocol flow components", async (t) => {
  await t.test("facilitator handler fills requirements", async (t) => {
    const handler = createTestFacilitatorHandler({ payTo: "test-receiver" });

    const input = [acceptsV2({ payTo: "" })];

    const result = await handler.getRequirements({ accepts: input });

    t.equal(result.length, 1, "should return one requirement");
    t.equal(result[0]?.scheme, TEST_SCHEME, "scheme should match");
    t.equal(result[0]?.network, TEST_NETWORK, "network should match");
    t.equal(result[0]?.asset, TEST_ASSET, "asset should be filled in");
    t.equal(result[0]?.payTo, "test-receiver", "payTo should be filled in");

    t.end();
  });

  await t.test("client handler matches and creates payment", async (t) => {
    const handler = createTestPaymentHandler();

    const requirements = [accepts()];

    const execers = await handler({ request: "/test" }, requirements);

    t.equal(execers.length, 1, "should return one execer");
    t.equal(
      execers[0]?.requirements.scheme,
      TEST_SCHEME,
      "scheme should match",
    );

    const payment = await execers[0]?.exec();
    t.ok(payment, "should create payment");
    if (payment) {
      t.ok(payment.payload, "payment should have payload");
      t.equal(
        (payment.payload as { amount: string }).amount,
        "100",
        "payment amount should match requirement",
      );
    }

    t.end();
  });

  await t.test("facilitator handler verifies payment", async (t) => {
    const handler = createTestFacilitatorHandler({ payTo: "test-receiver" });

    const requirements = acceptsV2();

    const payment = {
      x402Version: 2 as const,
      accepted: requirements,
      payload: {
        testId: "test-123",
        amount: "100",
        timestamp: Date.now(),
      },
    };

    const verifyResult = await handler.handleVerify?.(requirements, payment);
    t.ok(verifyResult, "should return verify response");
    t.equal(verifyResult?.isValid, true, "payment should be valid");

    t.end();
  });

  await t.test("facilitator handler settles payment", async (t) => {
    const handler = createTestFacilitatorHandler({ payTo: "test-receiver" });

    const requirements = acceptsV2();

    const payment = {
      x402Version: 2 as const,
      accepted: requirements,
      payload: {
        testId: "test-123",
        amount: "100",
        timestamp: Date.now(),
      },
    };

    const settleResult = await handler.handleSettle(requirements, payment);
    t.ok(settleResult, "should return settle response");
    t.equal(settleResult?.success, true, "settlement should succeed");
    t.ok(settleResult?.transaction, "should return transaction hash");
    t.equal(settleResult?.network, TEST_NETWORK, "network should match");

    t.end();
  });

  await t.test(
    "end-to-end successful flow (verify-then-settle mode)",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should complete successfully in verify-then-settle mode",
      );

      t.end();
    },
  );

  await t.test("end-to-end successful flow (settle-only mode)", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(
      response.status,
      200,
      "should complete successfully in settle-only mode",
    );

    t.end();
  });

  await t.test("custom resource handler is called", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    let resourceHandlerCalled = false;
    harness.setResourceHandler((ctx) => {
      resourceHandlerCalled = true;
      t.ok(ctx.paymentRequirements, "should have payment requirements");
      t.ok(ctx.paymentPayload, "should have payment payload");
      t.ok(ctx.settleResponse, "should have settle response");
      return {
        status: 200,
        body: { custom: "response" },
        headers: { "X-Custom": "header" },
      };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should return 200");
    t.ok(resourceHandlerCalled, "resource handler should be called");
    const body = await response.json();
    t.same(body, { custom: "response" }, "should return custom body");
    t.equal(
      response.headers.get("X-Custom"),
      "header",
      "should have custom header",
    );

    t.end();
  });
});

#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  acceptsV2,
  createV2ResponseInterceptor,
  isResourceContextV2,
  TEST_SCHEME,
  TEST_NETWORK,
  TEST_ASSET,
} from "@faremeter/test-harness";

await t.test("x402 v2 protocol flow components", async (t) => {
  await t.test("facilitator handler fills requirements (v2)", async (t) => {
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

  await t.test("facilitator handler verifies v2 payment", async (t) => {
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

  await t.test("facilitator handler settles v2 payment", async (t) => {
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
    "end-to-end v2 successful flow (verify-then-settle mode)",
    async (t) => {
      let facilitatorSettleCalled = false;
      let facilitatorVerifyCalled = false;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onVerify: () => {
              facilitatorVerifyCalled = true;
            },
            onSettle: () => {
              facilitatorSettleCalled = true;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        // Use v2 response interceptor to transform 402 to v2 format
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      let resourceHandlerCalled = false;
      harness.setResourceHandler((ctx) => {
        resourceHandlerCalled = true;
        t.ok(isResourceContextV2(ctx), "context should be v2");
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should complete successfully in verify-then-settle mode",
      );
      t.ok(resourceHandlerCalled, "resource handler should have been called");
      t.ok(
        facilitatorVerifyCalled,
        "facilitator verify should have been called",
      );
      t.ok(
        facilitatorSettleCalled,
        "facilitator settle should have been called",
      );
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
    "end-to-end v2 successful flow (settle-only mode)",
    async (t) => {
      let facilitatorSettleCalled = false;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: () => {
              facilitatorSettleCalled = true;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        // Use v2 response interceptor to transform 402 to v2 format
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      let resourceHandlerCalled = false;
      harness.setResourceHandler((ctx) => {
        resourceHandlerCalled = true;
        t.ok(isResourceContextV2(ctx), "context should be v2");
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should complete successfully in settle-only mode",
      );
      t.ok(resourceHandlerCalled, "resource handler should have been called");
      t.ok(
        facilitatorSettleCalled,
        "facilitator settle should have been called",
      );
      const body = await response.json();
      t.same(
        body,
        { success: true },
        "response body should match resource handler output",
      );

      t.end();
    },
  );

  await t.test("v2 resource handler receives v2 context", async (t) => {
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

    let resourceHandlerCalled = false;
    let wasV2Context = false;

    harness.setResourceHandler((ctx) => {
      resourceHandlerCalled = true;
      wasV2Context = isResourceContextV2(ctx);

      if (isResourceContextV2(ctx)) {
        t.ok(ctx.paymentRequirements, "should have v2 payment requirements");
        t.ok(ctx.paymentPayload, "should have v2 payment payload");
        t.ok(ctx.settleResponse, "should have v2 settle response");
        t.ok(ctx.settleResponse?.transaction, "should have transaction field");
        t.equal(
          ctx.paymentPayload.x402Version,
          2,
          "payload should be v2 version",
        );
      }

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
    t.ok(wasV2Context, "context should be v2");
    const body = await response.json();
    t.same(body, { custom: "response" }, "should return custom body");
    t.equal(
      response.headers.get("X-Custom"),
      "header",
      "should have custom header",
    );

    t.end();
  });

  await t.test("v2 settle response has correct field names", async (t) => {
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
      success: boolean;
      transaction: string;
      network: string;
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
      "should have transaction field (not txHash)",
    );
    t.ok(
      "network" in (settleResponse ?? {}),
      "should have network field (not networkId)",
    );

    t.end();
  });

  await t.test("v2 verify-then-settle provides verifyResponse", async (t) => {
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

    let hasVerifyResponse = false;

    harness.setResourceHandler((ctx) => {
      if (isResourceContextV2(ctx)) {
        hasVerifyResponse = !!ctx.verifyResponse;
        if (ctx.verifyResponse) {
          t.equal(
            ctx.verifyResponse.isValid,
            true,
            "verify response should indicate valid payment",
          );
        }
      }
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    await fetch("/test-resource");

    t.ok(hasVerifyResponse, "should have verify response in v2 context");

    t.end();
  });
});

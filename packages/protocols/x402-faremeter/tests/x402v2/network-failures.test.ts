#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  createFailureInterceptor,
  matchFacilitatorAccepts,
  networkError,
  timeoutError,
  httpError,
  suppressConsoleErrors,
} from "@faremeter/test-harness";

await t.test("x402 v2 network failures", async (t) => {
  t.teardown(suppressConsoleErrors());

  await t.test(
    "v2 facilitator /accepts endpoint returns network error",
    async (t) => {
      let interceptorCalled = false;

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
          createFailureInterceptor(matchFacilitatorAccepts, () => {
            interceptorCalled = true;
            return networkError("connection refused");
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.ok(interceptorCalled, "failure interceptor should have been called");
      t.equal(
        response.status,
        500,
        "should return 500 when facilitator is unreachable",
      );

      const body = (await response.json()) as { error: string };
      t.ok(body.error, "response should contain error information");

      t.end();
    },
  );

  await t.test("v2 facilitator /accepts endpoint times out", async (t) => {
    let interceptorCalled = false;

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
        createFailureInterceptor(matchFacilitatorAccepts, () => {
          interceptorCalled = true;
          return timeoutError();
        }),
      ],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.ok(interceptorCalled, "failure interceptor should have been called");
    t.equal(
      response.status,
      500,
      "should return 500 when facilitator times out",
    );

    const body = (await response.json()) as { error: string };
    t.ok(body.error, "response should contain error information");

    t.end();
  });

  await t.test(
    "v2 facilitator /accepts endpoint returns HTTP 500",
    async (t) => {
      let interceptorCalled = false;

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
          createFailureInterceptor(matchFacilitatorAccepts, () => {
            interceptorCalled = true;
            return httpError(500, "Internal Server Error");
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.ok(interceptorCalled, "failure interceptor should have been called");
      t.equal(
        response.status,
        500,
        "should return 500 when /accepts returns HTTP 500",
      );

      const body = (await response.json()) as { error: string };
      t.ok(body.error, "response should contain error information");

      t.end();
    },
  );

  await t.test(
    "v2 basic successful flow (baseline for comparison)",
    async (t) => {
      let facilitatorSettleCalled = false;
      let resourceHandlerCalled = false;

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
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      harness.setResourceHandler(() => {
        resourceHandlerCalled = true;
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should succeed on basic flow");
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
});

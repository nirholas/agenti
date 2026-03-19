#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createFailureInterceptor,
  matchFacilitatorAccepts,
  networkError,
  timeoutError,
  httpError,
  suppressConsoleErrors,
} from "@faremeter/test-harness";

await t.test("x402 v1 network failures", async (t) => {
  t.teardown(suppressConsoleErrors());

  await t.test(
    "facilitator /accepts endpoint returns network error",
    async (t) => {
      let interceptorCalled = false;

      const harness = new TestHarness({
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorAccepts, () => {
            interceptorCalled = true;
            return networkError("Connection refused");
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

      const body = await response.text();
      t.ok(body.length > 0, "response should contain error information");

      t.end();
    },
  );

  await t.test("facilitator /accepts endpoint times out", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
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

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test("facilitator /accepts endpoint returns HTTP 500", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorAccepts, () => {
          interceptorCalled = true;
          return httpError(500, "Internal server error");
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

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test("basic successful flow (baseline for comparison)", async (t) => {
    const harness = new TestHarness({
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should succeed on basic flow");

    t.end();
  });
});

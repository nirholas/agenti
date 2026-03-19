#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  TEST_NETWORK,
  createFailureInterceptor,
  matchFacilitatorSettle,
  settleFailedResponse,
  networkError,
  timeoutError,
  httpError,
  jsonResponse,
  suppressConsoleErrors,
} from "@faremeter/test-harness";

await t.test("x402 v1 settlement failures", async (t) => {
  t.teardown(suppressConsoleErrors());

  await t.test(
    "settlement fails with error message (verify-then-settle mode)",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorSettle, () =>
            settleFailedResponse("insufficient funds"),
          ),
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw WrappedFetchError on persistent settle failure");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /failed to complete payment after retries/,
            "should be WrappedFetchError",
          );
        }
      }

      t.end();
    },
  );

  await t.test(
    "settlement fails with error message (settle-only mode)",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorSettle, () =>
            settleFailedResponse("transaction reverted"),
          ),
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw WrappedFetchError on persistent settle failure");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /failed to complete payment after retries/,
            "should be WrappedFetchError",
          );
        }
      }

      t.end();
    },
  );

  await t.test("settlement returns network error", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorSettle, () => {
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
      "should return 500 when settlement endpoint is unreachable",
    );

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test("settlement endpoint times out", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorSettle, () => {
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
      "should return 500 when settlement endpoint times out",
    );

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test("settlement endpoint returns HTTP 500 error", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorSettle, () => {
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
      "should return 500 when settlement returns HTTP 500",
    );

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test("settlement endpoint returns invalid JSON", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorSettle, () => {
          interceptorCalled = true;
          return new Response("not valid json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }),
      ],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.ok(interceptorCalled, "failure interceptor should have been called");
    t.equal(
      response.status,
      500,
      "should return 500 when settlement returns invalid JSON",
    );

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test(
    "settlement endpoint returns malformed response structure",
    async (t) => {
      let interceptorCalled = false;

      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorSettle, () => {
            interceptorCalled = true;
            return jsonResponse(200, {
              invalid: "response structure",
              missing: "success field",
            });
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.ok(interceptorCalled, "failure interceptor should have been called");
      t.equal(
        response.status,
        500,
        "should return 500 when settlement returns malformed response",
      );

      const body = await response.text();
      t.ok(body.length > 0, "response should contain error information");

      t.end();
    },
  );

  await t.test(
    "settlement returns success but missing transaction",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorSettle, () =>
            jsonResponse(200, {
              success: true,
              transaction: null,
              network: TEST_NETWORK,
            }),
          ),
        ],
      });

      const fetch = harness.createFetch();

      const response = await fetch("/test-resource");
      t.equal(
        response.status,
        200,
        "should complete even with null transaction if success is true",
      );

      t.end();
    },
  );

  await t.test("settlement returns success but missing network", async (t) => {
    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorSettle, () =>
          jsonResponse(200, {
            success: true,
            transaction: "0x123abc",
            network: null,
          }),
        ),
      ],
    });

    const fetch = harness.createFetch();

    const response = await fetch("/test-resource");
    t.equal(
      response.status,
      200,
      "should complete even with null network if success is true",
    );

    t.end();
  });
});

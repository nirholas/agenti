#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createFailureInterceptor,
  matchFacilitatorVerify,
  verifyFailedResponse,
  networkError,
  timeoutError,
  httpError,
  jsonResponse,
  getURLFromRequestInfo,
  suppressConsoleErrors,
} from "@faremeter/test-harness";

await t.test("x402 v1 verification failures", async (t) => {
  t.teardown(suppressConsoleErrors());

  await t.test(
    "verification fails with insufficient payment amount",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorVerify, () =>
            verifyFailedResponse("insufficient payment amount"),
          ),
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw WrappedFetchError on persistent verify failure");
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

  await t.test("verification fails with wrong payTo address", async (t) => {
    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () =>
          verifyFailedResponse("payment sent to wrong address"),
        ),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw WrappedFetchError on persistent verify failure");
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
  });

  await t.test("verification fails with mismatched network", async (t) => {
    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () =>
          verifyFailedResponse("network mismatch"),
        ),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw WrappedFetchError on persistent verify failure");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("verification fails with mismatched scheme", async (t) => {
    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () =>
          verifyFailedResponse("scheme mismatch"),
        ),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw WrappedFetchError on persistent verify failure");
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
  });

  await t.test("verification fails with mismatched asset", async (t) => {
    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () =>
          verifyFailedResponse("asset mismatch"),
        ),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw WrappedFetchError on persistent verify failure");
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
  });

  await t.test("verification endpoint returns network error", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () => {
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
      "should return 500 when verification endpoint is unreachable",
    );

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test("verification endpoint times out", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () => {
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
      "should return 500 when verification endpoint times out",
    );

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test("verification endpoint returns HTTP 500 error", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () => {
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
      "should return 500 when verification returns HTTP 500",
    );

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test("verification endpoint returns invalid JSON", async (t) => {
    let interceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () => {
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
      "should return 500 when verification returns invalid JSON",
    );

    const body = await response.text();
    t.ok(body.length > 0, "response should contain error information");

    t.end();
  });

  await t.test(
    "verification endpoint returns malformed response structure",
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
          createFailureInterceptor(matchFacilitatorVerify, () => {
            interceptorCalled = true;
            return jsonResponse(200, {
              invalid: "response structure",
              missing: "isValid field",
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
        "should return 500 when verification returns malformed response",
      );

      const body = await response.text();
      t.ok(body.length > 0, "response should contain error information");

      t.end();
    },
  );

  await t.test(
    "verification succeeds when facilitator omits payer field",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorVerify, () =>
            jsonResponse(200, { isValid: true }),
          ),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should succeed when verify response has no payer field",
      );

      t.end();
    },
  );

  await t.test(
    "verification failure accepted when facilitator omits payer field",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorVerify, () =>
            jsonResponse(200, {
              isValid: false,
              invalidReason: "bad payment",
            }),
          ),
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw WrappedFetchError on persistent verify failure");
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
    "settle-only mode bypasses verify endpoint entirely",
    async (t) => {
      let verifyWasCalled = false;

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/facilitator/verify")) {
              verifyWasCalled = true;
            }
            return fetch(input, init);
          },
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should complete successfully in settle-only mode",
      );
      t.equal(
        verifyWasCalled,
        false,
        "verify endpoint should not be called in settle-only mode",
      );

      t.end();
    },
  );
});

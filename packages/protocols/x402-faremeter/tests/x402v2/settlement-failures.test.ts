#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  createFailureInterceptor,
  matchFacilitatorSettle,
  settleFailedResponseV2,
  networkError,
  timeoutError,
  httpError,
  suppressConsoleErrors,
  TEST_NETWORK,
} from "@faremeter/test-harness";

await t.test("x402 v2 settlement failures", async (t) => {
  t.teardown(suppressConsoleErrors());

  await t.test(
    "v2 settlement fails with error message (verify-then-settle mode)",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorSettle, () =>
            settleFailedResponseV2("settlement_rejected", TEST_NETWORK),
          ),
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw an error");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /failed to complete payment after retries/,
            "should indicate payment failure",
          );
        }
      }

      t.end();
    },
  );

  await t.test(
    "v2 settlement fails with error message (settle-only mode)",
    async (t) => {
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
            settleFailedResponseV2("settlement_failed", TEST_NETWORK),
          ),
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw an error");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /failed to complete payment after retries/,
            "should indicate payment failure",
          );
        }
      }

      t.end();
    },
  );

  await t.test("v2 settlement returns network error", async (t) => {
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
        createFailureInterceptor(matchFacilitatorSettle, () => {
          interceptorCalled = true;
          return networkError();
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

    t.end();
  });

  await t.test("v2 settlement endpoint times out", async (t) => {
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

    t.end();
  });

  await t.test("v2 settlement endpoint returns HTTP 500 error", async (t) => {
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
        createFailureInterceptor(matchFacilitatorSettle, () => {
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
      "should return 500 when settlement returns HTTP 500",
    );

    t.end();
  });

  await t.test("v2 settlement returns failure via interceptor", async (t) => {
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
        createFailureInterceptor(matchFacilitatorSettle, () => {
          interceptorCalled = true;
          return settleFailedResponseV2("transaction_reverted", TEST_NETWORK);
        }),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw an error");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /failed to complete payment after retries/,
          "should indicate payment failure",
        );
      }
    }

    t.ok(interceptorCalled, "failure interceptor should have been called");

    t.end();
  });
});

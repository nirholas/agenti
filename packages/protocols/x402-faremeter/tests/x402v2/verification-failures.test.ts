#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  createFailureInterceptor,
  matchFacilitatorVerify,
  verifyFailedResponse,
  suppressConsoleErrors,
} from "@faremeter/test-harness";

await t.test("x402 v2 verification failures", async (t) => {
  t.teardown(suppressConsoleErrors());

  await t.test(
    "v2 verification fails with insufficient payment amount",
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
          createFailureInterceptor(matchFacilitatorVerify, () =>
            verifyFailedResponse("insufficient_payment_amount"),
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

  await t.test("v2 verification fails with wrong payTo address", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "verify-then-settle",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "correct-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
      middlewareInterceptors: [
        createFailureInterceptor(matchFacilitatorVerify, () =>
          verifyFailedResponse("wrong_pay_to_address"),
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
  });

  await t.test("v2 verification endpoint returns network error", async (t) => {
    let interceptorCalled = false;

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
        createFailureInterceptor(matchFacilitatorVerify, () => {
          interceptorCalled = true;
          throw new TypeError("network error");
        }),
      ],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.ok(interceptorCalled, "failure interceptor should have been called");
    t.equal(
      response.status,
      500,
      "should return 500 when verify endpoint is unreachable",
    );

    t.end();
  });

  await t.test("v2 verification returns invalid response", async (t) => {
    let interceptorCalled = false;

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
        createFailureInterceptor(matchFacilitatorVerify, () => {
          interceptorCalled = true;
          return verifyFailedResponse("invalid_signature");
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

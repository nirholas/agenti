#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  TEST_NETWORK,
  createCaptureInterceptor,
  matchFacilitatorSettle,
  suppressConsoleErrors,
} from "@faremeter/test-harness";

await t.test("x402 v1 handler failures", async (t) => {
  t.teardown(suppressConsoleErrors());

  function createFailingSettleHandler(errorReason: string) {
    const base = createTestFacilitatorHandler({ payTo: "test-receiver" });
    return {
      ...base,
      handleSettle: async () => ({
        success: false,
        errorReason,
        transaction: "",
        network: TEST_NETWORK,
        payer: "",
      }),
    };
  }

  await t.test(
    "handler returning success:false produces 402 not 500 (settle-only)",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createFailingSettleHandler("Insufficient funds for transfer"),
        ],
        clientHandlers: [createTestPaymentHandler()],
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
            "client should see retry exhaustion, not 500",
          );
        }
      }

      t.end();
    },
  );

  await t.test(
    "handler returning success:false produces 402 not 500 (verify-then-settle)",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createFailingSettleHandler("Insufficient funds for transfer"),
        ],
        clientHandlers: [createTestPaymentHandler()],
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
            "client should see retry exhaustion, not 500",
          );
        }
      }

      t.end();
    },
  );

  await t.test("handler throwing exception produces 402 not 500", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: () => {
            throw new Error("Transaction simulation failed");
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
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
          "client should see retry exhaustion, not 500",
        );
      }
    }

    t.end();
  });

  await t.test(
    "facilitator 500 response body is parseable as settle response",
    async (t) => {
      const { interceptor: captureInterceptor, captured } =
        createCaptureInterceptor(matchFacilitatorSettle);

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: () => {
              throw new Error("Transaction simulation failed");
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [captureInterceptor],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw WrappedFetchError");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
      }

      t.ok(captured.length > 0, "should have captured facilitator responses");

      const first = captured[0];
      t.ok(first, "should have at least one captured response");

      if (first) {
        t.equal(
          first.response.status,
          500,
          "facilitator should return HTTP 500",
        );

        const body = (await first.response.json()) as {
          success: boolean;
          errorReason?: string;
        };
        t.equal(
          body.success,
          false,
          "response body should have success: false",
        );
        t.ok(body.errorReason, "response body should include errorReason");
      }

      t.end();
    },
  );
});

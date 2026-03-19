#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  TEST_NETWORK,
  settleFailedResponse,
  matchFacilitatorSettle,
  failNTimes,
} from "@faremeter/test-harness";
import { X_PAYMENT_RESPONSE_HEADER } from "@faremeter/types/x402";

await t.test("X-PAYMENT-RESPONSE header", async (t) => {
  await t.test(
    "successful payment includes X-PAYMENT-RESPONSE header",
    async (t) => {
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

      t.equal(response.status, 200, "should return 200");

      const paymentResponseHeader = response.headers.get(
        X_PAYMENT_RESPONSE_HEADER,
      );
      if (!paymentResponseHeader) {
        t.fail("X-PAYMENT-RESPONSE header should be present");
        t.end();
        return;
      }

      // Decode and validate the header content
      const decoded = JSON.parse(atob(paymentResponseHeader)) as Record<
        string,
        unknown
      >;
      t.equal(decoded.success, true, "success should be true");
      t.ok(decoded.transaction, "transaction should be present");
      t.equal(decoded.network, TEST_NETWORK, "network should match");

      t.end();
    },
  );

  await t.test(
    "failed payment includes X-PAYMENT-RESPONSE header with error",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      // Intercept settle calls to return a failure
      harness.addMiddlewareInterceptor(
        failNTimes(10, matchFacilitatorSettle, () =>
          settleFailedResponse("insufficient_funds"),
        ),
      );

      // Use a raw fetch without the payment wrapper to get the 402 response
      const rawFetch = async (url: string) => {
        // First request gets 402
        const firstResponse = await harness.app.request(url);
        if (firstResponse.status !== 402) {
          return firstResponse;
        }

        // Parse payment requirements and create payment
        const body = (await firstResponse.json()) as {
          accepts: {
            scheme: string;
            network: string;
            asset: string;
            maxAmountRequired: string;
          }[];
        };
        const requirements = body.accepts[0];
        if (!requirements) {
          throw new Error("No requirements in response");
        }

        // Create a payment payload
        const payload = {
          x402Version: 1,
          scheme: requirements.scheme,
          network: requirements.network,
          asset: requirements.asset,
          payload: {
            testId: "test-123",
            amount: requirements.maxAmountRequired,
            timestamp: Date.now(),
          },
        };

        // Send request with payment header
        const paymentHeader = btoa(JSON.stringify(payload));
        return harness.app.request(url, {
          headers: {
            "X-PAYMENT": paymentHeader,
          },
        });
      };

      const response = await rawFetch("/test-resource");

      t.equal(response.status, 402, "should return 402 for failed payment");

      const paymentResponseHeader = response.headers.get(
        X_PAYMENT_RESPONSE_HEADER,
      );
      if (!paymentResponseHeader) {
        t.fail("X-PAYMENT-RESPONSE header should be present on failure");
        t.end();
        return;
      }

      // Decode and validate the header content
      const decoded = JSON.parse(atob(paymentResponseHeader)) as Record<
        string,
        unknown
      >;
      t.equal(decoded.success, false, "success should be false");
      t.equal(
        decoded.errorReason,
        "insufficient_funds",
        "errorReason should contain the error",
      );

      t.end();
    },
  );

  await t.test(
    "X-PAYMENT-RESPONSE header follows HTTP transport spec schema",
    async (t) => {
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

      const paymentResponseHeader = response.headers.get(
        X_PAYMENT_RESPONSE_HEADER,
      );
      if (!paymentResponseHeader) {
        t.fail("X-PAYMENT-RESPONSE header should be present");
        t.end();
        return;
      }
      const decoded = JSON.parse(atob(paymentResponseHeader)) as Record<
        string,
        unknown
      >;

      // Per the HTTP transport spec, the response should have these fields:
      // - success: boolean
      // - transaction: string (not txHash)
      // - network: string (not networkId)
      // - payer: string (optional)
      // - errorReason: string (optional, on failure)

      t.type(decoded.success, "boolean", "success should be a boolean");
      t.type(decoded.transaction, "string", "transaction should be a string");
      t.type(decoded.network, "string", "network should be a string");

      // Verify we're using the spec field names (not v1 internal names)
      t.notOk("txHash" in decoded, "should not use txHash (use transaction)");
      t.notOk("networkId" in decoded, "should not use networkId (use network)");

      t.end();
    },
  );
});

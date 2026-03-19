#!/usr/bin/env pnpm tsx
/* eslint-disable @typescript-eslint/no-deprecated -- v1 tests use v1 types */

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  TEST_SCHEME,
  TEST_NETWORK,
} from "@faremeter/test-harness";
import type {
  PaymentHandlerV1,
  PaymentExecerV1,
  RequestContext,
} from "@faremeter/types/client";
import type { x402PaymentRequirements } from "@faremeter/types/x402";

function isMatchingRequirement(req: x402PaymentRequirements): boolean {
  return (
    req.scheme.toLowerCase() === TEST_SCHEME.toLowerCase() &&
    req.network.toLowerCase() === TEST_NETWORK.toLowerCase()
  );
}

function createInvalidPayloadHandler(
  payloadFactory: (requirements: x402PaymentRequirements) => object,
): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => ({
        payload: payloadFactory(requirements),
      }),
    }));
  };
}

await t.test("x402 v1 payment payload edge cases", async (t) => {
  await t.test("payload with missing testId fails validation", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler((req) => ({
          // Missing testId
          amount: req.maxAmountRequired,
          timestamp: Date.now(),
        })),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with missing testId");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /failed to complete payment after retries/,
          "should fail validation",
        );
      }
    }

    t.end();
  });

  await t.test("payload with missing amount fails validation", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler(() => ({
          testId: "test-123",
          // Missing amount
          timestamp: Date.now(),
        })),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with missing amount");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("payload with missing timestamp fails validation", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler((req) => ({
          testId: "test-123",
          amount: req.maxAmountRequired,
          // Missing timestamp
        })),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with missing timestamp");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("payload with wrong amount fails validation", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler(() => ({
          testId: "test-123",
          amount: "50", // Wrong amount, requirement is 100
          timestamp: Date.now(),
        })),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with wrong amount");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /failed to complete payment after retries/,
          "should fail amount validation",
        );
      }
    }

    t.end();
  });

  await t.test("payload with optional metadata succeeds", async (t) => {
    let capturedMetadata: Record<string, unknown> | undefined;

    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: (_req, _payload, testPayload) => {
            capturedMetadata = testPayload.metadata;
          },
        }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler((req) => ({
          testId: "test-123",
          amount: req.maxAmountRequired,
          timestamp: Date.now(),
          metadata: {
            customField: "custom-value",
            nested: { key: "value" },
          },
        })),
      ],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should succeed with metadata");
    t.ok(capturedMetadata, "should have captured metadata");
    t.equal(
      capturedMetadata?.customField,
      "custom-value",
      "should have custom field",
    );
    t.same(
      capturedMetadata?.nested,
      { key: "value" },
      "should have nested metadata",
    );

    t.end();
  });

  await t.test("payload with zero timestamp fails validation", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler((req) => ({
          testId: "test-123",
          amount: req.maxAmountRequired,
          timestamp: 0, // Invalid timestamp
        })),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with zero timestamp");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("payload with empty testId fails validation", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler((req) => ({
          testId: "", // Empty testId
          amount: req.maxAmountRequired,
          timestamp: Date.now(),
        })),
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with empty testId");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("payload with large amount value succeeds", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts({ maxAmountRequired: "999999999999999999" })],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler((req) => ({
          testId: "test-123",
          amount: req.maxAmountRequired,
          timestamp: Date.now(),
        })),
      ],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should succeed with large amount");

    t.end();
  });

  await t.test(
    "uses metadata option from createTestPaymentHandler",
    async (t) => {
      let capturedMetadata: Record<string, unknown> | undefined;

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: (_req, _payload, testPayload) => {
              capturedMetadata = testPayload.metadata;
            },
          }),
        ],
        clientHandlers: [
          createTestPaymentHandler({
            metadata: {
              clientId: "test-client",
              version: "1.0.0",
            },
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should succeed");
      t.ok(capturedMetadata, "should have metadata");
      t.equal(
        capturedMetadata?.clientId,
        "test-client",
        "should have clientId",
      );
      t.equal(capturedMetadata?.version, "1.0.0", "should have version");

      t.end();
    },
  );
});

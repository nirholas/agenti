#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  createInvalidPayloadHandler,
} from "@faremeter/test-harness";

await t.test("x402 v2 payment payload edge cases", async (t) => {
  await t.test("payload with missing testId fails validation", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
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
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with missing testId");
    } catch (error: unknown) {
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
      supportedVersions: { x402v2: true },
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
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with missing amount");
    } catch (error: unknown) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("payload with missing timestamp fails validation", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
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
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with missing timestamp");
    } catch (error: unknown) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("payload with wrong amount fails validation", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
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
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with wrong amount");
    } catch (error: unknown) {
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
      supportedVersions: { x402v2: true },
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
      clientInterceptors: [createV2ResponseInterceptor()],
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
      supportedVersions: { x402v2: true },
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
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with zero timestamp");
    } catch (error: unknown) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("payload with empty testId fails validation", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
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
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail with empty testId");
    } catch (error: unknown) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("payload with large amount value succeeds", async (t) => {
    let resourceHandlerCalled = false;
    let facilitatorSettleCalled = false;

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts({ maxAmountRequired: "999999999999999999" })],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: () => {
            facilitatorSettleCalled = true;
          },
        }),
      ],
      clientHandlers: [
        createInvalidPayloadHandler((req) => ({
          testId: "test-123",
          amount: req.maxAmountRequired,
          timestamp: Date.now(),
        })),
      ],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    harness.setResourceHandler(() => {
      resourceHandlerCalled = true;
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should succeed with large amount");
    t.ok(resourceHandlerCalled, "resource handler should have been called");
    t.ok(facilitatorSettleCalled, "facilitator settle should have been called");
    const body = await response.json();
    t.same(
      body,
      { success: true },
      "response body should match resource handler output",
    );

    t.end();
  });

  await t.test(
    "uses metadata option from createTestPaymentHandler",
    async (t) => {
      let capturedMetadata: Record<string, unknown> | undefined;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
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
        clientInterceptors: [createV2ResponseInterceptor()],
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

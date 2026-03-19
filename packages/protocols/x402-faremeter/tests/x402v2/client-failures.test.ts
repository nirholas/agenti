#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  chooseFirst,
  createNonMatchingHandler,
  createThrowingHandler,
  createThrowingExecHandler,
  createNullPayloadHandler,
  createEmptyPayloadHandler,
  createWorkingHandler,
} from "@faremeter/test-harness";

await t.test("x402 v2 client failures", async (t) => {
  await t.test("no client handler matches server requirements", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createNonMatchingHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch({ payerChooser: chooseFirst });

    try {
      await fetch("/test-resource");
      t.fail("should throw when no client handler matches");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /No payment options available/,
          "should indicate no payment options",
        );
      }
    }

    t.end();
  });

  await t.test("empty accepts array from server", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [], // No payment options offered by server
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch({ payerChooser: chooseFirst });

    try {
      await fetch("/test-resource");
      t.fail("should throw when accepts array is empty");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /No payment options available/,
          "should indicate no payment options available",
        );
      }
    }

    t.end();
  });

  await t.test("client handler throws during match", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createThrowingHandler("Handler match failed unexpectedly"),
      ],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw when handler throws during match");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /Handler match failed unexpectedly/,
          "should propagate handler error",
        );
      }
    }

    t.end();
  });

  await t.test("client handler exec() throws", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createThrowingExecHandler("Payment execution failed")],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw when exec() throws");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /Payment execution failed/,
          "should propagate exec error",
        );
      }
    }

    t.end();
  });

  await t.test("client handler exec() returns null payload", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createNullPayloadHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should fail when payload is null");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
    }

    t.end();
  });

  await t.test("client handler returns empty payload object", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createEmptyPayloadHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    const fetch = harness.createFetch();

    // Empty payload should fail validation at facilitator
    try {
      await fetch("/test-resource");
      t.fail("should fail when payload is empty");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /failed to complete payment after retries/,
          "should fail payment validation",
        );
      }
    }

    t.end();
  });

  await t.test(
    "multiple client handlers, none match requirements",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [
          createNonMatchingHandler(),
          createNonMatchingHandler(),
          createNonMatchingHandler(),
        ],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      const fetch = harness.createFetch({ payerChooser: chooseFirst });

      try {
        await fetch("/test-resource");
        t.fail("should throw when no handlers match");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /No payment options available/,
            "should indicate no payment options",
          );
        }
      }

      t.end();
    },
  );

  await t.test(
    "multiple client handlers, first throws, second works",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [
          createThrowingHandler("First handler failed"),
          createWorkingHandler(),
        ],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      const fetch = harness.createFetch();

      // First handler throws, so the error should propagate
      try {
        await fetch("/test-resource");
        t.fail("should throw when first handler throws");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /First handler failed/,
            "should propagate first handler error",
          );
        }
      }

      t.end();
    },
  );
});

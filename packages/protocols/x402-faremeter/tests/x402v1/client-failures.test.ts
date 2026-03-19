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
  chooseFirst,
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

function createNonMatchingHandler(): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    _accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecerV1[]> => {
    return [];
  };
}

function createThrowingHandler(message: string): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    _accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecerV1[]> => {
    throw new Error(message);
  };
}

function createThrowingExecHandler(message: string): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => {
        throw new Error(message);
      },
    }));
  };
}

function createNullPayloadHandler(): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => {
        return { payload: null as unknown as object };
      },
    }));
  };
}

function createEmptyPayloadHandler(): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => {
        return { payload: {} };
      },
    }));
  };
}

function createWorkingHandler(): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => ({
        payload: {
          testId: "test-123",
          amount: requirements.maxAmountRequired,
          timestamp: Date.now(),
        },
      }),
    }));
  };
}

await t.test("x402 v1 client failures", async (t) => {
  await t.test("no client handler matches server requirements", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createNonMatchingHandler()],
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
      settleMode: "settle-only",
      accepts: [], // No payment options offered by server
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
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
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [
        createThrowingHandler("Handler match failed unexpectedly"),
      ],
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
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createThrowingExecHandler("Payment execution failed")],
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
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createNullPayloadHandler()],
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
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createEmptyPayloadHandler()],
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
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [
          createThrowingHandler("First handler failed"),
          createWorkingHandler(),
        ],
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

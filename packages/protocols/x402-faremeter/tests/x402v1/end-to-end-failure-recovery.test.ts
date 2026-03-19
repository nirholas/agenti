#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  failNTimes,
  matchFacilitatorVerify,
  matchFacilitatorSettle,
  verifyFailedResponse,
  settleFailedResponse,
  createFailureInterceptor,
} from "@faremeter/test-harness";

await t.test("x402 v1 end-to-end failure recovery", async (t) => {
  await t.test(
    "complete flow: verify fails then succeeds on retry",
    async (t) => {
      const harness = new TestHarness({
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          failNTimes(1, matchFacilitatorVerify, () =>
            verifyFailedResponse("temporary verification failure"),
          ),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should eventually succeed after verify failure and retry",
      );

      t.end();
    },
  );

  await t.test(
    "complete flow: settle fails twice then succeeds on third try",
    async (t) => {
      let attemptCount = 0;

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          failNTimes(2, matchFacilitatorSettle, () => {
            attemptCount++;
            return settleFailedResponse("temporary settlement failure");
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should succeed after 2 failures");
      t.equal(attemptCount, 2, "should have failed exactly 2 times");

      t.end();
    },
  );

  await t.test(
    "complete flow: verify fails 3 times exceeds retry limit",
    async (t) => {
      let attemptCount = 0;

      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          // Fail more times than retry limit allows
          createFailureInterceptor(matchFacilitatorVerify, () => {
            attemptCount++;
            return verifyFailedResponse("persistent verification failure");
          }),
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw when retries exhausted");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /failed to complete payment after retries/,
            "should indicate retry exhaustion",
          );
        }
        t.ok(attemptCount >= 3, "should have attempted at least 3 times");
      }

      t.end();
    },
  );

  await t.test(
    "complete flow: settle returns failure on first attempt, success on retry",
    async (t) => {
      let failureCount = 0;

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          failNTimes(1, matchFacilitatorSettle, () => {
            failureCount++;
            return settleFailedResponse("temporary settlement failure");
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should succeed after settle failure");
      t.equal(failureCount, 1, "should have failed exactly once");

      t.end();
    },
  );

  await t.test(
    "complete flow: alternating verify and settle failures",
    async (t) => {
      let verifyFailCount = 0;
      let settleFailCount = 0;

      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          failNTimes(1, matchFacilitatorVerify, () => {
            verifyFailCount++;
            return verifyFailedResponse("temporary verify failure");
          }),
          failNTimes(1, matchFacilitatorSettle, () => {
            settleFailCount++;
            return settleFailedResponse("temporary settle failure");
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should succeed after both verify and settle failures",
      );
      t.equal(verifyFailCount, 1, "should have failed verify once");
      t.equal(settleFailCount, 1, "should have failed settle once");

      t.end();
    },
  );

  await t.test(
    "persistent settle failure exhausts retries in settle-only mode",
    async (t) => {
      let attemptCount = 0;

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          createFailureInterceptor(matchFacilitatorSettle, () => {
            attemptCount++;
            return settleFailedResponse("persistent settlement failure");
          }),
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw when settle retries exhausted");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /failed to complete payment after retries/,
            "should indicate retry exhaustion",
          );
        }
        t.ok(attemptCount >= 3, "should have attempted at least 3 times");
      }

      t.end();
    },
  );
});

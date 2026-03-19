#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  failNTimes,
  matchFacilitatorVerify,
  matchFacilitatorSettle,
  verifyFailedResponse,
  settleFailedResponseV2,
  createFailureInterceptor,
  TEST_NETWORK,
} from "@faremeter/test-harness";

await t.test("x402 v2 end-to-end failure recovery", async (t) => {
  await t.test(
    "complete flow: verify fails then succeeds on retry",
    async (t) => {
      let resourceHandlerCalled = false;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
        middlewareInterceptors: [
          failNTimes(1, matchFacilitatorVerify, () =>
            verifyFailedResponse("temporary verification failure"),
          ),
        ],
      });

      harness.setResourceHandler(() => {
        resourceHandlerCalled = true;
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should eventually succeed after verify failure and retry",
      );
      t.ok(resourceHandlerCalled, "resource handler should have been called");
      const body = await response.json();
      t.same(
        body,
        { success: true },
        "response body should match resource handler output",
      );

      t.end();
    },
  );

  await t.test(
    "complete flow: settle fails twice then succeeds on third try",
    async (t) => {
      let attemptCount = 0;

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
          failNTimes(2, matchFacilitatorSettle, () => {
            attemptCount++;
            return settleFailedResponseV2(
              "temporary settlement failure",
              TEST_NETWORK,
            );
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
        supportedVersions: { x402v2: true },
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
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
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
        middlewareInterceptors: [
          failNTimes(1, matchFacilitatorSettle, () => {
            failureCount++;
            return settleFailedResponseV2(
              "temporary settlement failure",
              TEST_NETWORK,
            );
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
        supportedVersions: { x402v2: true },
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
        middlewareInterceptors: [
          failNTimes(1, matchFacilitatorVerify, () => {
            verifyFailCount++;
            return verifyFailedResponse("temporary verify failure");
          }),
          failNTimes(1, matchFacilitatorSettle, () => {
            settleFailCount++;
            return settleFailedResponseV2(
              "temporary settle failure",
              TEST_NETWORK,
            );
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
            attemptCount++;
            return settleFailedResponseV2(
              "persistent settlement failure",
              TEST_NETWORK,
            );
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

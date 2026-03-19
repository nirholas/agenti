#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
} from "@faremeter/test-harness";

await t.test("x402 v1 concurrent payment attempts", async (t) => {
  await t.test("multiple concurrent requests all succeed", async (t) => {
    const settledPayments: string[] = [];

    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: (_req, _payload, testPayload) => {
            settledPayments.push(testPayload.testId);
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch();

    // Launch 5 concurrent requests
    const requests = Array.from({ length: 5 }, (_, i) =>
      fetch(`/test-resource-${i}`),
    );

    const responses = await Promise.all(requests);

    t.equal(
      responses.filter((r) => r.status === 200).length,
      5,
      "all 5 requests should succeed",
    );
    t.equal(settledPayments.length, 5, "should have 5 settled payments");
    // All testIds should be unique
    const uniqueIds = new Set(settledPayments);
    t.equal(uniqueIds.size, 5, "all payment IDs should be unique");

    t.end();
  });

  await t.test("concurrent requests with different amounts", async (t) => {
    const settledAmounts: string[] = [];

    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [
        accepts({
          maxAmountRequired: "100",
          resource: "http://example.com/resource-a",
          description: "Resource A",
        }),
        accepts({
          maxAmountRequired: "200",
          resource: "http://example.com/resource-b",
          description: "Resource B",
        }),
        accepts({
          maxAmountRequired: "300",
          resource: "http://example.com/resource-c",
          description: "Resource C",
        }),
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: (_req, _payload, testPayload) => {
            settledAmounts.push(testPayload.amount);
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch();

    // Launch concurrent requests
    const responses = await Promise.all([
      fetch("/resource-a"),
      fetch("/resource-b"),
      fetch("/resource-c"),
    ]);

    t.equal(
      responses.filter((r) => r.status === 200).length,
      3,
      "all 3 requests should succeed",
    );
    t.equal(settledAmounts.length, 3, "should have 3 settled payments");

    t.end();
  });

  await t.test(
    "concurrent requests do not interfere with each other",
    async (t) => {
      const settleTimestamps: number[] = [];

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: () => {
              settleTimestamps.push(Date.now());
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      const fetch = harness.createFetch();

      // Launch 10 concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        fetch(`/test-resource-${i}`),
      );

      const responses = await Promise.all(requests);

      t.equal(
        responses.filter((r) => r.status === 200).length,
        10,
        "all 10 requests should succeed",
      );
      t.equal(
        settleTimestamps.length,
        10,
        "should have recorded 10 settle timestamps",
      );

      t.end();
    },
  );

  await t.test(
    "concurrent requests with verify-then-settle mode",
    async (t) => {
      let verifyCount = 0;
      let settleCount = 0;

      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onVerify: () => {
              verifyCount++;
            },
            onSettle: () => {
              settleCount++;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      const fetch = harness.createFetch();

      // Launch 5 concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) =>
        fetch(`/test-resource-${i}`),
      );

      const responses = await Promise.all(requests);

      t.equal(
        responses.filter((r) => r.status === 200).length,
        5,
        "all 5 requests should succeed",
      );
      t.equal(verifyCount, 5, "should have 5 verify calls");
      t.equal(settleCount, 5, "should have 5 settle calls");

      t.end();
    },
  );

  await t.test(
    "mixed success and failure in concurrent requests",
    async (t) => {
      let requestCount = 0;

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      // Alternating success/failure resource handler
      harness.setResourceHandler(() => {
        requestCount++;
        if (requestCount % 2 === 0) {
          return {
            status: 500,
            body: { error: "Simulated failure" },
          };
        }
        return {
          status: 200,
          body: { success: true },
        };
      });

      const fetch = harness.createFetch();

      // Launch 6 concurrent requests
      const requests = Array.from({ length: 6 }, (_, i) =>
        fetch(`/test-resource-${i}`),
      );

      const responses = await Promise.all(requests);

      const successCount = responses.filter((r) => r.status === 200).length;
      const failureCount = responses.filter((r) => r.status === 500).length;

      t.equal(successCount, 3, "should have 3 successful requests");
      t.equal(failureCount, 3, "should have 3 failed requests");

      t.end();
    },
  );

  await t.test("rapid sequential requests after each other", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch();

    // Make 10 rapid sequential requests
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`/test-resource-${i}`);
      results.push(response.status);
    }

    t.equal(
      results.filter((s) => s === 200).length,
      10,
      "all 10 sequential requests should succeed",
    );

    t.end();
  });
});

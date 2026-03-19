#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  TEST_SCHEME,
  TEST_NETWORK,
  TEST_ASSET,
  getURLFromRequestInfo,
} from "@faremeter/test-harness";

await t.test("x402 v2 protocol violations", async (t) => {
  await t.test(
    "client sends PAYMENT-SIGNATURE header with invalid base64",
    async (t) => {
      let invalidHeaderInjections = 0;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          createV2ResponseInterceptor(),
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            // Only intercept requests to the resource that have a PAYMENT-SIGNATURE header
            if (url.includes("/test-resource")) {
              const existingHeaders = new Headers(init?.headers);
              if (existingHeaders.has("PAYMENT-SIGNATURE")) {
                // Replace any valid PAYMENT-SIGNATURE header with an invalid one
                invalidHeaderInjections++;
                const headers = new Headers(init?.headers);
                headers.set("PAYMENT-SIGNATURE", "not-valid-base64!!!");
                return fetch(input, { ...init, headers });
              }
            }
            return fetch(input, init);
          },
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw WrappedFetchError after retries exhausted");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        t.ok(
          invalidHeaderInjections > 0,
          "invalid header should have been injected at least once",
        );
        if (error instanceof Error) {
          t.match(
            error.message,
            /failed to complete payment after retries/,
            "should be WrappedFetchError indicating payment failure",
          );
        }
      }

      t.end();
    },
  );

  await t.test(
    "client sends PAYMENT-SIGNATURE header with valid base64 but invalid JSON",
    async (t) => {
      let invalidInjections = 0;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          createV2ResponseInterceptor(),
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/test-resource")) {
              const existingHeaders = new Headers(init?.headers);
              if (existingHeaders.has("PAYMENT-SIGNATURE")) {
                invalidInjections++;
                const headers = new Headers(init?.headers);
                // Valid base64 but not valid JSON
                headers.set("PAYMENT-SIGNATURE", btoa("not valid json {{{"));
                return fetch(input, { ...init, headers });
              }
            }
            return fetch(input, init);
          },
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw error for invalid JSON in payment header");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        t.ok(invalidInjections > 0, "invalid header should have been injected");
      }

      t.end();
    },
  );

  await t.test(
    "client sends PAYMENT-SIGNATURE header with mismatched scheme",
    async (t) => {
      let invalidInjections = 0;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          createV2ResponseInterceptor(),
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/test-resource")) {
              const existingHeaders = new Headers(init?.headers);
              if (existingHeaders.has("PAYMENT-SIGNATURE")) {
                invalidInjections++;
                const headers = new Headers(init?.headers);
                // Mismatched scheme in v2 payload
                const invalidPayload = JSON.stringify({
                  x402Version: 2,
                  accepted: {
                    scheme: "wrong-scheme",
                    network: TEST_NETWORK,
                    amount: "100",
                    asset: TEST_ASSET,
                    payTo: "test-receiver",
                    maxTimeoutSeconds: 60,
                  },
                  payload: {
                    testId: "test-123",
                    amount: "100",
                    timestamp: Date.now(),
                  },
                });
                headers.set("PAYMENT-SIGNATURE", btoa(invalidPayload));
                return fetch(input, { ...init, headers });
              }
            }
            return fetch(input, init);
          },
        ],
      });

      const fetch = harness.createFetch();

      try {
        await fetch("/test-resource");
        t.fail("should throw error for mismatched scheme");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        t.ok(invalidInjections > 0, "invalid header should have been injected");
      }

      t.end();
    },
  );

  await t.test("client sends empty PAYMENT-SIGNATURE header", async (t) => {
    let emptyHeaderInjections = 0;

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [
        createV2ResponseInterceptor(),
        (fetch) => async (input, init) => {
          const url = getURLFromRequestInfo(input);
          if (url.includes("/test-resource")) {
            const existingHeaders = new Headers(init?.headers);
            if (existingHeaders.has("PAYMENT-SIGNATURE")) {
              emptyHeaderInjections++;
              const headers = new Headers(init?.headers);
              headers.set("PAYMENT-SIGNATURE", "");
              return fetch(input, { ...init, headers });
            }
          }
          return fetch(input, init);
        },
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw error for empty PAYMENT-SIGNATURE header");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      t.ok(emptyHeaderInjections > 0, "empty header should have been injected");
    }

    t.end();
  });

  await t.test("client strips PAYMENT-SIGNATURE header entirely", async (t) => {
    let strippedCount = 0;

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [
        createV2ResponseInterceptor(),
        (fetch) => async (input, init) => {
          const url = getURLFromRequestInfo(input);
          if (url.includes("/test-resource")) {
            const existingHeaders = new Headers(init?.headers);
            if (existingHeaders.has("PAYMENT-SIGNATURE")) {
              strippedCount++;
              const headers = new Headers(init?.headers);
              headers.delete("PAYMENT-SIGNATURE");
              return fetch(input, { ...init, headers });
            }
          }
          return fetch(input, init);
        },
      ],
    });

    const fetch = harness.createFetch();

    try {
      await fetch("/test-resource");
      t.fail("should throw error when PAYMENT-SIGNATURE header is stripped");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      t.ok(strippedCount > 0, "header should have been stripped at least once");
      if (error instanceof Error) {
        t.match(
          error.message,
          /failed to complete payment after retries/,
          "should fail after retries",
        );
      }
    }

    t.end();
  });

  await t.test("client sends oversized PAYMENT-SIGNATURE header", async (t) => {
    let oversizedInjections = 0;

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [
        createV2ResponseInterceptor(),
        (fetch) => async (input, init) => {
          const url = getURLFromRequestInfo(input);
          if (url.includes("/test-resource")) {
            const existingHeaders = new Headers(init?.headers);
            if (existingHeaders.has("PAYMENT-SIGNATURE")) {
              oversizedInjections++;
              const headers = new Headers(init?.headers);
              // Create a v2 payload with very large metadata
              const oversizedPayload = JSON.stringify({
                x402Version: 2,
                accepted: {
                  scheme: TEST_SCHEME,
                  network: TEST_NETWORK,
                  amount: "100",
                  asset: TEST_ASSET,
                  payTo: "test-receiver",
                  maxTimeoutSeconds: 60,
                },
                payload: {
                  testId: "test-123",
                  amount: "100",
                  timestamp: Date.now(),
                  metadata: {
                    // 100KB of data
                    largeField: "x".repeat(100000),
                  },
                },
              });
              headers.set("PAYMENT-SIGNATURE", btoa(oversizedPayload));
              return fetch(input, { ...init, headers });
            }
          }
          return fetch(input, init);
        },
      ],
    });

    const fetch = harness.createFetch();
    // This might succeed or fail depending on header size limits
    // Just verify it doesn't crash
    try {
      const response = await fetch("/test-resource");
      t.ok(
        [200, 400, 413, 500].includes(response.status),
        "should handle oversized header gracefully",
      );
    } catch (e) {
      // Error is also acceptable for oversized headers
      t.ok(e instanceof Error, "should throw an Error for oversized header");
    }
    t.ok(oversizedInjections > 0, "oversized header should have been injected");

    t.end();
  });
});

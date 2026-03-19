#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  TEST_SCHEME,
  TEST_NETWORK,
  getURLFromRequestInfo,
} from "@faremeter/test-harness";

await t.test("x402 v1 protocol violations", async (t) => {
  await t.test(
    "client sends X-PAYMENT header with invalid base64",
    async (t) => {
      let invalidHeaderInjections = 0;

      const harness = new TestHarness({
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            // Only intercept requests to the resource that have an X-PAYMENT header
            if (url.includes("/test-resource")) {
              const existingHeaders = new Headers(init?.headers);
              if (existingHeaders.has("X-PAYMENT")) {
                // Replace any valid X-PAYMENT header with an invalid one
                invalidHeaderInjections++;
                const headers = new Headers(init?.headers);
                headers.set("X-PAYMENT", "not-valid-base64!!!");
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
    "client sends X-PAYMENT header with valid base64 but invalid JSON",
    async (t) => {
      let invalidInjections = 0;

      const harness = new TestHarness({
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/test-resource")) {
              const existingHeaders = new Headers(init?.headers);
              if (existingHeaders.has("X-PAYMENT")) {
                invalidInjections++;
                const headers = new Headers(init?.headers);
                // Valid base64 but not valid JSON
                headers.set("X-PAYMENT", btoa("not valid json {{{"));
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
    "client sends X-PAYMENT header with JSON missing required fields",
    async (t) => {
      let invalidInjections = 0;

      const harness = new TestHarness({
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/test-resource")) {
              const existingHeaders = new Headers(init?.headers);
              if (existingHeaders.has("X-PAYMENT")) {
                invalidInjections++;
                const headers = new Headers(init?.headers);
                // Valid JSON but missing required fields
                const invalidPayload = JSON.stringify({
                  x402Version: 1,
                  // Missing scheme, network, payload
                });
                headers.set("X-PAYMENT", btoa(invalidPayload));
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
        t.fail("should throw error for incomplete payment payload");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        t.ok(invalidInjections > 0, "invalid header should have been injected");
      }

      t.end();
    },
  );

  // Note: The x402 protocol validates that x402Version is an integer, but does not
  // validate specific version values. A payload with x402Version: 999 is structurally
  // valid and will be processed. The test below verifies this behavior by checking
  // that the middleware does not reject unknown version numbers (forward compatibility).
  await t.test(
    "client sends X-PAYMENT header with unknown x402Version (forward compatibility)",
    async (t) => {
      let versionInjections = 0;

      const harness = new TestHarness({
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/test-resource")) {
              const existingHeaders = new Headers(init?.headers);
              if (existingHeaders.has("X-PAYMENT")) {
                versionInjections++;
                const headers = new Headers(init?.headers);
                // Unknown x402Version - should still be accepted (forward compatibility)
                const payload = JSON.stringify({
                  x402Version: 999,
                  scheme: TEST_SCHEME,
                  network: TEST_NETWORK,
                  payload: {
                    testId: "test-123",
                    amount: "100",
                    timestamp: Date.now(),
                  },
                });
                headers.set("X-PAYMENT", btoa(payload));
                return fetch(input, { ...init, headers });
              }
            }
            return fetch(input, init);
          },
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      // Unknown version numbers are accepted (forward compatibility)
      t.equal(response.status, 200, "should accept unknown x402Version");
      t.ok(versionInjections > 0, "version header should have been injected");

      t.end();
    },
  );

  await t.test(
    "client sends X-PAYMENT header with mismatched scheme",
    async (t) => {
      let invalidInjections = 0;

      const harness = new TestHarness({
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/test-resource")) {
              const existingHeaders = new Headers(init?.headers);
              if (existingHeaders.has("X-PAYMENT")) {
                invalidInjections++;
                const headers = new Headers(init?.headers);
                // Mismatched scheme
                const invalidPayload = JSON.stringify({
                  x402Version: 1,
                  scheme: "wrong-scheme",
                  network: TEST_NETWORK,
                  payload: {
                    testId: "test-123",
                    amount: "100",
                    timestamp: Date.now(),
                  },
                });
                headers.set("X-PAYMENT", btoa(invalidPayload));
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

  await t.test("client sends empty X-PAYMENT header", async (t) => {
    let emptyHeaderInjections = 0;

    const harness = new TestHarness({
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [
        (fetch) => async (input, init) => {
          const url = getURLFromRequestInfo(input);
          if (url.includes("/test-resource")) {
            const existingHeaders = new Headers(init?.headers);
            if (existingHeaders.has("X-PAYMENT")) {
              emptyHeaderInjections++;
              const headers = new Headers(init?.headers);
              headers.set("X-PAYMENT", "");
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
      t.fail("should throw error for empty X-PAYMENT header");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      t.ok(emptyHeaderInjections > 0, "empty header should have been injected");
    }

    t.end();
  });

  await t.test("client strips X-PAYMENT header entirely", async (t) => {
    let strippedCount = 0;

    const harness = new TestHarness({
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [
        (fetch) => async (input, init) => {
          const url = getURLFromRequestInfo(input);
          if (url.includes("/test-resource")) {
            const existingHeaders = new Headers(init?.headers);
            if (existingHeaders.has("X-PAYMENT")) {
              strippedCount++;
              const headers = new Headers(init?.headers);
              headers.delete("X-PAYMENT");
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
      t.fail("should throw error when X-PAYMENT header is stripped");
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

  await t.test("client sends oversized X-PAYMENT header", async (t) => {
    let oversizedInjections = 0;

    const harness = new TestHarness({
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [
        (fetch) => async (input, init) => {
          const url = getURLFromRequestInfo(input);
          if (url.includes("/test-resource")) {
            const existingHeaders = new Headers(init?.headers);
            if (existingHeaders.has("X-PAYMENT")) {
              oversizedInjections++;
              const headers = new Headers(init?.headers);
              // Create a payload with very large metadata
              const oversizedPayload = JSON.stringify({
                x402Version: 1,
                scheme: TEST_SCHEME,
                network: TEST_NETWORK,
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
              headers.set("X-PAYMENT", btoa(oversizedPayload));
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
    } catch {
      // Error is also acceptable for oversized headers
      t.ok(true, "error thrown for oversized header is acceptable");
    }
    t.ok(oversizedInjections > 0, "oversized header should have been injected");

    t.end();
  });
});

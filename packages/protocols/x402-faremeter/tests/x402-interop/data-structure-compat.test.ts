#!/usr/bin/env pnpm tsx

/**
 * Cross-version data structure compatibility tests.
 *
 * Validates that x402 data structures survive the full client-middleware-facilitator
 * flow when crossing protocol version boundaries. While adapter-roundtrip.test.ts
 * tests pure type conversion functions, these tests exercise the full wire-format
 * path: client -> middleware -> facilitator -> middleware -> client.
 *
 * Scenarios:
 *   - v1 client data structures flowing through v2-native facilitator
 *   - v2 client data structures with correct field names (amount vs maxAmountRequired)
 *   - SettlementResponse field name mapping (txHash/networkId vs transaction/network)
 *   - Extra field preservation across version boundaries
 *   - Both supported versions producing appropriate response formats
 */

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  createResponseHook,
  createCaptureInterceptor,
  matchFacilitatorSettle,
  matchResource,
  isResourceContextV1,
  isResourceContextV2,
  getURLFromRequestInfo,
  TEST_SCHEME,
  TEST_NETWORK,
} from "@faremeter/test-harness";

/** Decoded JSON from a wire-format response or header. */
type WireJSON = Record<string, unknown>;

await t.test("x402 cross-version data structure compatibility", async (t) => {
  await t.test(
    "v1 client sends X-PAYMENT, facilitator processes as v2 internally, " +
      "response uses v1 field names (txHash/networkId)",
    async (t) => {
      let capturedPaymentHeader: string | null = null;
      let settleResponseOnWire: WireJSON | null = null;

      const harness = new TestHarness({
        // Default: v1 supported
        settleMode: "settle-only",
        accepts: [
          accepts({
            maxAmountRequired: "10000",
            resource: "https://api.example.com/data",
            description: "Cross-version test",
            mimeType: "application/json",
            extra: { name: "USDC", version: "2" },
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/test-resource")) {
              const headers = new Headers(init?.headers);
              if (headers.has("X-PAYMENT")) {
                capturedPaymentHeader = headers.get("X-PAYMENT");
              }
            }
            return fetch(input, init);
          },
        ],
        middlewareInterceptors: [
          createResponseHook(matchFacilitatorSettle, async (_url, response) => {
            settleResponseOnWire = (await response.clone().json()) as WireJSON;
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "v1 flow should succeed");

      // v1 client should use X-PAYMENT header
      t.ok(capturedPaymentHeader, "X-PAYMENT header should be set");
      if (capturedPaymentHeader) {
        const payload = JSON.parse(atob(capturedPaymentHeader)) as WireJSON;
        t.equal(payload.x402Version, 1, "payload should be v1 version");
        t.equal(payload.scheme, TEST_SCHEME, "scheme should match");
        t.equal(payload.network, TEST_NETWORK, "network should match");
      }

      // The settle response on the wire between middleware and facilitator
      // uses v1 spec-compliant field names (transaction, network, errorReason)
      const sRes = settleResponseOnWire as WireJSON | null;
      t.ok(sRes, "settle response should be captured");
      if (sRes) {
        t.equal(sRes.success, true, "settle should be successful");
        // v1 spec uses transaction and network
        t.ok(sRes.transaction, "should have transaction (v1 spec field)");
        t.ok(sRes.network, "should have network (v1 spec field)");
      }

      t.end();
    },
  );

  await t.test(
    "v2 client sends PAYMENT-SIGNATURE, receives PAYMENT-RESPONSE " +
      "with transaction/network field names",
    async (t) => {
      let capturedPaymentHeader: string | null = null;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [
          accepts({
            maxAmountRequired: "5000",
            extra: { name: "USDC", version: "2" },
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [
          createV2ResponseInterceptor(),
          (fetch) => async (input, init) => {
            const url = getURLFromRequestInfo(input);
            if (url.includes("/test-resource")) {
              const headers = new Headers(init?.headers);
              if (headers.has("PAYMENT-SIGNATURE")) {
                capturedPaymentHeader = headers.get("PAYMENT-SIGNATURE");
              }
            }
            return fetch(input, init);
          },
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "v2 flow should succeed");

      // v2 client should use PAYMENT-SIGNATURE header
      t.ok(capturedPaymentHeader, "PAYMENT-SIGNATURE header should be set");
      if (capturedPaymentHeader) {
        const payload = JSON.parse(atob(capturedPaymentHeader)) as WireJSON;
        t.equal(payload.x402Version, 2, "payload should be v2 version");
        // v2 has "accepted" field containing requirements
        t.ok(payload.accepted, "v2 payload has accepted field");
        const accepted = payload.accepted as WireJSON;
        t.ok(accepted.amount, "accepted uses amount (v2 field)");
      }

      // v2 response header should be PAYMENT-RESPONSE
      const responseHeader = response.headers.get("PAYMENT-RESPONSE");
      t.ok(responseHeader, "PAYMENT-RESPONSE header should be set");
      if (responseHeader) {
        const decoded = JSON.parse(atob(responseHeader)) as WireJSON;
        t.ok(decoded.transaction, "response header has transaction (v2 field)");
        t.ok(decoded.network, "response header has network (v2 field)");
      }

      t.end();
    },
  );

  await t.test(
    "extra field in requirements preserved through v1 and v2 flows",
    async (t) => {
      const complexExtra = {
        name: "USDC",
        version: "2",
        config: { gasless: true, maxRetries: 5 },
        tags: ["eip3009", "stable"],
      };

      // Test v1 flow preserves extra
      let v1CapturedExtra: object | undefined;
      const v1Harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts({ extra: complexExtra })],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: (req) => {
              v1CapturedExtra = req.extra;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      const v1Fetch = v1Harness.createFetch();
      const v1Response = await v1Fetch("/test-resource");
      t.equal(v1Response.status, 200, "v1 flow should succeed");

      t.ok(v1CapturedExtra, "extra should reach facilitator in v1 flow");
      if (v1CapturedExtra) {
        const extra = v1CapturedExtra as Record<string, unknown>;
        t.equal(extra.name, "USDC", "v1 extra.name preserved");
        t.equal(extra.version, "2", "v1 extra.version preserved");
        t.same(
          extra.config,
          { gasless: true, maxRetries: 5 },
          "v1 extra.config preserved",
        );
        t.same(extra.tags, ["eip3009", "stable"], "v1 extra.tags preserved");
      }

      // Test v2 flow preserves extra
      let v2CapturedExtra: object | undefined;
      const v2Harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts({ extra: complexExtra })],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: (req) => {
              v2CapturedExtra = req.extra;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      const v2Fetch = v2Harness.createFetch();
      const v2Response = await v2Fetch("/test-resource");
      t.equal(v2Response.status, 200, "v2 flow should succeed");

      t.ok(v2CapturedExtra, "extra should reach facilitator in v2 flow");
      if (v2CapturedExtra) {
        const extra = v2CapturedExtra as Record<string, unknown>;
        t.equal(extra.name, "USDC", "v2 extra.name preserved");
        t.equal(extra.version, "2", "v2 extra.version preserved");
        t.same(
          extra.config,
          { gasless: true, maxRetries: 5 },
          "v2 extra.config preserved",
        );
        t.same(extra.tags, ["eip3009", "stable"], "v2 extra.tags preserved");
      }

      t.end();
    },
  );

  await t.test(
    "resource context exposes version-appropriate settle response fields",
    async (t) => {
      // v1 context should have spec-compliant transaction/network fields
      const v1Harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      let v1HasTransaction = false;
      let v1HasNetwork = false;
      let v1Captured = false;
      v1Harness.setResourceHandler((ctx) => {
        if (isResourceContextV1(ctx)) {
          v1Captured = true;
          v1HasTransaction = "transaction" in ctx.settleResponse;
          v1HasNetwork = "network" in ctx.settleResponse;
        }
        return { status: 200, body: { ok: true } };
      });

      const v1Fetch = v1Harness.createFetch();
      await v1Fetch("/test-resource");

      t.ok(v1Captured, "v1 context should be captured");
      t.equal(v1HasTransaction, true, "v1 context has transaction");
      t.equal(v1HasNetwork, true, "v1 context has network");

      // v2 context should have transaction/network
      const v2Harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      let v2HasTransaction = false;
      let v2HasNetwork = false;
      let v2Captured = false;
      v2Harness.setResourceHandler((ctx) => {
        if (isResourceContextV2(ctx)) {
          v2Captured = true;
          v2HasTransaction = "transaction" in ctx.settleResponse;
          v2HasNetwork = "network" in ctx.settleResponse;
        }
        return { status: 200, body: { ok: true } };
      });

      const v2Fetch = v2Harness.createFetch();
      await v2Fetch("/test-resource");

      t.ok(v2Captured, "v2 context should be captured");
      t.equal(v2HasTransaction, true, "v2 context has transaction");
      t.equal(v2HasNetwork, true, "v2 context has network");

      t.end();
    },
  );

  await t.test(
    "both versions enabled: 402 has v1 JSON body and v2 PAYMENT-REQUIRED header",
    async (t) => {
      const { interceptor: captureInterceptor, captured } =
        createCaptureInterceptor(matchResource);

      const harness = new TestHarness({
        supportedVersions: { x402v1: true, x402v2: true },
        settleMode: "settle-only",
        accepts: [
          accepts({
            maxAmountRequired: "7500",
            resource: "https://api.example.com/both",
            description: "Both versions test",
            mimeType: "application/json",
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [captureInterceptor],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "dual-version flow should succeed");

      // Find the 402 capture
      const initial402 = captured.find((c) => c.response.status === 402);
      t.ok(initial402, "should have captured a 402 response");

      if (initial402) {
        // v1: JSON body should have x402Version: 1
        const body = (await initial402.response.json()) as WireJSON;
        t.equal(body.x402Version, 1, "body should be v1 format");
        const acceptsArr = body.accepts as WireJSON[] | undefined;
        t.ok(Array.isArray(acceptsArr), "body should have accepts array");
        if (acceptsArr?.[0]) {
          t.ok(
            acceptsArr[0].maxAmountRequired,
            "v1 body uses maxAmountRequired",
          );
        }

        // v2: PAYMENT-REQUIRED header should also be present
        const v2Header = initial402.response.headers.get("PAYMENT-REQUIRED");
        t.ok(
          v2Header,
          "PAYMENT-REQUIRED header should be present for v2 clients",
        );
        if (v2Header) {
          const v2Body = JSON.parse(atob(v2Header)) as WireJSON;
          t.equal(v2Body.x402Version, 2, "v2 header should have version 2");
          t.ok(v2Body.resource, "v2 header has resource object");
          const v2Accepts = v2Body.accepts as WireJSON[] | undefined;
          t.ok(Array.isArray(v2Accepts), "v2 header has accepts array");
          if (v2Accepts?.[0]) {
            t.ok(
              v2Accepts[0].amount,
              "v2 header uses amount (not maxAmountRequired)",
            );
          }
        }
      }

      t.end();
    },
  );
});

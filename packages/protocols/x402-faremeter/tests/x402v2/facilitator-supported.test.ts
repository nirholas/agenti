#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createSimpleFacilitatorHandler,
  TEST_SCHEME,
  TEST_NETWORK,
  matchFacilitatorSupported,
} from "@faremeter/test-harness";
import type { x402SupportedResponse } from "@faremeter/types/x402v2";

await t.test("x402 v2 facilitator /supported endpoint", async (t) => {
  await t.test("returns supported kinds from test handler", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const response = await harness.app.request("/facilitator/supported");

    t.equal(response.status, 200, "should return 200");
    const body = (await response.json()) as x402SupportedResponse;
    t.ok(body.kinds, "should have kinds array");
    t.ok(Array.isArray(body.kinds), "kinds should be an array");
    t.ok(body.kinds.length > 0, "should have at least one kind");
    t.equal(body.kinds[0]?.scheme, TEST_SCHEME, "should have test scheme");
    t.equal(body.kinds[0]?.network, TEST_NETWORK, "should have test network");
    t.equal(body.kinds[0]?.x402Version, 1, "should have x402Version");

    t.end();
  });

  await t.test(
    "returns v2 format with extensions and signers when requested",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      // Request v2 format via query param
      const response = await harness.app.request(
        "/facilitator/supported?version=2",
      );

      t.equal(response.status, 200, "should return 200");
      const body = (await response.json()) as x402SupportedResponse;
      t.ok(body.kinds, "should have kinds array");
      t.ok(body.extensions, "should have extensions array");
      t.ok(Array.isArray(body.extensions), "extensions should be an array");
      t.ok(body.signers, "should have signers object");
      t.equal(typeof body.signers, "object", "signers should be an object");

      t.end();
    },
  );

  await t.test("returns empty kinds when no getSupported", async (t) => {
    // Create handler without getSupported
    const handlerWithoutSupported = createSimpleFacilitatorHandler({
      networkId: TEST_NETWORK,
    });

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [handlerWithoutSupported],
      clientHandlers: [createTestPaymentHandler()],
    });

    const response = await harness.app.request("/facilitator/supported");

    t.equal(response.status, 200, "should return 200");
    const body = (await response.json()) as x402SupportedResponse;
    t.ok(body.kinds, "should have kinds array");
    t.same(body.kinds, [], "kinds should be empty");

    t.end();
  });

  await t.test("returns kinds from multiple handlers", async (t) => {
    const handler1 = createSimpleFacilitatorHandler({
      networkId: "network-a",
      getSupported: () => [
        Promise.resolve({
          x402Version: 2 as const,
          scheme: "scheme-a",
          network: "network-a",
        }),
      ],
    });

    const handler2 = createSimpleFacilitatorHandler({
      networkId: "network-b",
      getSupported: () => [
        Promise.resolve({
          x402Version: 2 as const,
          scheme: "scheme-b",
          network: "network-b",
        }),
      ],
    });

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [],
      facilitatorHandlers: [handler1, handler2],
      clientHandlers: [],
    });

    const response = await harness.app.request("/facilitator/supported");

    t.equal(response.status, 200, "should return 200");
    const body = (await response.json()) as x402SupportedResponse;
    t.ok(body.kinds, "should have kinds array");
    // Each handler provides 1 kind, but we advertise both v1 and v2 versions = 4 total
    t.equal(
      body.kinds.length,
      4,
      "should have 4 kinds (2 handlers x 2 versions)",
    );

    const schemes = body.kinds.map((k) => k.scheme);
    t.ok(schemes.includes("scheme-a"), "should include scheme-a");
    t.ok(schemes.includes("scheme-b"), "should include scheme-b");

    t.end();
  });

  await t.test("handles handler that throws in getSupported", async (t) => {
    const throwingHandler = createSimpleFacilitatorHandler({
      networkId: TEST_NETWORK,
      getSupported: () => [Promise.reject(new Error("getSupported failed"))],
    });

    const workingHandler = createTestFacilitatorHandler({
      payTo: "test-receiver",
    });

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [],
      facilitatorHandlers: [throwingHandler, workingHandler],
      clientHandlers: [],
    });

    const response = await harness.app.request("/facilitator/supported");

    t.equal(
      response.status,
      200,
      "should return 200 even if one handler fails",
    );
    const body = (await response.json()) as x402SupportedResponse;
    t.ok(body.kinds, "should have kinds array");
    // Should still include kinds from working handler
    t.ok(body.kinds.length > 0, "should have kinds from working handler");

    t.end();
  });

  await t.test("matcher correctly identifies /supported URL", async (t) => {
    t.ok(
      matchFacilitatorSupported("http://test/facilitator/supported"),
      "matcher should match /supported URL",
    );
    t.ok(
      !matchFacilitatorSupported("http://test/facilitator/verify"),
      "matcher should not match /verify URL",
    );

    t.end();
  });

  await t.test("supported endpoint returns extra fields", async (t) => {
    const handlerWithExtra = createSimpleFacilitatorHandler({
      networkId: TEST_NETWORK,
      getSupported: () => [
        Promise.resolve({
          x402Version: 2 as const,
          scheme: TEST_SCHEME,
          network: TEST_NETWORK,
          extra: {
            minAmount: "10",
            maxAmount: "10000",
            supportedAssets: ["USDC", "USDT"],
          },
        }),
      ],
    });

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [],
      facilitatorHandlers: [handlerWithExtra],
      clientHandlers: [],
    });

    const response = await harness.app.request("/facilitator/supported");

    t.equal(response.status, 200, "should return 200");
    const body = (await response.json()) as x402SupportedResponse;
    const extra = body.kinds[0]?.extra as Record<string, unknown> | undefined;
    t.ok(extra, "should have extra field");
    t.equal(extra?.minAmount, "10", "should have minAmount");
    t.equal(extra?.maxAmount, "10000", "should have maxAmount");
    t.same(
      extra?.supportedAssets,
      ["USDC", "USDT"],
      "should have supportedAssets",
    );

    t.end();
  });

  await t.test("supported endpoint with no facilitator handlers", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [],
      facilitatorHandlers: [],
      clientHandlers: [],
    });

    const response = await harness.app.request("/facilitator/supported");

    t.equal(response.status, 200, "should return 200");
    const body = (await response.json()) as x402SupportedResponse;
    t.same(body.kinds, [], "should return empty kinds array");

    t.end();
  });

  await t.test("v2 format request returns both v1 and v2 kinds", async (t) => {
    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    // Request v2 format
    const response = await harness.app.request(
      "/facilitator/supported?version=2",
    );

    t.equal(response.status, 200, "should return 200");
    const body = (await response.json()) as x402SupportedResponse;
    t.ok(body.kinds.length > 0, "should have kinds");

    // Both v1 and v2 versions should be advertised
    const v1Kind = body.kinds.find((k) => k.x402Version === 1);
    const v2Kind = body.kinds.find((k) => k.x402Version === 2);
    t.ok(v1Kind, "should have v1 kind");
    t.ok(v2Kind, "should have v2 kind");

    t.end();
  });
});

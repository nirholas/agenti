#!/usr/bin/env pnpm tsx

/**
 * x402 v2 data structure integration tests.
 *
 * Validates that spec-compliant v2 data structures (PaymentRequired,
 * PaymentPayload, SettlementResponse, VerifyResponse, SupportedResponseV2)
 * are correctly handled end-to-end by the client, middleware, and facilitator.
 *
 * Key v2 differences from v1:
 *   - CAIP-2 network identifiers (e.g. "eip155:84532")
 *   - ResourceInfo separated from PaymentRequirements
 *   - "amount" instead of "maxAmountRequired"
 *   - PaymentPayload includes "accepted" requirements
 *   - PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE headers
 *   - SupportedResponseV2 includes extensions and signers
 *   - SettlementResponse uses "transaction"/"network" (not "txHash"/"networkId")
 *
 * Spec reference: https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
 * Transport reference: https://github.com/coinbase/x402/blob/main/specs/transports-v2/http.md
 */

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  createV2ResponseInterceptor,
  createCaptureInterceptor,
  createResponseHook,
  createFailureInterceptor,
  matchResource,
  matchFacilitatorSettle,
  matchFacilitatorVerify,
  matchFacilitatorAccepts,
  verifyFailedResponse,
  settleFailedResponseV2,
  isResourceContextV2,
  getURLFromRequestInfo,
  suppressConsoleErrors,
  TEST_SCHEME,
  TEST_NETWORK,
} from "@faremeter/test-harness";

/** Decoded JSON from a wire-format response or header. */
type WireJSON = Record<string, unknown>;

await t.test("x402 v2 data structure examples", async (t) => {
  await t.test(
    "PAYMENT-REQUIRED header contains spec-compliant v2 PaymentRequired",
    async (t) => {
      const { interceptor: captureInterceptor, captured } =
        createCaptureInterceptor(matchResource);

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [
          accepts({
            maxAmountRequired: "10000",
            resource: "https://api.example.com/premium-data",
            description: "Access to premium market data",
            mimeType: "application/json",
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [captureInterceptor, createV2ResponseInterceptor()],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "end-to-end flow should succeed");

      // The first captured response should be the 402 with PAYMENT-REQUIRED header
      const firstCapture = captured[0];
      t.ok(firstCapture, "should have captured a request");
      if (!firstCapture) {
        return t.end();
      }
      t.equal(
        firstCapture.response.status,
        402,
        "first captured response should be 402",
      );
      if (firstCapture.response.status !== 402) {
        return t.end();
      }

      const paymentRequiredHeader =
        firstCapture.response.headers.get("PAYMENT-REQUIRED");
      t.ok(paymentRequiredHeader, "PAYMENT-REQUIRED header should be present");
      if (!paymentRequiredHeader) {
        return t.end();
      }

      const body = JSON.parse(atob(paymentRequiredHeader)) as WireJSON;

      // Validate v2 PaymentRequired schema per spec Section 5.1
      t.equal(body.x402Version, 2, "x402Version should be 2");
      t.ok(body.resource, "resource object should be present");
      const resource = body.resource as WireJSON;
      t.ok(resource.url, "resource.url should be present");
      const acceptsArr = body.accepts as WireJSON[];
      t.ok(Array.isArray(acceptsArr), "accepts should be an array");
      t.ok(acceptsArr.length >= 1, "accepts should have at least one item");

      const req = acceptsArr[0];
      t.ok(req, "first accepts entry should exist");
      if (!req) {
        return t.end();
      }

      t.equal(req.scheme, TEST_SCHEME, "scheme field present");
      t.equal(req.network, TEST_NETWORK, "network field present");
      t.ok(
        req.amount,
        "amount field present (v2 uses amount, not maxAmountRequired)",
      );
      t.ok(req.asset, "asset field present");
      t.ok(req.payTo, "payTo field present");
      t.equal(
        typeof req.maxTimeoutSeconds,
        "number",
        "maxTimeoutSeconds is number",
      );

      t.end();
    },
  );

  await t.test(
    "PAYMENT-SIGNATURE header contains spec-compliant v2 PaymentPayload",
    async (t) => {
      let capturedPaymentHeader: string | null = null;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
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

      t.equal(response.status, 200, "flow should succeed");
      t.ok(capturedPaymentHeader, "PAYMENT-SIGNATURE header should be present");
      if (!capturedPaymentHeader) {
        return t.end();
      }

      // Decode base64 to JSON per v2 HTTP transport spec
      const decoded = JSON.parse(atob(capturedPaymentHeader)) as WireJSON;

      // Validate v2 PaymentPayload schema per spec Section 5.2
      t.equal(decoded.x402Version, 2, "x402Version should be 2");
      t.ok(decoded.accepted, "accepted field present (v2-specific)");
      t.ok(decoded.payload, "payload field present");
      t.equal(typeof decoded.payload, "object", "payload is an object");

      // The accepted field should contain the chosen requirements
      const accepted = decoded.accepted as WireJSON;
      t.equal(accepted.scheme, TEST_SCHEME, "accepted.scheme present");
      t.equal(accepted.network, TEST_NETWORK, "accepted.network present");
      t.ok(accepted.amount, "accepted.amount present");

      // Test scheme payload has testId, amount, timestamp
      const payload = decoded.payload as WireJSON;
      t.ok(payload.testId, "payload.testId present");
      t.ok(payload.amount, "payload.amount present");
      t.ok(payload.timestamp, "payload.timestamp present");

      t.end();
    },
  );

  await t.test(
    "PAYMENT-RESPONSE header contains v2 SettlementResponse on success",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "flow should succeed");

      const paymentResponseHeader = response.headers.get("PAYMENT-RESPONSE");
      t.ok(paymentResponseHeader, "PAYMENT-RESPONSE header should be present");
      if (!paymentResponseHeader) {
        return t.end();
      }

      const decoded = JSON.parse(atob(paymentResponseHeader)) as WireJSON;

      // Validate v2 SettlementResponse per spec Section 5.3
      // v2 uses "transaction" and "network" (not "txHash" and "networkId")
      t.equal(decoded.success, true, "success should be true");
      t.ok(
        decoded.transaction,
        "transaction should be present (v2 field name)",
      );
      t.ok(decoded.network, "network should be present (v2 field name)");
      t.equal(decoded.network, TEST_NETWORK, "network should match");

      t.end();
    },
  );

  await t.test(
    "facilitator /verify returns v2-shaped response with payer field",
    async (t) => {
      let verifyResponseBody: WireJSON | null = null;

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
          createResponseHook(matchFacilitatorVerify, async (_url, response) => {
            verifyResponseBody = (await response.clone().json()) as WireJSON;
          }),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "flow should succeed");

      // v2 verify response per spec Section 5.4
      const vRes = verifyResponseBody as WireJSON | null;
      t.ok(vRes, "verify response should be captured");
      if (!vRes) {
        return t.end();
      }

      t.equal(vRes.isValid, true, "isValid should be true");
      t.equal(typeof vRes.isValid, "boolean", "isValid is boolean");
      t.equal(vRes.payer, "test-payer", "payer should be populated");

      t.end();
    },
  );

  await t.test("facilitator /settle returns v2-shaped response", async (t) => {
    let settleResponseBody: WireJSON | null = null;

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
        createResponseHook(matchFacilitatorSettle, async (_url, response) => {
          settleResponseBody = (await response.clone().json()) as WireJSON;
        }),
      ],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "flow should succeed");

    // v2 settle response per spec Section 5.3
    const sRes = settleResponseBody as WireJSON | null;
    t.ok(sRes, "settle response should be captured");
    if (!sRes) {
      return t.end();
    }

    t.equal(sRes.success, true, "success should be true");
    t.ok(sRes.transaction, "transaction field present (v2 name)");
    t.ok(sRes.network, "network field present (v2 name)");
    t.equal(sRes.payer, "test-payer", "payer should be populated");

    t.end();
  });

  await t.test(
    "/supported?version=2 returns spec-compliant v2 SupportedResponse",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      const response = await harness.app.request(
        "/facilitator/supported?version=2",
      );
      t.equal(response.status, 200, "should return 200");

      const body = (await response.json()) as WireJSON;

      // Validate v2 SupportedResponseV2 per spec Section 7.3
      t.ok(Array.isArray(body.kinds), "kinds should be an array");
      const kinds = body.kinds as unknown[];
      t.ok(kinds.length >= 1, "should have at least one kind");

      // v2 response has extensions and signers fields
      t.ok(Array.isArray(body.extensions), "extensions should be an array");
      t.ok(body.signers, "signers should be present");
      t.equal(typeof body.signers, "object", "signers should be an object");

      t.end();
    },
  );

  await t.test(
    "v2 resource info with url, description, and mimeType",
    async (t) => {
      let capturedResourceInfo: WireJSON | null = null;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [
          accepts({
            resource: "https://api.example.com/data",
            description: "Premium data API",
            mimeType: "application/json",
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      harness.setResourceHandler((ctx) => {
        if (isResourceContextV2(ctx)) {
          // In v2, resource info is on the payload, not in requirements
          capturedResourceInfo = {
            url: ctx.resource,
          };
        }
        return { status: 200, body: { ok: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "flow should succeed");
      t.ok(capturedResourceInfo, "resource info should be accessible");

      t.end();
    },
  );

  await t.test(
    "v2 PaymentRequired with empty extensions succeeds",
    async (t) => {
      let facilitatorSettleCalled = false;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts()],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: () => {
              facilitatorSettleCalled = true;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      let resourceHandlerCalled = false;
      harness.setResourceHandler(() => {
        resourceHandlerCalled = true;
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "flow with empty extensions should succeed",
      );
      t.ok(resourceHandlerCalled, "resource handler should have been called");
      t.ok(
        facilitatorSettleCalled,
        "facilitator settle should have been called",
      );
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
    "v2 requirements use amount field instead of maxAmountRequired",
    async (t) => {
      let capturedRequirements: WireJSON | null = null;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [accepts({ maxAmountRequired: "5000" })],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
        middlewareInterceptors: [
          createResponseHook(
            matchFacilitatorAccepts,
            async (_url, response) => {
              capturedRequirements = (await response
                .clone()
                .json()) as WireJSON;
            },
          ),
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "flow should succeed");

      // Internally the facilitator uses v2 types (amount), even though
      // the test harness starts with v1 accepts that use maxAmountRequired.
      // The facilitator adapter converts maxAmountRequired -> amount.
      t.ok(capturedRequirements, "should have captured /accepts response");
      if (!capturedRequirements) {
        return t.end();
      }

      // Verify the captured requirements use v2 field names.
      // The /accepts response is a v2 PaymentRequired object with an accepts array.
      const body = capturedRequirements as WireJSON;
      const arr = body.accepts;
      t.ok(
        Array.isArray(arr),
        "/accepts response should have an accepts array",
      );
      if (!Array.isArray(arr)) {
        return t.end();
      }
      t.ok(arr.length > 0, "accepts should have at least one entry");
      const first = (arr as WireJSON[])[0];
      t.ok(first, "first requirement should exist");
      if (!first) {
        return t.end();
      }
      t.ok(first.amount, "v2 requirements should have amount field");
      t.notOk(
        first.maxAmountRequired,
        "v2 requirements should not have maxAmountRequired field",
      );

      t.end();
    },
  );

  await t.test(
    "multiple accepts entries with different amounts (v2)",
    async (t) => {
      let facilitatorSettleCalled = false;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [
          accepts({ maxAmountRequired: "100" }),
          accepts({ maxAmountRequired: "500", asset: "OTHER-ASSET" }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: () => {
              facilitatorSettleCalled = true;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      let resourceHandlerCalled = false;
      harness.setResourceHandler(() => {
        resourceHandlerCalled = true;
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "should succeed with multiple v2 accepts entries",
      );
      t.ok(resourceHandlerCalled, "resource handler should have been called");
      t.ok(
        facilitatorSettleCalled,
        "facilitator settle should have been called",
      );
      const body = await response.json();
      t.same(
        body,
        { success: true },
        "response body should match resource handler output",
      );

      t.end();
    },
  );

  await t.test('v2 amount "1" (minimum non-zero) succeeds', async (t) => {
    let facilitatorSettleCalled = false;

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [accepts({ maxAmountRequired: "1" })],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: () => {
            facilitatorSettleCalled = true;
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    let resourceHandlerCalled = false;
    harness.setResourceHandler(() => {
      resourceHandlerCalled = true;
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, 'v2 amount "1" should succeed');
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
    "v2 18-digit amount (USDC max precision) succeeds",
    async (t) => {
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
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      let resourceHandlerCalled = false;
      harness.setResourceHandler(() => {
        resourceHandlerCalled = true;
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "v2 18-digit amount should succeed");
      t.ok(resourceHandlerCalled, "resource handler should have been called");
      t.ok(
        facilitatorSettleCalled,
        "facilitator settle should have been called",
      );
      const body = await response.json();
      t.same(
        body,
        { success: true },
        "response body should match resource handler output",
      );

      t.end();
    },
  );

  await t.test("v2 extra field with nested objects and arrays", async (t) => {
    let capturedExtra: object | undefined;

    const harness = new TestHarness({
      supportedVersions: { x402v2: true },
      settleMode: "settle-only",
      accepts: [
        accepts({
          extra: {
            name: "USDC",
            version: "2",
            supported: ["eip3009", "eip2612"],
            config: { gasless: true, maxRetries: 3 },
          },
        }),
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: (req) => {
            capturedExtra = req.extra;
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [createV2ResponseInterceptor()],
    });

    let resourceHandlerCalled = false;
    harness.setResourceHandler(() => {
      resourceHandlerCalled = true;
      return { status: 200, body: { success: true } };
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "v2 nested extra object should succeed");
    t.ok(resourceHandlerCalled, "resource handler should have been called");
    t.ok(capturedExtra, "extra field should reach facilitator");
    if (!capturedExtra) {
      return t.end();
    }

    const extra = capturedExtra as Record<string, unknown>;
    t.equal(extra.name, "USDC", "extra.name preserved");
    t.equal(extra.version, "2", "extra.version preserved");
    t.same(
      extra.supported,
      ["eip3009", "eip2612"],
      "extra.supported preserved",
    );
    t.same(
      extra.config,
      { gasless: true, maxRetries: 3 },
      "extra.config preserved",
    );
    const body = await response.json();
    t.same(
      body,
      { success: true },
      "response body should match resource handler output",
    );

    t.end();
  });

  await t.test(
    "resource handler context contains all v2 data structure fields",
    async (t) => {
      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "verify-then-settle",
        accepts: [
          accepts({
            maxAmountRequired: "500",
            resource: "https://api.example.com/data",
            description: "Test data endpoint",
            mimeType: "text/plain",
            extra: { tier: "premium" },
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      let contextValid = false;

      harness.setResourceHandler((ctx) => {
        if (isResourceContextV2(ctx)) {
          contextValid = true;

          // paymentRequirements should match v2 schema
          const req = ctx.paymentRequirements;
          t.equal(req.scheme, TEST_SCHEME, "ctx requirements.scheme");
          t.equal(req.network, TEST_NETWORK, "ctx requirements.network");
          // v2 uses "amount" not "maxAmountRequired"
          t.ok(req.amount, "ctx requirements.amount present (v2 field)");
          t.ok(req.payTo, "ctx requirements.payTo present");
          t.ok(req.asset, "ctx requirements.asset present");

          // paymentPayload should match v2 schema
          const payload = ctx.paymentPayload;
          t.equal(
            payload.x402Version,
            2,
            "ctx payload.x402Version should be 2",
          );
          t.ok(payload.accepted, "ctx payload.accepted present (v2 field)");
          t.ok(payload.payload, "ctx payload.payload present");

          // settleResponse should match v2 schema (transaction/network)
          const settle = ctx.settleResponse;
          t.equal(settle.success, true, "ctx settle.success");
          t.ok(settle.transaction, "ctx settle.transaction present (v2 field)");
          t.ok(settle.network, "ctx settle.network present (v2 field)");

          // verifyResponse available in verify-then-settle mode
          t.ok(ctx.verifyResponse, "ctx verifyResponse present");
          t.equal(ctx.verifyResponse?.isValid, true, "ctx verify.isValid");
        }
        return { status: 200, body: { ok: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "flow should succeed");
      t.ok(contextValid, "resource handler should receive valid v2 context");

      t.end();
    },
  );

  await t.test(
    "v2 payment with extra field round-trips through facilitator",
    async (t) => {
      let capturedExtra: object | undefined;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [
          accepts({
            extra: { name: "USDC", version: "2" },
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: (req) => {
              capturedExtra = req.extra;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "flow should succeed");
      t.ok(capturedExtra, "extra field should reach facilitator");
      if (!capturedExtra) {
        return t.end();
      }

      const extra = capturedExtra as Record<string, unknown>;
      t.equal(extra.name, "USDC", "extra.name preserved");
      t.equal(extra.version, "2", "extra.version preserved");

      t.end();
    },
  );

  await t.test(
    "v2 PaymentRequirements with minimal fields succeeds",
    async (t) => {
      let facilitatorSettleCalled = false;

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [
          accepts({
            // Only required fields from v1 that map to v2
            maxAmountRequired: "100",
            resource: "http://example.com/test",
            description: "Minimal",
            mimeType: "application/json",
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: () => {
              facilitatorSettleCalled = true;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [createV2ResponseInterceptor()],
      });

      let resourceHandlerCalled = false;
      harness.setResourceHandler(() => {
        resourceHandlerCalled = true;
        return { status: 200, body: { success: true } };
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(
        response.status,
        200,
        "v2 flow with minimal fields should succeed",
      );
      t.ok(resourceHandlerCalled, "resource handler should have been called");
      t.ok(
        facilitatorSettleCalled,
        "facilitator settle should have been called",
      );
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
    "PAYMENT-REQUIRED header carries resource.description and resource.mimeType",
    async (t) => {
      const { interceptor: captureInterceptor, captured } =
        createCaptureInterceptor(matchResource);

      const harness = new TestHarness({
        supportedVersions: { x402v2: true },
        settleMode: "settle-only",
        accepts: [
          accepts({
            maxAmountRequired: "1000",
            resource: "https://api.example.com/premium",
            description: "Premium data feed",
            mimeType: "application/json",
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        clientInterceptors: [captureInterceptor, createV2ResponseInterceptor()],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "flow should succeed");

      const firstCapture = captured[0];
      t.ok(firstCapture, "should have captured a request");
      if (!firstCapture) {
        return t.end();
      }
      t.equal(
        firstCapture.response.status,
        402,
        "first captured response should be 402",
      );
      if (firstCapture.response.status !== 402) {
        return t.end();
      }

      const paymentRequiredHeader =
        firstCapture.response.headers.get("PAYMENT-REQUIRED");
      t.ok(paymentRequiredHeader, "PAYMENT-REQUIRED header should be present");
      if (!paymentRequiredHeader) {
        return t.end();
      }

      const body = JSON.parse(atob(paymentRequiredHeader)) as WireJSON;

      t.ok(body.resource, "resource object should be present");
      const resource = body.resource as WireJSON;
      t.equal(
        resource.description,
        "Premium data feed",
        "resource.description should be carried from v1 accepts",
      );
      t.equal(
        resource.mimeType,
        "application/json",
        "resource.mimeType should be carried from v1 accepts",
      );

      t.end();
    },
  );

  await t.test(
    "v2 verify failure response contains invalidReason field",
    async (t) => {
      t.teardown(suppressConsoleErrors());

      let verifyResponseBody: WireJSON | null = null;

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
          createResponseHook(matchFacilitatorVerify, async (_url, response) => {
            verifyResponseBody = (await response.clone().json()) as WireJSON;
          }),
          createFailureInterceptor(matchFacilitatorVerify, () =>
            verifyFailedResponse("insufficient payment amount"),
          ),
        ],
      });

      const fetch = harness.createFetch();
      try {
        await fetch("/test-resource");
      } catch {
        // Expected: payment fails because verify always returns invalid
      }

      const vfRes = verifyResponseBody as WireJSON | null;
      t.ok(vfRes, "should have captured verify response");
      if (!vfRes) {
        return t.end();
      }

      t.equal(vfRes.isValid, false, "isValid should be false on failure");
      t.equal(
        typeof vfRes.invalidReason,
        "string",
        "invalidReason should be a string",
      );
      t.equal(
        vfRes.invalidReason,
        "insufficient payment amount",
        "invalidReason should match the failure reason",
      );

      t.end();
    },
  );

  await t.test(
    "v2 settle failure response contains errorReason field",
    async (t) => {
      t.teardown(suppressConsoleErrors());

      let settleResponseBody: WireJSON | null = null;

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
          createResponseHook(matchFacilitatorSettle, async (_url, response) => {
            settleResponseBody = (await response.clone().json()) as WireJSON;
          }),
          createFailureInterceptor(matchFacilitatorSettle, () =>
            settleFailedResponseV2("insufficient funds", TEST_NETWORK),
          ),
        ],
      });

      const fetch = harness.createFetch();
      try {
        await fetch("/test-resource");
      } catch {
        // Expected: payment fails because settle always returns failure
      }

      const sfRes = settleResponseBody as WireJSON | null;
      t.ok(sfRes, "should have captured settle response");
      if (!sfRes) {
        return t.end();
      }

      t.equal(sfRes.success, false, "success should be false on failure");
      t.equal(
        typeof sfRes.errorReason,
        "string",
        "errorReason should be a string (v2 field name)",
      );
      t.equal(
        sfRes.errorReason,
        "insufficient funds",
        "errorReason should match the failure reason",
      );
      t.ok(
        "transaction" in sfRes,
        "transaction field should be present (v2 schema)",
      );
      t.ok("network" in sfRes, "network field should be present (v2 schema)");

      t.end();
    },
  );
});

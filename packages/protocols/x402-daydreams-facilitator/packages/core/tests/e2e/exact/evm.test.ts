/**
 * E2E Tests: Exact EVM Payment Flow
 *
 * Tests the complete payment flow from HTTP request to settlement.
 * Uses mocked facilitator for verification/settlement to run without testnet funds.
 */

import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { Elysia } from "elysia";
import { parseUnits } from "viem";
import type { x402HTTPResourceServer } from "@x402/core/http";

import { createElysiaPaymentMiddleware } from "../../../src/elysia/index.js";
import { E2E_CONFIG } from "../e2e.config.js";
import { createExactEvmPayment, encodePayment } from "../fixtures/payments.js";

// Mock addresses
const MOCK_FACILITATOR_ADDRESS = "0x1234567890123456789012345678901234567890" as const;
const MOCK_PAYER_ADDRESS = "0xaabbccdd00112233445566778899aabbccddeeff" as const;

describe("Exact EVM Payment E2E", () => {
  let app: Elysia;
  let baseUrl: string;
  let mockProcessHTTPRequest: ReturnType<typeof mock>;
  let mockProcessSettlement: ReturnType<typeof mock>;

  beforeAll(async () => {
    // Create mock HTTP server that simulates the full flow
    mockProcessHTTPRequest = mock(async () => ({
      type: "payment-verified",
      paymentPayload: {
        x402Version: 2,
        accepted: {
          scheme: "exact",
          network: E2E_CONFIG.evm.network,
          asset: E2E_CONFIG.evm.usdc,
          amount: parseUnits("0.01", 6).toString(),
          payTo: MOCK_FACILITATOR_ADDRESS,
        },
        payload: {
          signature: "0x" + "aa".repeat(65),
          authorization: {},
        },
      },
      paymentRequirements: {
        scheme: "exact",
        network: E2E_CONFIG.evm.network,
        asset: E2E_CONFIG.evm.usdc,
        amount: parseUnits("0.01", 6).toString(),
        payTo: MOCK_FACILITATOR_ADDRESS,
      },
    }));

    mockProcessSettlement = mock(async () => ({
      success: true,
      headers: {
        "x-settlement-transaction": "0x" + "ab".repeat(32),
      },
    }));

    const mockHttpServer = {
      registerPaywallProvider: () => {},
      initialize: async () => {},
      processHTTPRequest: mockProcessHTTPRequest,
      processSettlement: mockProcessSettlement,
    } as unknown as x402HTTPResourceServer;

    // Create Elysia app with payment middleware
    app = new Elysia()
      .use(
        createElysiaPaymentMiddleware({
          httpServer: mockHttpServer,
          syncFacilitatorOnStart: false,
        })
      )
      .get("/api/premium", () => ({ message: "premium content" }))
      .get("/api/free", () => ({ message: "free content" }));

    // Start server on random port
    const port = E2E_CONFIG.getRandomPort(15000);
    app.listen(port);
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(() => {
    app.stop();
  });

  test("free endpoint returns 200 without payment", async () => {
    const res = await fetch(`${baseUrl}/api/free`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("free content");
  });

  test("premium endpoint returns 402 without payment header", async () => {
    // Mock to return payment-required response
    mockProcessHTTPRequest.mockImplementationOnce(async () => ({
      type: "payment-error",
      response: {
        status: 402,
        headers: { "content-type": "application/json" },
        body: { error: "payment_required" },
        isHtml: false,
      },
    }));

    const res = await fetch(`${baseUrl}/api/premium`);
    expect(res.status).toBe(402);
  });

  test("premium endpoint processes valid payment", async () => {
    // Reset mocks to default success behavior
    mockProcessHTTPRequest.mockImplementation(async () => ({
      type: "payment-verified",
      paymentPayload: {
        x402Version: 2,
        accepted: {
          scheme: "exact",
          network: E2E_CONFIG.evm.network,
          asset: E2E_CONFIG.evm.usdc,
          amount: parseUnits("0.01", 6).toString(),
          payTo: MOCK_FACILITATOR_ADDRESS,
        },
        payload: {
          signature: "0x" + "aa".repeat(65),
          authorization: {},
        },
      },
      paymentRequirements: {
        scheme: "exact",
        network: E2E_CONFIG.evm.network,
        asset: E2E_CONFIG.evm.usdc,
        amount: parseUnits("0.01", 6).toString(),
        payTo: MOCK_FACILITATOR_ADDRESS,
      },
    }));

    mockProcessSettlement.mockImplementation(async () => ({
      success: true,
      headers: {
        "x-settlement-transaction": "0x" + "ab".repeat(32),
      },
    }));

    const payment = createExactEvmPayment({
      amount: parseUnits("0.01", 6),
      asset: E2E_CONFIG.evm.usdc,
      network: E2E_CONFIG.evm.network,
      payTo: MOCK_FACILITATOR_ADDRESS,
      from: MOCK_PAYER_ADDRESS,
    });
    payment.payload.signature = "0x" + "aa".repeat(65);

    const res = await fetch(`${baseUrl}/api/premium`, {
      headers: {
        "x-payment": encodePayment(payment),
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("premium content");

    // Verify settlement was called
    expect(mockProcessSettlement).toHaveBeenCalled();

    // Check settlement transaction header
    const txHeader = res.headers.get("x-settlement-transaction");
    expect(txHeader).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test("returns 402 when verification fails", async () => {
    mockProcessHTTPRequest.mockImplementationOnce(async () => ({
      type: "payment-error",
      response: {
        status: 402,
        headers: { "content-type": "application/json" },
        body: { error: "invalid_signature" },
        isHtml: false,
      },
    }));

    const payment = createExactEvmPayment({
      amount: parseUnits("0.01", 6),
      asset: E2E_CONFIG.evm.usdc,
      network: E2E_CONFIG.evm.network,
      payTo: MOCK_FACILITATOR_ADDRESS,
      from: MOCK_PAYER_ADDRESS,
    });
    payment.payload.signature = "0x" + "00".repeat(65);

    const res = await fetch(`${baseUrl}/api/premium`, {
      headers: {
        "x-payment": encodePayment(payment),
      },
    });

    expect(res.status).toBe(402);
  });

  test("handles settlement failure gracefully", async () => {
    // Verification succeeds
    mockProcessHTTPRequest.mockImplementationOnce(async () => ({
      type: "payment-verified",
      paymentPayload: {
        x402Version: 2,
        accepted: {
          scheme: "exact",
          network: E2E_CONFIG.evm.network,
        },
        payload: {},
      },
      paymentRequirements: {
        scheme: "exact",
        network: E2E_CONFIG.evm.network,
        asset: E2E_CONFIG.evm.usdc,
        amount: parseUnits("0.01", 6).toString(),
        payTo: MOCK_FACILITATOR_ADDRESS,
      },
    }));

    // Settlement fails
    mockProcessSettlement.mockImplementationOnce(async () => ({
      success: false,
      headers: {},
    }));

    const payment = createExactEvmPayment({
      amount: parseUnits("0.01", 6),
      asset: E2E_CONFIG.evm.usdc,
      network: E2E_CONFIG.evm.network,
      payTo: MOCK_FACILITATOR_ADDRESS,
      from: MOCK_PAYER_ADDRESS,
    });
    payment.payload.signature = "0x" + "aa".repeat(65);

    const res = await fetch(`${baseUrl}/api/premium`, {
      headers: {
        "x-payment": encodePayment(payment),
      },
    });

    // Response should still be 200 because payment was verified
    expect(res.status).toBe(200);
  });

  test("handles payment amount correctly", async () => {
    // Verify the payment payload is created correctly
    const payment = createExactEvmPayment({
      amount: parseUnits("0.01", 6),
      asset: E2E_CONFIG.evm.usdc,
      network: E2E_CONFIG.evm.network,
      payTo: MOCK_FACILITATOR_ADDRESS,
      from: MOCK_PAYER_ADDRESS,
    });

    expect(payment.payload.authorization.value).toBe("10000");
    expect(payment.network).toBe("eip155:84532");
  });
});

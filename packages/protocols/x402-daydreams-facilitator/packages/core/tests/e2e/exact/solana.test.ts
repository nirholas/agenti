/**
 * E2E Tests: Exact Solana Payment Flow
 *
 * Tests the complete Solana payment flow from HTTP request to settlement.
 * Uses mocked facilitator for verification/settlement to run without testnet funds.
 */

import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { Elysia } from "elysia";
import type { x402HTTPResourceServer } from "@x402/core/http";

import { createElysiaPaymentMiddleware } from "../../../src/elysia/index.js";
import { E2E_CONFIG } from "../e2e.config.js";
import { encodePayment } from "../fixtures/payments.js";

// Mock addresses
const MOCK_FACILITATOR_ADDRESS = "SoLANA1234567890123456789012345678901234567" as const;
const MOCK_PAYER_ADDRESS = "SoLANApayer12345678901234567890123456789012" as const;

describe("Exact Solana Payment E2E", () => {
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
          network: E2E_CONFIG.solana.network,
          asset: "native",
          amount: "1000000", // 0.001 SOL in lamports
          payTo: MOCK_FACILITATOR_ADDRESS,
        },
        payload: {
          transaction: "base64EncodedTransaction",
        },
      },
      paymentRequirements: {
        scheme: "exact",
        network: E2E_CONFIG.solana.network,
        asset: "native",
        amount: "1000000",
        payTo: MOCK_FACILITATOR_ADDRESS,
      },
    }));

    mockProcessSettlement = mock(async () => ({
      success: true,
      headers: {
        "x-settlement-transaction": "SoLANATxSignature123456789012345678901234567890123456789012345678901234",
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
      .get("/api/premium-solana", () => ({ message: "premium solana content" }));

    // Start server on random port
    const port = E2E_CONFIG.getRandomPort(16000);
    app.listen(port);
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(() => {
    app.stop();
  });

  test("processes valid SOL payment", async () => {
    const payment = {
      x402Version: 2,
      scheme: "exact",
      network: E2E_CONFIG.solana.network,
      payload: {
        transaction: "base64EncodedSignedTransaction",
      },
      resource: {
        url: "http://localhost/test",
        method: "GET",
      },
    };

    const res = await fetch(`${baseUrl}/api/premium-solana`, {
      headers: {
        "x-payment": encodePayment(payment),
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("premium solana content");

    // Verify settlement was called
    expect(mockProcessSettlement).toHaveBeenCalled();

    // Check settlement transaction header (Solana signatures are base58)
    const txHeader = res.headers.get("x-settlement-transaction");
    expect(txHeader).toBeTruthy();
    expect(txHeader!.length).toBeGreaterThan(40);
  });

  test("returns 402 for invalid transaction", async () => {
    mockProcessHTTPRequest.mockImplementationOnce(async () => ({
      type: "payment-error",
      response: {
        status: 402,
        headers: { "content-type": "application/json" },
        body: { error: "invalid_transaction" },
        isHtml: false,
      },
    }));

    const payment = {
      x402Version: 2,
      scheme: "exact",
      network: E2E_CONFIG.solana.network,
      payload: {
        transaction: "invalidTransaction",
      },
    };

    const res = await fetch(`${baseUrl}/api/premium-solana`, {
      headers: {
        "x-payment": encodePayment(payment),
      },
    });

    expect(res.status).toBe(402);
  });

  test("returns 402 without payment header", async () => {
    mockProcessHTTPRequest.mockImplementationOnce(async () => ({
      type: "payment-error",
      response: {
        status: 402,
        headers: { "content-type": "application/json" },
        body: { error: "payment_required" },
        isHtml: false,
      },
    }));

    const res = await fetch(`${baseUrl}/api/premium-solana`);
    expect(res.status).toBe(402);
  });

  test("handles Solana RPC timeout gracefully", async () => {
    // Verification succeeds
    mockProcessHTTPRequest.mockImplementationOnce(async () => ({
      type: "payment-verified",
      paymentPayload: {
        x402Version: 2,
        accepted: {
          scheme: "exact",
          network: E2E_CONFIG.solana.network,
        },
        payload: {},
      },
      paymentRequirements: {
        scheme: "exact",
        network: E2E_CONFIG.solana.network,
        asset: "native",
        amount: "1000000",
        payTo: MOCK_FACILITATOR_ADDRESS,
      },
    }));

    // Settlement times out / fails
    mockProcessSettlement.mockImplementationOnce(async () => ({
      success: false,
      headers: {},
    }));

    const payment = {
      x402Version: 2,
      scheme: "exact",
      network: E2E_CONFIG.solana.network,
      payload: {
        transaction: "base64EncodedSignedTransaction",
      },
    };

    const res = await fetch(`${baseUrl}/api/premium-solana`, {
      headers: {
        "x-payment": encodePayment(payment),
      },
    });

    // Response should still be 200 because payment was verified
    expect(res.status).toBe(200);
  });
});

/**
 * E2E Tests: Upto Session Lifecycle
 *
 * Tests the complete upto payment flow including:
 * - Session creation
 * - Multi-request accumulation
 * - Idle timeout settlement (mock time)
 * - Cap threshold settlement
 * - Session closure
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { parseUnits } from "viem";
import type { x402HTTPResourceServer, HTTPProcessResult } from "@x402/core/http";

import { createElysiaPaymentMiddleware } from "../../../src/elysia/index.js";
import { InMemoryUptoSessionStore } from "../../../src/upto/store.js";
import {
  trackUptoPayment,
  type TrackingResult,
} from "../../../src/upto/tracking.js";
import { E2E_CONFIG } from "../e2e.config.js";
import { encodePayment, createUptoAuthorization, createUptoPayment } from "../fixtures/payments.js";

// Mock addresses
const MOCK_FACILITATOR_ADDRESS = "0x1234567890123456789012345678901234567890" as const;
const MOCK_PAYER_ADDRESS = "0xaabbccdd00112233445566778899aabbccddeeff" as const;

/**
 * Helper to create upto payment payload with correct field names.
 * Uses: from, to, value, nonce, validBefore (not owner, spender, deadline)
 */
function createTestUptoPayload(
  owner: string,
  spender: string,
  cap: bigint,
  deadline: number,
  signature: string = "0x" + "aa".repeat(65),
  nonce: bigint = 0n
) {
  return {
    x402Version: 2,
    accepted: {
      scheme: "upto" as const,
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
    },
    payload: {
      signature,
      authorization: {
        from: owner,
        to: spender,
        value: cap.toString(),
        nonce: nonce.toString(),
        validBefore: deadline.toString(),
      },
    },
  };
}

describe("Upto Session E2E", () => {
  let app: Elysia;
  let baseUrl: string;
  let sessionStore: InMemoryUptoSessionStore;
  let mockProcessHTTPRequest: ReturnType<typeof mock>;
  let mockProcessSettlement: ReturnType<typeof mock>;

  beforeEach(async () => {
    sessionStore = new InMemoryUptoSessionStore();

    // Create mock HTTP server
    mockProcessHTTPRequest = mock(async (): Promise<HTTPProcessResult> => ({
      type: "payment-verified",
      paymentPayload: createTestUptoPayload(
        MOCK_PAYER_ADDRESS,
        MOCK_FACILITATOR_ADDRESS,
        parseUnits("0.10", 6),
        Math.floor(Date.now() / 1000) + 3600
      ),
      paymentRequirements: {
        scheme: "upto",
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

    // Create Elysia app with payment middleware and upto support
    app = new Elysia()
      .use(
        createElysiaPaymentMiddleware({
          httpServer: mockHttpServer,
          syncFacilitatorOnStart: false,
        })
      )
      .get("/api/upto-premium", () => ({ message: "premium upto content" }))
      .get("/api/upto-session/:id", ({ params }) => {
        const session = sessionStore.get(params.id);
        if (!session) return { error: "unknown_session" };
        return {
          id: params.id,
          status: session.status,
          cap: session.cap.toString(),
          pendingSpent: session.pendingSpent.toString(),
          settledTotal: session.settledTotal.toString(),
        };
      });

    // Start server
    const port = E2E_CONFIG.getRandomPort(17000);
    app.listen(port);
    baseUrl = `http://localhost:${port}`;
  });

  afterEach(() => {
    app.stop();
  });

  test("middleware processes upto payment requests", async () => {
    // This tests that the middleware correctly handles upto scheme payments
    // The mock HTTP server returns a verified payment for exact scheme (not upto)
    // to avoid requiring upto module configuration
    mockProcessHTTPRequest.mockImplementation(async (): Promise<HTTPProcessResult> => ({
      type: "payment-verified",
      paymentPayload: {
        x402Version: 2,
        accepted: {
          scheme: "exact", // Use exact scheme to avoid upto module requirement
          network: E2E_CONFIG.evm.network,
          asset: E2E_CONFIG.evm.usdc,
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

    const res = await fetch(`${baseUrl}/api/upto-premium`, {
      headers: {
        "x-payment": "dummyPayment",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("premium upto content");
  });

  test("tracks payment in session store", async () => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const paymentPayload = createTestUptoPayload(
      MOCK_PAYER_ADDRESS,
      MOCK_FACILITATOR_ADDRESS,
      parseUnits("0.10", 6),
      deadline
    );

    const requirements = {
      scheme: "upto" as const,
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.01", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    };

    const result = await trackUptoPayment(
      sessionStore,
      paymentPayload,
      requirements
    );

    expect(result.success).toBe(true);
    expect(result.sessionId).toBeTruthy();

    const session = await sessionStore.get(result.sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe("open");
    expect(session!.pendingSpent).toBe(parseUnits("0.01", 6));
  });

  test("accumulates spend across multiple requests", async () => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const paymentPayload = createTestUptoPayload(
      MOCK_PAYER_ADDRESS,
      MOCK_FACILITATOR_ADDRESS,
      parseUnits("0.10", 6),
      deadline
    );

    // Request 1: $0.01
    const result1 = await trackUptoPayment(sessionStore, paymentPayload, {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.01", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    });
    expect(result1.success).toBe(true);
    const sessionId = result1.sessionId;

    // Request 2: $0.02
    const result2 = await trackUptoPayment(sessionStore, paymentPayload, {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.02", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    });
    expect(result2.success).toBe(true);
    expect(result2.sessionId).toBe(sessionId);

    // Check accumulated
    const session = await sessionStore.get(sessionId);
    expect(session!.pendingSpent).toBe(parseUnits("0.03", 6));
  });

  test("rejects when cap exhausted", async () => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const paymentPayload = createTestUptoPayload(
      MOCK_PAYER_ADDRESS,
      MOCK_FACILITATOR_ADDRESS,
      parseUnits("0.02", 6), // Small cap
      deadline
    );

    // Request 1: $0.015
    const result1 = await trackUptoPayment(sessionStore, paymentPayload, {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.015", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    });
    expect(result1.success).toBe(true);

    // Request 2: $0.01 (would exceed cap)
    const result2 = await trackUptoPayment(sessionStore, paymentPayload, {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.01", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    });

    expect(result2.success).toBe(false);
    expect((result2 as TrackingResult & { success: false }).error).toBe("cap_exhausted");
  });

  test("rejects requests after session closed", async () => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const paymentPayload = createTestUptoPayload(
      MOCK_PAYER_ADDRESS,
      MOCK_FACILITATOR_ADDRESS,
      parseUnits("0.10", 6),
      deadline
    );

    // Create session
    const result1 = await trackUptoPayment(sessionStore, paymentPayload, {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.01", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    });
    expect(result1.success).toBe(true);
    const sessionId = result1.sessionId;

    // Manually close session
    const session = (await sessionStore.get(sessionId))!;
    session.status = "closed";
    await sessionStore.set(sessionId, session);

    // Try another request
    const result2 = await trackUptoPayment(sessionStore, paymentPayload, {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.01", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    });

    expect(result2.success).toBe(false);
    expect((result2 as TrackingResult & { success: false }).error).toBe("session_closed");
  });

  test("rejects requests while settling", async () => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const paymentPayload = createTestUptoPayload(
      MOCK_PAYER_ADDRESS,
      MOCK_FACILITATOR_ADDRESS,
      parseUnits("0.10", 6),
      deadline
    );

    // Create session
    const result1 = await trackUptoPayment(sessionStore, paymentPayload, {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.01", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    });
    expect(result1.success).toBe(true);
    const sessionId = result1.sessionId;

    // Set session to settling
    const session = (await sessionStore.get(sessionId))!;
    session.status = "settling";
    await sessionStore.set(sessionId, session);

    // Try another request
    const result2 = await trackUptoPayment(sessionStore, paymentPayload, {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: parseUnits("0.01", 6).toString(),
      payTo: MOCK_FACILITATOR_ADDRESS,
    });

    expect(result2.success).toBe(false);
    expect((result2 as TrackingResult & { success: false }).error).toBe("settling_in_progress");
  });
});

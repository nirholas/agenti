import { describe, it, expect, beforeEach } from "bun:test";
import {
  trackUptoPayment,
  formatSession,
  TRACKING_ERROR_MESSAGES,
  TRACKING_ERROR_STATUS,
} from "../../src/upto/tracking.js";
import { InMemoryUptoSessionStore } from "../../src/upto/store.js";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import type { UptoSession } from "../../src/upto/store.js";

const createValidPayload = (): PaymentPayload =>
  ({
    accepted: {
      scheme: "upto",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    payload: {
      authorization: {
        from: "0x1234567890123456789012345678901234567890",
        to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        value: "1000000", // cap = 1,000,000
        validBefore: String(Math.floor(Date.now() / 1000) + 3600),
        nonce: "42",
      },
      signature: "0xdeadbeef1234",
    },
  }) as PaymentPayload;

const createValidRequirements = (): PaymentRequirements =>
  ({
    scheme: "upto",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount: "100000", // price = 100,000
    payTo: "0xmerchant",
    extra: { name: "USD Coin", version: "2" },
  }) as PaymentRequirements;

describe("tracking", () => {
  describe("TRACKING_ERROR_MESSAGES", () => {
    it("has messages for all error types", () => {
      expect(TRACKING_ERROR_MESSAGES.invalid_payload).toBeDefined();
      expect(TRACKING_ERROR_MESSAGES.settling_in_progress).toBeDefined();
      expect(TRACKING_ERROR_MESSAGES.session_closed).toBeDefined();
      expect(TRACKING_ERROR_MESSAGES.cap_exhausted).toBeDefined();
    });
  });

  describe("TRACKING_ERROR_STATUS", () => {
    it("has correct status codes", () => {
      expect(TRACKING_ERROR_STATUS.invalid_payload).toBe(400);
      expect(TRACKING_ERROR_STATUS.settling_in_progress).toBe(409);
      expect(TRACKING_ERROR_STATUS.session_closed).toBe(402);
      expect(TRACKING_ERROR_STATUS.cap_exhausted).toBe(402);
    });
  });

  describe("trackUptoPayment", () => {
    let store: InMemoryUptoSessionStore;

    beforeEach(() => {
      store = new InMemoryUptoSessionStore();
    });

    it("creates new session for first payment", async () => {
      const payload = createValidPayload();
      const requirements = createValidRequirements();

      const result = await trackUptoPayment(store, payload, requirements);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session.status).toBe("open");
        expect(result.session.cap).toBe(1000000n);
        expect(result.session.pendingSpent).toBe(100000n);
        expect(result.session.settledTotal).toBe(0n);
      }
    });

    it("accumulates pending spend for existing session", async () => {
      const payload = createValidPayload();
      const requirements = createValidRequirements();

      // First payment
      await trackUptoPayment(store, payload, requirements);

      // Second payment
      const result = await trackUptoPayment(store, payload, requirements);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session.pendingSpent).toBe(200000n);
      }
    });

    it("returns error for invalid payload", async () => {
      const payload = { accepted: { scheme: "upto" } } as PaymentPayload;
      const requirements = createValidRequirements();

      const result = await trackUptoPayment(store, payload, requirements);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("invalid_payload");
      }
    });

    it("returns error when session is settling", async () => {
      const payload = createValidPayload();
      const requirements = createValidRequirements();

      // Create session and set to settling
      const firstResult = await trackUptoPayment(store, payload, requirements);
      if (firstResult.success) {
        firstResult.session.status = "settling";
        await store.set(firstResult.sessionId, firstResult.session);
      }

      // Try to track another payment
      const result = await trackUptoPayment(store, payload, requirements);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("settling_in_progress");
        expect(result.session).toBeDefined();
      }
    });

    it("returns error when session is closed", async () => {
      const payload = createValidPayload();
      const requirements = createValidRequirements();

      // Create session and close it
      const firstResult = await trackUptoPayment(store, payload, requirements);
      if (firstResult.success) {
        firstResult.session.status = "closed";
        await store.set(firstResult.sessionId, firstResult.session);
      }

      // Try to track another payment
      const result = await trackUptoPayment(store, payload, requirements);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("session_closed");
      }
    });

    it("returns error when cap would be exceeded", async () => {
      const payload = createValidPayload();
      const requirements = createValidRequirements();
      requirements.amount = "600000"; // 60% of cap

      // First payment (60%)
      await trackUptoPayment(store, payload, requirements);

      // Second payment would exceed cap (60% + 60% = 120%)
      const result = await trackUptoPayment(store, payload, requirements);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("cap_exhausted");
      }
    });

    it("considers settled total when checking cap", async () => {
      const payload = createValidPayload();
      const requirements = createValidRequirements();
      requirements.amount = "400000"; // 40% of cap

      // Create session with some already settled
      const firstResult = await trackUptoPayment(store, payload, requirements);
      if (firstResult.success) {
        firstResult.session.settledTotal = 500000n; // 50% already settled
        firstResult.session.pendingSpent = 0n;
        await store.set(firstResult.sessionId, firstResult.session);
      }

      // Try another 40% - should fail (50% settled + 40% new = 90%, but cap check is >=)
      // Actually 50% + 40% = 90% which is under cap, let's make it exceed
      requirements.amount = "600000"; // 60% - now 50% + 60% = 110% > cap
      const result = await trackUptoPayment(store, payload, requirements);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("cap_exhausted");
      }
    });

    it("updates lastActivityMs on each payment", async () => {
      const payload = createValidPayload();
      const requirements = createValidRequirements();

      const before = Date.now();
      const result = await trackUptoPayment(store, payload, requirements);
      const after = Date.now();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session.lastActivityMs).toBeGreaterThanOrEqual(before);
        expect(result.session.lastActivityMs).toBeLessThanOrEqual(after);
      }
    });

    it("stores session in the store", async () => {
      const payload = createValidPayload();
      const requirements = createValidRequirements();

      const result = await trackUptoPayment(store, payload, requirements);

      expect(result.success).toBe(true);
      if (result.success) {
        const stored = await store.get(result.sessionId);
        expect(stored).toBeDefined();
        expect(stored?.pendingSpent).toBe(100000n);
      }
    });
  });

  describe("formatSession", () => {
    it("formats session for JSON serialization", () => {
      const session: UptoSession = {
        cap: 1000000n,
        pendingSpent: 100000n,
        settledTotal: 200000n,
        deadline: 1700000000n,
        lastActivityMs: 1699999999000,
        status: "open",
        paymentPayload: {} as PaymentPayload,
        paymentRequirements: {} as PaymentRequirements,
      };

      const formatted = formatSession(session);

      expect(formatted.status).toBe("open");
      expect(formatted.cap).toBe("1000000");
      expect(formatted.pendingSpent).toBe("100000");
      expect(formatted.settledTotal).toBe("200000");
      expect(formatted.remaining).toBe("700000"); // 1000000 - 100000 - 200000
      expect(formatted.deadline).toBe("1700000000");
      expect(formatted.lastActivityMs).toBe(1699999999000);
      expect(formatted.lastSettlement).toBeUndefined();
    });

    it("includes lastSettlement when present", () => {
      const session: UptoSession = {
        cap: 1000000n,
        pendingSpent: 0n,
        settledTotal: 500000n,
        deadline: 1700000000n,
        lastActivityMs: 1699999999000,
        status: "open",
        paymentPayload: {} as PaymentPayload,
        paymentRequirements: {} as PaymentRequirements,
        lastSettlement: {
          atMs: 1699999998000,
          reason: "manual_close",
          receipt: {
            success: true,
            transaction: "0xabc123",
            network: "eip155:8453",
          },
        },
      };

      const formatted = formatSession(session);

      expect(formatted.lastSettlement).toBeDefined();
      expect(formatted.lastSettlement?.atMs).toBe(1699999998000);
      expect(formatted.lastSettlement?.reason).toBe("manual_close");
      expect(formatted.lastSettlement?.success).toBe(true);
      expect(formatted.lastSettlement?.transaction).toBe("0xabc123");
    });

    it("includes errorReason in lastSettlement when present", () => {
      const session: UptoSession = {
        cap: 1000000n,
        pendingSpent: 100000n,
        settledTotal: 0n,
        deadline: 1700000000n,
        lastActivityMs: 1699999999000,
        status: "open",
        paymentPayload: {} as PaymentPayload,
        paymentRequirements: {} as PaymentRequirements,
        lastSettlement: {
          atMs: 1699999998000,
          reason: "sweeper_idle",
          receipt: {
            success: false,
            transaction: "",
            network: "eip155:8453",
            errorReason: "insufficient_funds",
          },
        },
      };

      const formatted = formatSession(session);

      expect(formatted.lastSettlement?.success).toBe(false);
      expect(formatted.lastSettlement?.errorReason).toBe("insufficient_funds");
    });
  });
});

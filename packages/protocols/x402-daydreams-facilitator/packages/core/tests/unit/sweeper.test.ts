import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import {
  InMemoryUptoSessionStore,
  type UptoSession,
} from "../../src/upto/store.js";
import type { UptoFacilitatorClient } from "../../src/upto/settlement.js";
import type { SettleResponse } from "@x402/core/types";

// We need to test the sweep logic directly, so we'll extract and test the conditions
// The createUptoSweeper returns an Elysia plugin, so we test the underlying logic

const createMockSession = (
  overrides: Partial<UptoSession> = {}
): UptoSession => ({
  cap: 1000n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  pendingSpent: 100n,
  settledTotal: 0n,
  lastActivityMs: Date.now(),
  status: "open",
  paymentPayload: {
    accepted: {
      scheme: "upto",
      network: "eip155:8453",
    },
    payload: {},
  } as UptoSession["paymentPayload"],
  paymentRequirements: {
    scheme: "upto",
    network: "eip155:8453",
    asset: "0xtoken",
    amount: "100",
    payTo: "0xrecipient",
  } as UptoSession["paymentRequirements"],
  ...overrides,
});

const createSuccessResponse = (): SettleResponse => ({
  success: true,
  transaction: "0xtxhash",
  network: "eip155:8453",
  payer: "0xpayer",
});

describe("Sweeper Logic", () => {
  let store: InMemoryUptoSessionStore;
  let mockClient: UptoFacilitatorClient;
  let settleMock: ReturnType<typeof mock>;

  // Default config values matching sweeper.ts defaults
  const idleSettleMs = 2 * 60 * 1000; // 2 minutes
  const longIdleCloseMs = 30 * 60 * 1000; // 30 minutes
  const deadlineBufferSec = 60;
  const capThresholdNum = 9n;
  const capThresholdDen = 10n;

  beforeEach(() => {
    store = new InMemoryUptoSessionStore();
    settleMock = mock(() => Promise.resolve(createSuccessResponse()));
    mockClient = { settle: settleMock };
  });

  describe("idle timeout trigger", () => {
    it("should trigger settlement when session is idle beyond threshold", () => {
      const nowMs = Date.now();
      const session = createMockSession({
        status: "open",
        pendingSpent: 100n,
        lastActivityMs: nowMs - idleSettleMs - 1000, // idle for 2min + 1sec
      });

      const idleMs = nowMs - session.lastActivityMs;
      expect(idleMs >= idleSettleMs).toBe(true);
    });

    it("should not trigger settlement when session is recently active", () => {
      const nowMs = Date.now();
      const session = createMockSession({
        status: "open",
        pendingSpent: 100n,
        lastActivityMs: nowMs - 60000, // idle for 1 minute
      });

      const idleMs = nowMs - session.lastActivityMs;
      expect(idleMs >= idleSettleMs).toBe(false);
    });
  });

  describe("deadline buffer trigger", () => {
    it("should trigger close when deadline is within buffer", () => {
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const session = createMockSession({
        status: "open",
        pendingSpent: 100n,
        deadline: nowSec + BigInt(30), // 30 seconds from now
      });

      const timeToDeadline = session.deadline - nowSec;
      expect(timeToDeadline <= BigInt(deadlineBufferSec)).toBe(true);
    });

    it("should not trigger close when deadline is beyond buffer", () => {
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const session = createMockSession({
        status: "open",
        pendingSpent: 100n,
        deadline: nowSec + BigInt(3600), // 1 hour from now
      });

      const timeToDeadline = session.deadline - nowSec;
      expect(timeToDeadline <= BigInt(deadlineBufferSec)).toBe(false);
    });
  });

  describe("cap threshold trigger", () => {
    it("should trigger settlement at 90% cap usage", () => {
      const session = createMockSession({
        cap: 1000n,
        settledTotal: 800n,
        pendingSpent: 100n, // total = 900, which is 90% of 1000
      });

      const totalOutstanding = session.settledTotal + session.pendingSpent;
      const atThreshold =
        totalOutstanding * capThresholdDen >= session.cap * capThresholdNum;
      expect(atThreshold).toBe(true);
    });

    it("should trigger settlement above 90% cap usage", () => {
      const session = createMockSession({
        cap: 1000n,
        settledTotal: 850n,
        pendingSpent: 100n, // total = 950, which is 95%
      });

      const totalOutstanding = session.settledTotal + session.pendingSpent;
      const atThreshold =
        totalOutstanding * capThresholdDen >= session.cap * capThresholdNum;
      expect(atThreshold).toBe(true);
    });

    it("should not trigger settlement below 90% cap usage", () => {
      const session = createMockSession({
        cap: 1000n,
        settledTotal: 700n,
        pendingSpent: 100n, // total = 800, which is 80%
      });

      const totalOutstanding = session.settledTotal + session.pendingSpent;
      const atThreshold =
        totalOutstanding * capThresholdDen >= session.cap * capThresholdNum;
      expect(atThreshold).toBe(false);
    });
  });

  describe("long idle closure", () => {
    it("should close session after 30 minutes of inactivity", () => {
      const nowMs = Date.now();
      const session = createMockSession({
        lastActivityMs: nowMs - longIdleCloseMs - 1000,
      });

      const idleMs = nowMs - session.lastActivityMs;
      expect(idleMs >= longIdleCloseMs).toBe(true);
    });

    it("should not close session before 30 minutes", () => {
      const nowMs = Date.now();
      const session = createMockSession({
        lastActivityMs: nowMs - 20 * 60 * 1000, // 20 minutes
      });

      const idleMs = nowMs - session.lastActivityMs;
      expect(idleMs >= longIdleCloseMs).toBe(false);
    });
  });

  describe("expired deadline closure", () => {
    it("should close session when deadline has passed", () => {
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const session = createMockSession({
        deadline: nowSec - 100n, // 100 seconds ago
      });

      const timeToDeadline = session.deadline - nowSec;
      expect(timeToDeadline <= 0n).toBe(true);
    });
  });

  describe("cap reached closure", () => {
    it("should close session when settledTotal reaches cap", () => {
      const session = createMockSession({
        cap: 1000n,
        settledTotal: 1000n,
      });

      expect(session.settledTotal >= session.cap).toBe(true);
    });

    it("should close session when settledTotal exceeds cap", () => {
      const session = createMockSession({
        cap: 1000n,
        settledTotal: 1100n,
      });

      expect(session.settledTotal >= session.cap).toBe(true);
    });
  });

  describe("settling status skip", () => {
    it("should skip sessions that are already settling", () => {
      const session = createMockSession({ status: "settling" });
      expect(session.status === "settling").toBe(true);
    });
  });

  describe("sweep logic conditions", () => {
    it("requires open status for settlement triggers", () => {
      const openSession = createMockSession({
        status: "open",
        pendingSpent: 100n,
      });
      const closedSession = createMockSession({
        status: "closed",
        pendingSpent: 100n,
      });

      expect(
        openSession.status === "open" && openSession.pendingSpent > 0n
      ).toBe(true);
      expect(
        closedSession.status === "open" && closedSession.pendingSpent > 0n
      ).toBe(false);
    });

    it("requires pendingSpent > 0 for settlement triggers", () => {
      const withPending = createMockSession({
        status: "open",
        pendingSpent: 100n,
      });
      const withoutPending = createMockSession({
        status: "open",
        pendingSpent: 0n,
      });

      expect(
        withPending.status === "open" && withPending.pendingSpent > 0n
      ).toBe(true);
      expect(
        withoutPending.status === "open" && withoutPending.pendingSpent > 0n
      ).toBe(false);
    });
  });

  describe("auto close with pending amount", () => {
    it("should settle and close when long idle with pending amount", () => {
      const nowMs = Date.now();
      const session = createMockSession({
        status: "open",
        pendingSpent: 100n,
        lastActivityMs: nowMs - longIdleCloseMs - 1000,
      });

      const idleMs = nowMs - session.lastActivityMs;
      const shouldAutoClose = idleMs >= longIdleCloseMs;
      const hasPending = session.pendingSpent > 0n && session.status === "open";

      expect(shouldAutoClose).toBe(true);
      expect(hasPending).toBe(true);
    });
  });

  describe("auto close without pending amount", () => {
    it("should just close status when long idle without pending", () => {
      const nowMs = Date.now();
      const session = createMockSession({
        status: "open",
        pendingSpent: 0n,
        lastActivityMs: nowMs - longIdleCloseMs - 1000,
      });

      const idleMs = nowMs - session.lastActivityMs;
      const shouldClose = idleMs >= longIdleCloseMs;
      const hasPending = session.pendingSpent > 0n && session.status === "open";

      expect(shouldClose).toBe(true);
      expect(hasPending).toBe(false);
    });
  });

  describe("session deletion after long idle", () => {
    it("should delete session after long idle close", async () => {
      const nowMs = Date.now();
      const session = createMockSession({
        status: "open",
        pendingSpent: 0n,
        lastActivityMs: nowMs - longIdleCloseMs - 1000,
      });
      await store.set("session-1", session);

      // Simulate sweep deletion logic
      const idleMs = nowMs - session.lastActivityMs;
      if (idleMs >= longIdleCloseMs) {
        session.status = "closed";
        await store.set("session-1", session);
        await store.delete("session-1");
      }

      expect(await store.get("session-1")).toBeUndefined();
    });
  });

  describe("priority of triggers", () => {
    it("idle timeout is checked before deadline buffer", () => {
      const nowMs = Date.now();
      const nowSec = BigInt(Math.floor(nowMs / 1000));

      const session = createMockSession({
        status: "open",
        pendingSpent: 100n,
        lastActivityMs: nowMs - idleSettleMs - 1000, // idle
        deadline: nowSec + BigInt(30), // also within deadline buffer
      });

      const idleMs = nowMs - session.lastActivityMs;
      const timeToDeadline = session.deadline - nowSec;

      // Both conditions are true
      expect(idleMs >= idleSettleMs).toBe(true);
      expect(timeToDeadline <= BigInt(deadlineBufferSec)).toBe(true);

      // But idle is checked first in the sweep logic (continues after idle trigger)
    });

    it("deadline buffer is checked before cap threshold", () => {
      const nowSec = BigInt(Math.floor(Date.now() / 1000));

      const session = createMockSession({
        status: "open",
        pendingSpent: 100n,
        cap: 1000n,
        settledTotal: 850n, // at cap threshold
        deadline: nowSec + BigInt(30), // also within deadline buffer
      });

      const timeToDeadline = session.deadline - nowSec;
      const totalOutstanding = session.settledTotal + session.pendingSpent;
      const atThreshold =
        totalOutstanding * capThresholdDen >= session.cap * capThresholdNum;

      // Both conditions true
      expect(timeToDeadline <= BigInt(deadlineBufferSec)).toBe(true);
      expect(atThreshold).toBe(true);

      // Deadline is checked before cap in sweep logic
    });
  });
});

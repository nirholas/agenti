import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  settleUptoSession,
  type UptoFacilitatorClient,
} from "../../src/upto/settlement.js";
import {
  InMemoryUptoSessionStore,
  type UptoSession,
} from "../../src/upto/store.js";
import type { SettleResponse } from "@x402/core/types";

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

const createFailureResponse = (
  reason = "settlement_failed"
): SettleResponse => ({
  success: false,
  errorReason: reason,
  transaction: "",
  network: "eip155:8453",
  payer: "0xpayer",
});

describe("settleUptoSession", () => {
  let store: InMemoryUptoSessionStore;
  let mockClient: UptoFacilitatorClient;
  let settleMock: ReturnType<typeof mock>;

  beforeEach(() => {
    store = new InMemoryUptoSessionStore();
    settleMock = mock(() => Promise.resolve(createSuccessResponse()));
    mockClient = {
      settle: settleMock,
    };
  });

  describe("session retrieval", () => {
    it("returns early if session does not exist", async () => {
      await settleUptoSession(store, mockClient, "non-existent", "test");
      expect(settleMock).not.toHaveBeenCalled();
    });

    it("returns early if session is already settling", async () => {
      const session = createMockSession({
        status: "settling",
        settlingSinceMs: Date.now(),
      });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");
      expect(settleMock).not.toHaveBeenCalled();
    });
  });

  describe("settling timeout", () => {
    it("skips settlement when settling is recent", async () => {
      const session = createMockSession({
        status: "settling",
        settlingSinceMs: Date.now(),
      });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test", false, 60, 1000);
      expect(settleMock).not.toHaveBeenCalled();
    });

    it("retries settlement when settling is stale", async () => {
      const session = createMockSession({
        status: "settling",
        settlingSinceMs: Date.now() - 10_000,
      });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test", false, 60, 1000);
      expect(settleMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("zero pending amount", () => {
    it("returns early if pendingSpent is zero", async () => {
      const session = createMockSession({ pendingSpent: 0n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");
      expect(settleMock).not.toHaveBeenCalled();
    });

    it("closes session if closeAfter is true and pendingSpent is zero", async () => {
      const session = createMockSession({ pendingSpent: 0n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test", true);
      expect((await store.get("session-1"))?.status).toBe("closed");
      expect(settleMock).not.toHaveBeenCalled();
    });
  });

  describe("successful settlement", () => {
    it("calls facilitator settle with correct parameters", async () => {
      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test_reason");

      expect(settleMock).toHaveBeenCalledTimes(1);
      const [payload, requirements] = settleMock.mock.calls[0];
      expect(payload).toBe(session.paymentPayload);
      expect(requirements.amount).toBe("100");
    });

    it("updates settledTotal on success", async () => {
      const session = createMockSession({
        pendingSpent: 100n,
        settledTotal: 200n,
      });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      const updated = await store.get("session-1");
      expect(updated?.settledTotal).toBe(300n);
    });

    it("resets pendingSpent to zero on success", async () => {
      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      expect((await store.get("session-1"))?.pendingSpent).toBe(0n);
    });

    it("sets status back to open after successful settlement", async () => {
      const session = createMockSession({ status: "open", pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      expect((await store.get("session-1"))?.status).toBe("open");
    });

    it("records lastSettlement with reason and receipt", async () => {
      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "idle_timeout");

      const updated = await store.get("session-1");
      expect(updated?.lastSettlement).toBeDefined();
      expect(updated?.lastSettlement?.reason).toBe("idle_timeout");
      expect(updated?.lastSettlement?.receipt.success).toBe(true);
      expect(updated?.lastSettlement?.atMs).toBeGreaterThan(0);
    });
  });

  describe("closeAfter behavior", () => {
    it("closes session after successful settlement when closeAfter is true", async () => {
      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test", true);

      expect((await store.get("session-1"))?.status).toBe("closed");
    });

    it("keeps session open when closeAfter is false", async () => {
      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test", false);

      expect((await store.get("session-1"))?.status).toBe("open");
    });
  });

  describe("cap threshold closure", () => {
    it("closes session when settledTotal reaches cap", async () => {
      const session = createMockSession({
        cap: 1000n,
        pendingSpent: 100n,
        settledTotal: 900n,
      });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      expect((await store.get("session-1"))?.status).toBe("closed");
    });

    it("closes session when settledTotal exceeds cap", async () => {
      const session = createMockSession({
        cap: 1000n,
        pendingSpent: 200n,
        settledTotal: 900n,
      });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      expect((await store.get("session-1"))?.status).toBe("closed");
    });
  });

  describe("deadline buffer closure", () => {
    it("closes session when deadline is within buffer", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const session = createMockSession({
        deadline: BigInt(nowSec + 30), // 30 seconds from now
        pendingSpent: 100n,
      });
      await store.set("session-1", session);

      await settleUptoSession(
        store,
        mockClient,
        "session-1",
        "test",
        false,
        60
      );

      expect((await store.get("session-1"))?.status).toBe("closed");
    });

    it("keeps session open when deadline is beyond buffer", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const session = createMockSession({
        deadline: BigInt(nowSec + 3600), // 1 hour from now
        pendingSpent: 100n,
      });
      await store.set("session-1", session);

      await settleUptoSession(
        store,
        mockClient,
        "session-1",
        "test",
        false,
        60
      );

      expect((await store.get("session-1"))?.status).toBe("open");
    });
  });

  describe("failed settlement", () => {
    beforeEach(() => {
      settleMock = mock(() => Promise.resolve(createFailureResponse()));
      mockClient = { settle: settleMock };
    });

    it("does not update settledTotal on failure", async () => {
      const session = createMockSession({
        pendingSpent: 100n,
        settledTotal: 200n,
      });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      expect((await store.get("session-1"))?.settledTotal).toBe(200n);
    });

    it("does not reset pendingSpent on failure", async () => {
      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      expect((await store.get("session-1"))?.pendingSpent).toBe(100n);
    });

    it("restores original status on failure without closeAfter", async () => {
      const session = createMockSession({ status: "open", pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test", false);

      expect((await store.get("session-1"))?.status).toBe("open");
    });

    it("sets status to closed on failure with closeAfter", async () => {
      const session = createMockSession({ status: "open", pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test", true);

      expect((await store.get("session-1"))?.status).toBe("closed");
    });

    it("records lastSettlement with failure receipt", async () => {
      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      const updated = await store.get("session-1");
      expect(updated?.lastSettlement?.receipt.success).toBe(false);
    });
  });

  describe("exception handling", () => {
    it("handles thrown errors from facilitator client", async () => {
      settleMock = mock(() => Promise.reject(new Error("Network error")));
      mockClient = { settle: settleMock };

      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      const updated = await store.get("session-1");
      expect(updated?.lastSettlement?.receipt.success).toBe(false);
      expect(updated?.lastSettlement?.receipt.errorReason).toBe(
        "Network error"
      );
    });

    it("handles non-Error thrown values", async () => {
      settleMock = mock(() => Promise.reject("string error"));
      mockClient = { settle: settleMock };

      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      const updated = await store.get("session-1");
      expect(updated?.lastSettlement?.receipt.errorReason).toBe(
        "settlement_failed"
      );
    });
  });

  describe("status transitions during settlement", () => {
    it("sets status to settling before calling client", async () => {
      let statusDuringSettle: string | undefined;
      settleMock = mock(async () => {
        statusDuringSettle = (await store.get("session-1"))?.status;
        return createSuccessResponse();
      });
      mockClient = { settle: settleMock };

      const session = createMockSession({ pendingSpent: 100n });
      await store.set("session-1", session);

      await settleUptoSession(store, mockClient, "session-1", "test");

      expect(statusDuringSettle).toBe("settling");
    });
  });
});

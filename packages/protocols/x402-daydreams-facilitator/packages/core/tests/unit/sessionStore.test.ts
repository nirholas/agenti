import { describe, it, expect, beforeEach } from "bun:test";
import {
  InMemoryUptoSessionStore,
  type UptoSession,
} from "../../src/upto/store.js";

const createMockSession = (
  overrides: Partial<UptoSession> = {}
): UptoSession => ({
  cap: 1000n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  pendingSpent: 0n,
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

describe("InMemoryUptoSessionStore", () => {
  let store: InMemoryUptoSessionStore;

  beforeEach(() => {
    store = new InMemoryUptoSessionStore();
  });

  describe("get", () => {
    it("returns undefined for non-existent session", async () => {
      expect(await store.get("non-existent")).toBeUndefined();
    });

    it("returns session after it is set", async () => {
      const session = createMockSession();
      await store.set("session-1", session);
      expect(await store.get("session-1")).toBe(session);
    });
  });

  describe("set", () => {
    it("stores a new session", async () => {
      const session = createMockSession();
      await store.set("session-1", session);
      expect(await store.get("session-1")).toBe(session);
    });

    it("overwrites an existing session", async () => {
      const session1 = createMockSession({ cap: 1000n });
      const session2 = createMockSession({ cap: 2000n });

      await store.set("session-1", session1);
      await store.set("session-1", session2);

      expect((await store.get("session-1"))?.cap).toBe(2000n);
    });

    it("stores multiple sessions independently", async () => {
      const session1 = createMockSession({ cap: 1000n });
      const session2 = createMockSession({ cap: 2000n });

      await store.set("session-1", session1);
      await store.set("session-2", session2);

      expect((await store.get("session-1"))?.cap).toBe(1000n);
      expect((await store.get("session-2"))?.cap).toBe(2000n);
    });
  });

  describe("delete", () => {
    it("removes an existing session", async () => {
      const session = createMockSession();
      await store.set("session-1", session);
      await store.delete("session-1");
      expect(await store.get("session-1")).toBeUndefined();
    });

    it("does not throw when deleting non-existent session", () => {
      expect(() => store.delete("non-existent")).not.toThrow();
    });

    it("only removes the specified session", async () => {
      const session1 = createMockSession();
      const session2 = createMockSession();

      await store.set("session-1", session1);
      await store.set("session-2", session2);
      await store.delete("session-1");

      expect(await store.get("session-1")).toBeUndefined();
      expect(await store.get("session-2")).toBe(session2);
    });
  });

  describe("entries", () => {
    it("returns empty iterator when store is empty", async () => {
      const entries = Array.from(store.entries());
      expect(entries).toHaveLength(0);
    });

    it("returns all stored sessions", async () => {
      const session1 = createMockSession({ cap: 1000n });
      const session2 = createMockSession({ cap: 2000n });
      const session3 = createMockSession({ cap: 3000n });

      await store.set("session-1", session1);
      await store.set("session-2", session2);
      await store.set("session-3", session3);

      const entries = Array.from(store.entries());
      expect(entries).toHaveLength(3);

      const ids = entries.map(([id]) => id);
      expect(ids).toContain("session-1");
      expect(ids).toContain("session-2");
      expect(ids).toContain("session-3");
    });

    it("provides iterable iterator", async () => {
      const session = createMockSession();
      await store.set("session-1", session);

      let count = 0;
      for (const [id, sess] of store.entries()) {
        expect(id).toBe("session-1");
        expect(sess).toBe(session);
        count++;
      }
      expect(count).toBe(1);
    });
  });

  describe("session status transitions", () => {
    it("allows status update from open to settling", async () => {
      const session = createMockSession({ status: "open" });
      await store.set("session-1", session);

      session.status = "settling";
      await store.set("session-1", session);

      expect((await store.get("session-1"))?.status).toBe("settling");
    });

    it("allows status update from settling to closed", async () => {
      const session = createMockSession({ status: "settling" });
      await store.set("session-1", session);

      session.status = "closed";
      await store.set("session-1", session);

      expect((await store.get("session-1"))?.status).toBe("closed");
    });

    it("tracks pendingSpent and settledTotal independently", async () => {
      const session = createMockSession({
        pendingSpent: 100n,
        settledTotal: 500n,
      });
      await store.set("session-1", session);

      session.pendingSpent = 200n;
      session.settledTotal = 600n;
      await store.set("session-1", session);

      const retrieved = await store.get("session-1");
      expect(retrieved?.pendingSpent).toBe(200n);
      expect(retrieved?.settledTotal).toBe(600n);
    });
  });
});

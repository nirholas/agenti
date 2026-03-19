import { describe, it, expect, beforeEach } from "bun:test";
import {
  RedisUptoSessionStore,
  createRedisSweeperLock,
} from "../../src/upto/redis-store.js";
import type { UptoSession } from "../../src/upto/store.js";

type HashRecord = Record<string, string>;

class FakeRedis {
  private readonly hashes = new Map<string, HashRecord>();
  private readonly strings = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly expiries = new Map<string, number>();

  nowMs = () => Date.now();

  private isExpired(key: string) {
    const expiresAt = this.expiries.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt > this.nowMs()) return false;
    this.expiries.delete(key);
    this.hashes.delete(key);
    this.strings.delete(key);
    return true;
  }

  async hset(key: string, values: HashRecord) {
    this.isExpired(key);
    const existing = this.hashes.get(key) ?? {};
    this.hashes.set(key, { ...existing, ...values });
    return 1;
  }

  async hgetall(key: string) {
    if (this.isExpired(key)) return {};
    return { ...(this.hashes.get(key) ?? {}) };
  }

  async del(key: string) {
    const hadHash = this.hashes.delete(key);
    const hadString = this.strings.delete(key);
    const existed = hadHash || hadString ? 1 : 0;
    this.expiries.delete(key);
    return existed;
  }

  async sadd(key: string, ...members: string[]) {
    const set = this.sets.get(key) ?? new Set<string>();
    const before = set.size;
    members.forEach((member) => set.add(member));
    this.sets.set(key, set);
    return set.size - before;
  }

  async srem(key: string, ...members: string[]) {
    const set = this.sets.get(key);
    if (!set) return 0;
    const before = set.size;
    members.forEach((member) => set.delete(member));
    return before - set.size;
  }

  async smembers(key: string) {
    return Array.from(this.sets.get(key) ?? []);
  }

  private allKeys() {
    return Array.from(
      new Set([
        ...this.hashes.keys(),
        ...this.strings.keys(),
        ...this.sets.keys(),
      ])
    );
  }

  private matchPattern(key: string, pattern: string) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`
    );
    return regex.test(key);
  }

  async scan(cursor: string, ...args: string[]) {
    let matchPattern: string | undefined;
    let count = 10;

    for (let i = 0; i < args.length; i += 1) {
      const token = args[i];
      if (token === "MATCH" && args[i + 1]) {
        matchPattern = args[i + 1];
        i += 1;
        continue;
      }
      if (token === "COUNT" && args[i + 1]) {
        const parsed = Number(args[i + 1]);
        count = Number.isFinite(parsed) && parsed > 0 ? parsed : count;
        i += 1;
      }
    }

    const keys = this.allKeys().filter((key) => {
      if (this.isExpired(key)) return false;
      if (!matchPattern) return true;
      return this.matchPattern(key, matchPattern);
    });
    keys.sort();

    const start = Number(cursor);
    const slice = keys.slice(start, start + count);
    const next = start + slice.length;
    const nextCursor = next >= keys.length ? "0" : String(next);
    return [nextCursor, slice] as [string, string[]];
  }

  async pexpire(key: string, ttlMs: number) {
    this.expiries.set(key, this.nowMs() + ttlMs);
    return 1;
  }

  async persist(key: string) {
    const had = this.expiries.has(key);
    this.expiries.delete(key);
    return had ? 1 : 0;
  }

  async set(
    key: string,
    value: string,
    options?: { NX?: boolean; PX?: number }
  ) {
    if (options?.NX && this.strings.has(key) && !this.isExpired(key)) {
      return null;
    }
    this.strings.set(key, value);
    if (options?.PX) {
      this.expiries.set(key, this.nowMs() + options.PX);
    }
    return "OK";
  }

  async get(key: string) {
    if (this.isExpired(key)) return null;
    return this.strings.get(key) ?? null;
  }

  async eval(_script: string, keys: string[], args: string[]) {
    const key = keys[0];
    const token = args[0];
    if (this.isExpired(key)) return 0;
    const current = this.strings.get(key);
    if (current !== token) return 0;
    this.strings.delete(key);
    this.expiries.delete(key);
    return 1;
  }

  getExpiry(key: string) {
    return this.expiries.get(key);
  }
}

const createMockSession = (
  overrides: Partial<UptoSession> = {}
): UptoSession => ({
  cap: 1000n,
  deadline: 1700000000n,
  pendingSpent: 100n,
  settledTotal: 0n,
  lastActivityMs: 1700000000000,
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

describe("RedisUptoSessionStore", () => {
  let redis: FakeRedis;
  let store: RedisUptoSessionStore;

  beforeEach(() => {
    redis = new FakeRedis();
    const fixedNow = 1_700_000_000_000;
    redis.nowMs = () => fixedNow;
    store = new RedisUptoSessionStore(redis, {
      keyPrefix: "test:upto",
      closedTtlMs: 12 * 60 * 60 * 1000,
    });
  });

  it("round-trips sessions with bigint fields", async () => {
    const session = createMockSession({
      cap: 1234n,
      pendingSpent: 55n,
      settledTotal: 66n,
      status: "open",
    });

    await store.set("session-1", session);
    const loaded = await store.get("session-1");

    expect(loaded).toBeDefined();
    expect(loaded?.cap).toBe(1234n);
    expect(loaded?.pendingSpent).toBe(55n);
    expect(loaded?.settledTotal).toBe(66n);
    expect(loaded?.status).toBe("open");
  });

  it("iterates entries via async iterator", async () => {
    await store.set("session-1", createMockSession({ cap: 100n }));
    await store.set("session-2", createMockSession({ cap: 200n }));

    const entries: Array<[string, UptoSession]> = [];
    for await (const entry of store.entries()) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(2);
    const ids = entries.map(([id]) => id);
    expect(ids).toContain("session-1");
    expect(ids).toContain("session-2");
  });

  it("iterates entries via scan when unindexed", async () => {
    const unindexed = new RedisUptoSessionStore(redis, {
      keyPrefix: "test:upto",
      useIndexSet: false,
    });

    await unindexed.set("session-1", createMockSession({ cap: 100n }));
    await unindexed.set("session-2", createMockSession({ cap: 200n }));

    const entries: Array<[string, UptoSession]> = [];
    for await (const entry of unindexed.entries()) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(2);
    const ids = entries.map(([id]) => id);
    expect(ids).toContain("session-1");
    expect(ids).toContain("session-2");
  });

  it("deletes sessions and removes index entries", async () => {
    await store.set("session-1", createMockSession());
    await store.delete("session-1");
    const loaded = await store.get("session-1");
    expect(loaded).toBeUndefined();
  });

  it("applies TTL when session is closed", async () => {
    const session = createMockSession({ status: "closed" });
    await store.set("session-1", session);

    const key = "test:upto:sessions:session-1";
    const expiry = redis.getExpiry(key);
    expect(expiry).toBe(1_700_000_000_000 + 12 * 60 * 60 * 1000);
  });
});

describe("createRedisSweeperLock", () => {
  it("acquires and releases a global lock", async () => {
    const redis = new FakeRedis();
    const lock = createRedisSweeperLock(redis, {
      key: "upto:sweeper:lock",
      ttlMs: 5000,
    });

    expect(await lock.acquire()).toBe(true);
    expect(await lock.acquire()).toBe(false);

    await lock.release();
    expect(await lock.acquire()).toBe(true);
  });
});

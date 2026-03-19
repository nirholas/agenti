import type { UptoSession, UptoSessionStore } from "./store.js";
import type { UptoSweeperLock } from "./sweeper.js";

export type RedisSetOptions = {
  NX?: boolean;
  PX?: number;
};

export type RedisClientLike = {
  hset: (key: string, values: Record<string, string>) => Promise<number | void> | number | void;
  hgetall: (key: string) => Promise<Record<string, string>> | Record<string, string>;
  del: (key: string) => Promise<number> | number;
  sadd?: (key: string, ...members: string[]) => Promise<number> | number;
  srem?: (key: string, ...members: string[]) => Promise<number> | number;
  smembers?: (key: string) => Promise<string[]> | string[];
  scan?: (
    ...args: any[]
  ) => Promise<[string, string[]]> | [string, string[]];
  pexpire?: (key: string, ttlMs: number) => Promise<number> | number;
  persist?: (key: string) => Promise<number> | number;
  set?: (...args: any[]) => Promise<string | null> | string | null;
  get?: (key: string) => Promise<string | null> | string | null;
  eval?: (...args: any[]) => Promise<unknown> | unknown;
};

export type RedisUptoSessionStoreOptions = {
  keyPrefix?: string;
  useIndexSet?: boolean;
  scanCount?: number;
  closedTtlMs?: number;
};

const DEFAULT_CLOSED_TTL_MS = 12 * 60 * 60 * 1000;

const SESSION_FIELDS = {
  cap: "cap",
  deadline: "deadline",
  pendingSpent: "pendingSpent",
  settledTotal: "settledTotal",
  lastActivityMs: "lastActivityMs",
  settlingSinceMs: "settlingSinceMs",
  status: "status",
  paymentPayload: "paymentPayload",
  paymentRequirements: "paymentRequirements",
  lastSettlement: "lastSettlement",
} as const;

export class RedisUptoSessionStore implements UptoSessionStore {
  private readonly redis: RedisClientLike;
  private readonly keyPrefix: string;
  private readonly useIndexSet: boolean;
  private readonly scanCount: number;
  private readonly closedTtlMs: number;

  constructor(redis: RedisClientLike, options: RedisUptoSessionStoreOptions = {}) {
    this.redis = redis;
    this.keyPrefix = options.keyPrefix ?? "upto";
    this.useIndexSet = options.useIndexSet ?? true;
    this.scanCount = options.scanCount ?? 250;
    this.closedTtlMs = options.closedTtlMs ?? DEFAULT_CLOSED_TTL_MS;

    if (
      this.useIndexSet &&
      (!this.redis.sadd || !this.redis.srem || !this.redis.smembers)
    ) {
      throw new Error("Redis client missing set commands for index tracking.");
    }
  }

  private sessionKey(id: string) {
    return `${this.keyPrefix}:sessions:${id}`;
  }

  private indexKey() {
    return `${this.keyPrefix}:sessions:index`;
  }

  async get(id: string): Promise<UptoSession | undefined> {
    const key = this.sessionKey(id);
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return undefined;
    return deserializeSession(data);
  }

  async set(id: string, session: UptoSession): Promise<void> {
    const key = this.sessionKey(id);
    await this.redis.hset(key, serializeSession(session));

    if (this.useIndexSet && this.redis.sadd) {
      await this.redis.sadd(this.indexKey(), id);
    }

    if (session.status === "closed") {
      if (this.closedTtlMs > 0 && this.redis.pexpire) {
        await this.redis.pexpire(key, this.closedTtlMs);
      }
    } else if (this.redis.persist) {
      await this.redis.persist(key);
    }
  }

  async delete(id: string): Promise<void> {
    const key = this.sessionKey(id);
    await this.redis.del(key);

    if (this.useIndexSet && this.redis.srem) {
      await this.redis.srem(this.indexKey(), id);
    }
  }

  async *entries(): AsyncIterableIterator<[string, UptoSession]> {
    if (this.useIndexSet) {
      if (!this.redis.smembers) {
        throw new Error("Redis client missing smembers for indexed entries.");
      }
      const ids = await this.redis.smembers(this.indexKey());
      for (const id of ids) {
        const session = await this.get(id);
        if (session) {
          yield [id, session];
        } else if (this.redis.srem) {
          await this.redis.srem(this.indexKey(), id);
        }
      }
      return;
    }

    if (!this.redis.scan) {
      throw new Error("Redis client missing scan for unindexed entries.");
    }

    const prefix = `${this.keyPrefix}:sessions:`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        String(this.scanCount)
      );
      for (const key of keys) {
        const id = key.slice(prefix.length);
        const session = await this.get(id);
        if (session) yield [id, session];
      }
      cursor = nextCursor;
    } while (cursor !== "0");
  }
}

export type RedisSweeperLockOptions = {
  key?: string;
  ttlMs?: number;
  token?: string;
  useOptionsStyle?: boolean;
  allowUnsafeRelease?: boolean;
};

export function createRedisSweeperLock(
  redis: RedisClientLike,
  options: RedisSweeperLockOptions = {}
): UptoSweeperLock {
  const key = options.key ?? "upto:sweeper:lock";
  const ttlMs = options.ttlMs ?? 60_000;
  const token = options.token ?? crypto.randomUUID();
  const useOptionsStyle = options.useOptionsStyle ?? true;
  const allowUnsafeRelease = options.allowUnsafeRelease ?? false;

  if (!redis.eval && !allowUnsafeRelease) {
    throw new Error(
      "Redis client missing eval for safe sweeper lock release. Set allowUnsafeRelease to true to use a non-atomic fallback."
    );
  }

  return {
    async acquire() {
      if (!redis.set) {
        throw new Error("Redis client missing set for sweeper lock.");
      }

      const result = useOptionsStyle
        ? await redis.set(key, token, { NX: true, PX: ttlMs })
        : await redis.set(key, token, "PX", ttlMs, "NX");
      return result === "OK";
    },
    async release() {
      if (redis.eval) {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          [key],
          [token]
        );
        return;
      }

      if (!allowUnsafeRelease) {
        throw new Error(
          "Redis client missing eval for safe sweeper lock release. Set allowUnsafeRelease to true to use a non-atomic fallback."
        );
      }
      if (!redis.get) {
        throw new Error("Redis client missing get for sweeper lock release.");
      }
      const current = await redis.get(key);
      if (current !== token) return;
      await redis.del(key);
    },
  };
}

function serializeSession(session: UptoSession): Record<string, string> {
  const payload = JSON.stringify(session.paymentPayload);
  const requirements = JSON.stringify(session.paymentRequirements);

  return {
    [SESSION_FIELDS.cap]: session.cap.toString(),
    [SESSION_FIELDS.deadline]: session.deadline.toString(),
    [SESSION_FIELDS.pendingSpent]: session.pendingSpent.toString(),
    [SESSION_FIELDS.settledTotal]: session.settledTotal.toString(),
    [SESSION_FIELDS.lastActivityMs]: String(session.lastActivityMs),
    [SESSION_FIELDS.settlingSinceMs]:
      session.settlingSinceMs !== undefined
        ? String(session.settlingSinceMs)
        : "",
    [SESSION_FIELDS.status]: session.status,
    [SESSION_FIELDS.paymentPayload]: payload,
    [SESSION_FIELDS.paymentRequirements]: requirements,
    [SESSION_FIELDS.lastSettlement]: session.lastSettlement
      ? JSON.stringify(session.lastSettlement)
      : "",
  };
}

function deserializeSession(data: Record<string, string>): UptoSession {
  return {
    cap: BigInt(data[SESSION_FIELDS.cap]),
    deadline: BigInt(data[SESSION_FIELDS.deadline]),
    pendingSpent: BigInt(data[SESSION_FIELDS.pendingSpent]),
    settledTotal: BigInt(data[SESSION_FIELDS.settledTotal]),
    lastActivityMs: Number(data[SESSION_FIELDS.lastActivityMs]),
    settlingSinceMs: data[SESSION_FIELDS.settlingSinceMs]
      ? Number(data[SESSION_FIELDS.settlingSinceMs])
      : undefined,
    status: data[SESSION_FIELDS.status] as UptoSession["status"],
    paymentPayload: JSON.parse(data[SESSION_FIELDS.paymentPayload]),
    paymentRequirements: JSON.parse(data[SESSION_FIELDS.paymentRequirements]),
    lastSettlement: data[SESSION_FIELDS.lastSettlement]
      ? JSON.parse(data[SESSION_FIELDS.lastSettlement])
      : undefined,
  };
}

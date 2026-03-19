import { describe, it, expect, mock } from "bun:test";
import { createDrizzleAdapter, createTracking } from "../src/db.js";
import {
  InMemoryResourceTrackingStore,
  PostgresResourceTrackingStore,
} from "@daydreamsai/facilitator/tracking";

// ============================================================================
// Cycle 1: createDrizzleAdapter
// ============================================================================

function mockPool(rows: Record<string, unknown>[]) {
  return {
    query: mock(async () => ({ rows })),
    end: mock(async () => {}),
  };
}

describe("createDrizzleAdapter", () => {
  it("query returns all rows from pool.query", async () => {
    const pool = mockPool([{ id: 1 }, { id: 2 }]);
    const adapter = createDrizzleAdapter(pool as any);

    const result = await adapter.query("SELECT * FROM t", []);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM t", []);
  });

  it("queryOne returns first row", async () => {
    const pool = mockPool([{ id: 1 }, { id: 2 }]);
    const adapter = createDrizzleAdapter(pool as any);

    const result = await adapter.queryOne("SELECT * FROM t LIMIT 1", []);

    expect(result).toEqual({ id: 1 });
  });

  it("queryOne returns undefined for empty result", async () => {
    const pool = mockPool([]);
    const adapter = createDrizzleAdapter(pool as any);

    const result = await adapter.queryOne("SELECT * FROM t WHERE 1=0", []);

    expect(result).toBeUndefined();
  });

  it("queryScalar returns first value of first row", async () => {
    const pool = mockPool([{ count: 42 }]);
    const adapter = createDrizzleAdapter(pool as any);

    const result = await adapter.queryScalar("SELECT COUNT(*) FROM t", []);

    expect(result).toBe(42);
  });

  it("queryScalar returns undefined for empty result", async () => {
    const pool = mockPool([]);
    const adapter = createDrizzleAdapter(pool as any);

    const result = await adapter.queryScalar("SELECT COUNT(*) FROM t", []);

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Cycle 2: createTracking
// ============================================================================

describe("createTracking", () => {
  it("returns module with InMemoryResourceTrackingStore when no adapter", () => {
    const tracking = createTracking(undefined, { asyncTracking: false });

    expect(tracking).toBeDefined();
    expect(tracking.store).toBeInstanceOf(InMemoryResourceTrackingStore);
  });

  it("returns PostgresResourceTrackingStore when adapter provided", async () => {
    const adapter = {
      query: mock(async () => []),
      queryOne: mock(async () => undefined),
      queryScalar: mock(async () => undefined),
    };
    const tracking = createTracking(adapter as any, { asyncTracking: false });

    expect(tracking.store).toBeInstanceOf(PostgresResourceTrackingStore);

    const id = await tracking.startTracking({
      method: "POST",
      path: "/verify",
      url: "http://localhost/verify",
      paymentRequired: false,
      request: { headers: {}, queryParams: {} },
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe("string");

    expect(adapter.query).toHaveBeenCalled();
    const firstSql = String(adapter.query.mock.calls[0]?.[0] ?? "");
    expect(firstSql).toContain("INSERT INTO");
    expect(firstSql).toContain("resource_call_records");
  });
});

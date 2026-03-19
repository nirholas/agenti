import type { Pool } from "pg";
import type {
  PostgresClientAdapter,
  ResourceTrackingModuleConfig,
} from "@daydreamsai/facilitator/tracking";
import {
  createResourceTrackingModule,
  InMemoryResourceTrackingStore,
  PostgresResourceTrackingStore,
  type ResourceTrackingModule,
} from "@daydreamsai/facilitator/tracking";

/**
 * Creates a PostgresClientAdapter from a pg Pool instance.
 * Uses the pool directly for raw parameterized SQL queries.
 */
export function createDrizzleAdapter(pool: Pool): PostgresClientAdapter {
  return {
    query: async (sql, params) => {
      const result = await pool.query(sql, params);
      return result.rows;
    },
    queryOne: async (sql, params) => {
      const result = await pool.query(sql, params);
      return result.rows[0];
    },
    queryScalar: async <T = unknown>(sql: string, params?: unknown[]) => {
      const result = await pool.query(sql, params);
      const row = result.rows[0];
      return (row ? Object.values(row)[0] : undefined) as T | undefined;
    },
  };
}

/**
 * Creates a ResourceTrackingModule, using PostgresResourceTrackingStore
 * when an adapter is provided, InMemoryResourceTrackingStore otherwise.
 */
export function createTracking(
  pgClient?: PostgresClientAdapter,
  options: Omit<ResourceTrackingModuleConfig, "store"> = {}
): ResourceTrackingModule {
  const store = pgClient
    ? new PostgresResourceTrackingStore(pgClient)
    : new InMemoryResourceTrackingStore();

  return createResourceTrackingModule({
    store,
    ...options,
    onTrackingError:
      options.onTrackingError ??
      ((err, id) => {
        console.warn(`[tracking:${id}]`, err);
      }),
  });
}

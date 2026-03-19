/**
 * PostgreSQL Resource Tracking Store
 *
 * Production-ready store implementation using PostgreSQL for persistence.
 * Supports any Postgres client through an adapter interface.
 */

import type {
  ResourceCallRecord,
  ListOptions,
  ListFilters,
  ListResult,
  TrackingStats,
  TrackedPayment,
  TrackedSettlement,
  TrackedUptoSession,
  TrackedRequest,
  TrackedRouteConfig,
} from "./types.js";
import type { ResourceTrackingStore } from "./store.js";

/**
 * Query result row from Postgres
 */
export interface QueryResultRow {
  [key: string]: unknown;
}

/**
 * Postgres client adapter interface.
 * Implement this interface to use any Postgres client (pg, postgres.js, drizzle, etc.)
 */
export interface PostgresClientAdapter {
  /**
   * Execute a query with parameterized values
   * @param sql SQL query with $1, $2, etc. placeholders
   * @param params Parameter values
   * @returns Array of result rows
   */
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]>;

  /**
   * Execute a query that returns a single row or undefined
   */
  queryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T | undefined>;

  /**
   * Execute a query that returns a single scalar value
   */
  queryScalar<T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<T | undefined>;
}

/**
 * Options for PostgresResourceTrackingStore
 */
export interface PostgresResourceTrackingStoreOptions {
  /** Table name (default: "resource_call_records") */
  tableName?: string;
  /** Schema name (default: "public") */
  schema?: string;
}

/**
 * SQL schema for resource_call_records table.
 * Run this to create the table and indexes.
 */
export const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS resource_call_records (
  id UUID PRIMARY KEY,
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  route_key TEXT NOT NULL,
  url TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,

  payment_required BOOLEAN NOT NULL,
  payment_verified BOOLEAN NOT NULL,
  verification_error TEXT,

  payment JSONB,
  settlement JSONB,
  upto_session JSONB,
  x402_version INTEGER,
  payment_nonce TEXT,
  payment_valid_before TEXT,
  payload_hash TEXT,
  requirements_hash TEXT,
  payment_signature_hash TEXT,

  response_status INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  handler_executed BOOLEAN NOT NULL DEFAULT false,

  request JSONB NOT NULL,
  route_config JSONB,
  metadata JSONB
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_records_timestamp ON resource_call_records(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_records_path ON resource_call_records(path);
CREATE INDEX IF NOT EXISTS idx_records_payment_network ON resource_call_records((payment->>'network')) WHERE payment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_payment_scheme ON resource_call_records((payment->>'scheme')) WHERE payment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_payment_payer ON resource_call_records((payment->>'payer')) WHERE payment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_payment_verified ON resource_call_records(payment_verified);
CREATE INDEX IF NOT EXISTS idx_records_settlement_success ON resource_call_records((settlement->>'success')) WHERE settlement IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_x402_version ON resource_call_records(x402_version);
CREATE INDEX IF NOT EXISTS idx_records_payment_nonce ON resource_call_records(payment_nonce);
CREATE INDEX IF NOT EXISTS idx_records_payload_hash ON resource_call_records(payload_hash);
CREATE INDEX IF NOT EXISTS idx_records_requirements_hash ON resource_call_records(requirements_hash);
`;

const quoteIdentifier = (value: string): string =>
  `"${value.replace(/"/g, "\"\"")}"`;

const buildPostgresSchemaSql = (schema: string, tableName: string): string => {
  const schemaIdent = quoteIdentifier(schema);
  const tableIdent = quoteIdentifier(tableName);
  const tableRef = `${schemaIdent}.${tableIdent}`;
  const indexName = (suffix: string): string =>
    `${schemaIdent}.${quoteIdentifier(`idx_${tableName}_${suffix}`)}`;

  return `
CREATE SCHEMA IF NOT EXISTS ${schemaIdent};
CREATE TABLE IF NOT EXISTS ${tableRef} (
  id UUID PRIMARY KEY,
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  route_key TEXT NOT NULL,
  url TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,

  payment_required BOOLEAN NOT NULL,
  payment_verified BOOLEAN NOT NULL,
  verification_error TEXT,

  payment JSONB,
  settlement JSONB,
  upto_session JSONB,
  x402_version INTEGER,
  payment_nonce TEXT,
  payment_valid_before TEXT,
  payload_hash TEXT,
  requirements_hash TEXT,
  payment_signature_hash TEXT,

  response_status INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  handler_executed BOOLEAN NOT NULL DEFAULT false,

  request JSONB NOT NULL,
  route_config JSONB,
  metadata JSONB
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS ${indexName("timestamp")} ON ${tableRef}(timestamp DESC);
CREATE INDEX IF NOT EXISTS ${indexName("path")} ON ${tableRef}(path);
CREATE INDEX IF NOT EXISTS ${indexName("payment_network")} ON ${tableRef}((payment->>'network')) WHERE payment IS NOT NULL;
CREATE INDEX IF NOT EXISTS ${indexName("payment_scheme")} ON ${tableRef}((payment->>'scheme')) WHERE payment IS NOT NULL;
CREATE INDEX IF NOT EXISTS ${indexName("payment_payer")} ON ${tableRef}((payment->>'payer')) WHERE payment IS NOT NULL;
CREATE INDEX IF NOT EXISTS ${indexName("payment_verified")} ON ${tableRef}(payment_verified);
CREATE INDEX IF NOT EXISTS ${indexName("settlement_success")} ON ${tableRef}((settlement->>'success')) WHERE settlement IS NOT NULL;
CREATE INDEX IF NOT EXISTS ${indexName("x402_version")} ON ${tableRef}(x402_version);
CREATE INDEX IF NOT EXISTS ${indexName("payment_nonce")} ON ${tableRef}(payment_nonce);
CREATE INDEX IF NOT EXISTS ${indexName("payload_hash")} ON ${tableRef}(payload_hash);
CREATE INDEX IF NOT EXISTS ${indexName("requirements_hash")} ON ${tableRef}(requirements_hash);
`;
};

/**
 * PostgreSQL implementation of ResourceTrackingStore.
 * Uses parameterized queries for security.
 */
export class PostgresResourceTrackingStore implements ResourceTrackingStore {
  private readonly client: PostgresClientAdapter;
  private readonly tableName: string;
  private readonly schema: string;

  constructor(
    client: PostgresClientAdapter,
    options: PostgresResourceTrackingStoreOptions = {}
  ) {
    this.client = client;
    this.tableName = options.tableName ?? "resource_call_records";
    this.schema = options.schema ?? "public";
  }

  /**
   * Get the fully qualified table name
   */
  private get table(): string {
    return `"${this.schema}"."${this.tableName}"`;
  }

  async create(record: ResourceCallRecord): Promise<void> {
    const sql = `
      INSERT INTO ${this.table} (
        id, method, path, route_key, url, timestamp,
        payment_required, payment_verified, verification_error,
        payment, settlement, upto_session,
        x402_version, payment_nonce, payment_valid_before,
        payload_hash, requirements_hash, payment_signature_hash,
        response_status, response_time_ms, handler_executed,
        request, route_config, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24
      )
    `;

    await this.client.query(sql, [
      record.id,
      record.method,
      record.path,
      record.routeKey,
      record.url,
      record.timestamp,
      record.paymentRequired,
      record.paymentVerified,
      record.verificationError ?? null,
      record.payment ? JSON.stringify(record.payment) : null,
      record.settlement ? JSON.stringify(record.settlement) : null,
      record.uptoSession ? JSON.stringify(record.uptoSession) : null,
      record.x402Version ?? null,
      record.paymentNonce ?? null,
      record.paymentValidBefore ?? null,
      record.payloadHash ?? null,
      record.requirementsHash ?? null,
      record.paymentSignatureHash ?? null,
      record.responseStatus,
      record.responseTimeMs,
      record.handlerExecuted,
      JSON.stringify(record.request),
      record.routeConfig ? JSON.stringify(record.routeConfig) : null,
      record.metadata ? JSON.stringify(record.metadata) : null,
    ]);
  }

  async update(
    id: string,
    updates: Partial<ResourceCallRecord>
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Build SET clauses dynamically based on provided updates
    if (updates.paymentVerified !== undefined) {
      setClauses.push(`payment_verified = $${paramIndex++}`);
      params.push(updates.paymentVerified);
    }
    if (updates.verificationError !== undefined) {
      setClauses.push(`verification_error = $${paramIndex++}`);
      params.push(updates.verificationError);
    } else if (updates.paymentVerified === true) {
      // Successful verification clears any previous error.
      setClauses.push("verification_error = NULL");
    }
    if (updates.payment !== undefined) {
      setClauses.push(`payment = $${paramIndex++}`);
      params.push(JSON.stringify(updates.payment));
    }
    if (updates.settlement !== undefined) {
      setClauses.push(`settlement = $${paramIndex++}`);
      params.push(JSON.stringify(updates.settlement));
    }
    if (updates.uptoSession !== undefined) {
      setClauses.push(`upto_session = $${paramIndex++}`);
      params.push(JSON.stringify(updates.uptoSession));
    }
    if (updates.x402Version !== undefined) {
      setClauses.push(`x402_version = $${paramIndex++}`);
      params.push(updates.x402Version);
    }
    if (updates.paymentNonce !== undefined) {
      setClauses.push(`payment_nonce = $${paramIndex++}`);
      params.push(updates.paymentNonce);
    }
    if (updates.paymentValidBefore !== undefined) {
      setClauses.push(`payment_valid_before = $${paramIndex++}`);
      params.push(updates.paymentValidBefore);
    }
    if (updates.payloadHash !== undefined) {
      setClauses.push(`payload_hash = $${paramIndex++}`);
      params.push(updates.payloadHash);
    }
    if (updates.requirementsHash !== undefined) {
      setClauses.push(`requirements_hash = $${paramIndex++}`);
      params.push(updates.requirementsHash);
    }
    if (updates.paymentSignatureHash !== undefined) {
      setClauses.push(`payment_signature_hash = $${paramIndex++}`);
      params.push(updates.paymentSignatureHash);
    }
    if (updates.responseStatus !== undefined) {
      setClauses.push(`response_status = $${paramIndex++}`);
      params.push(updates.responseStatus);
    }
    if (updates.responseTimeMs !== undefined) {
      setClauses.push(`response_time_ms = $${paramIndex++}`);
      params.push(updates.responseTimeMs);
    }
    if (updates.handlerExecuted !== undefined) {
      setClauses.push(`handler_executed = $${paramIndex++}`);
      params.push(updates.handlerExecuted);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(updates.metadata));
    }

    if (setClauses.length === 0) return;

    params.push(id);
    const sql = `
      UPDATE ${this.table}
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id
    `;

    const updated = await this.client.queryOne<{ id: unknown }>(sql, params);
    if (!updated) {
      throw new Error(`Tracking record not found for update: ${id}`);
    }
  }

  async get(id: string): Promise<ResourceCallRecord | undefined> {
    const sql = `SELECT * FROM ${this.table} WHERE id = $1`;
    const row = await this.client.queryOne(sql, [id]);
    return row ? this.rowToRecord(row) : undefined;
  }

  async list(options: ListOptions): Promise<ListResult> {
    const { whereClauses, params } = this.buildWhereClause(options.filters);
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;

    // Build ORDER BY clause
    let orderBy = "timestamp DESC";
    if (options.sort) {
      const field = this.mapSortField(options.sort.field);
      const dir = options.sort.direction.toUpperCase();
      orderBy = `${field} ${dir}`;
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM ${this.table}${whereClauses ? ` WHERE ${whereClauses}` : ""}`;
    const countResult = await this.client.queryScalar<string>(countSql, params);
    const total = parseInt(countResult ?? "0", 10);

    // Get records
    const dataSql = `
      SELECT * FROM ${this.table}
      ${whereClauses ? `WHERE ${whereClauses}` : ""}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const rows = await this.client.query(dataSql, [...params, limit, offset]);
    const records = rows.map((row) => this.rowToRecord(row));

    return {
      records,
      total,
      hasMore: offset + records.length < total,
      nextCursor:
        offset + records.length < total ? String(offset + limit) : undefined,
    };
  }

  async getStats(startTime: Date, endTime: Date): Promise<TrackingStats> {
    const sql = `
      SELECT
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE payment_required) as payment_required_requests,
        COUNT(*) FILTER (WHERE payment_verified) as verified_payments,
        COUNT(*) FILTER (WHERE (settlement->>'success')::boolean = true) as successful_settlements,
        COUNT(*) FILTER (WHERE (settlement->>'attempted')::boolean = true AND (settlement->>'success')::boolean = false) as failed_settlements,
        AVG(response_time_ms) as avg_response_time_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time_ms
      FROM ${this.table}
      WHERE timestamp >= $1 AND timestamp <= $2
    `;

    const result = await this.client.queryOne(sql, [startTime, endTime]);

    // Get breakdown stats
    const pathSql = `
      SELECT path, COUNT(*) as count
      FROM ${this.table}
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY path
    `;
    const pathRows = await this.client.query(pathSql, [startTime, endTime]);

    const networkSql = `
      SELECT payment->>'network' as network, COUNT(*) as count
      FROM ${this.table}
      WHERE timestamp >= $1 AND timestamp <= $2 AND payment IS NOT NULL
      GROUP BY payment->>'network'
    `;
    const networkRows = await this.client.query(networkSql, [
      startTime,
      endTime,
    ]);

    const schemeSql = `
      SELECT payment->>'scheme' as scheme, COUNT(*) as count
      FROM ${this.table}
      WHERE timestamp >= $1 AND timestamp <= $2 AND payment IS NOT NULL
      GROUP BY payment->>'scheme'
    `;
    const schemeRows = await this.client.query(schemeSql, [startTime, endTime]);

    const volumeByNetworkSql = `
      SELECT
        payment->>'network' as network,
        SUM((payment->>'amount')::numeric) as total
      FROM ${this.table}
      WHERE timestamp >= $1 AND timestamp <= $2 AND payment IS NOT NULL
      GROUP BY payment->>'network'
    `;
    const volumeByNetworkRows = await this.client.query(volumeByNetworkSql, [
      startTime,
      endTime,
    ]);

    const volumeByAssetSql = `
      SELECT
        payment->>'network' || ':' || payment->>'asset' as asset_key,
        SUM((payment->>'amount')::numeric) as total
      FROM ${this.table}
      WHERE timestamp >= $1 AND timestamp <= $2 AND payment IS NOT NULL
      GROUP BY payment->>'network', payment->>'asset'
    `;
    const volumeByAssetRows = await this.client.query(volumeByAssetSql, [
      startTime,
      endTime,
    ]);

    return {
      period: { start: startTime, end: endTime },
      totalRequests: parseInt(String(result?.total_requests ?? 0), 10),
      paymentRequiredRequests: parseInt(
        String(result?.payment_required_requests ?? 0),
        10
      ),
      verifiedPayments: parseInt(String(result?.verified_payments ?? 0), 10),
      successfulSettlements: parseInt(
        String(result?.successful_settlements ?? 0),
        10
      ),
      failedSettlements: parseInt(String(result?.failed_settlements ?? 0), 10),
      avgResponseTimeMs: parseFloat(String(result?.avg_response_time_ms ?? 0)),
      p95ResponseTimeMs: parseFloat(String(result?.p95_response_time_ms ?? 0)),
      requestsByPath: Object.fromEntries(
        pathRows.map((r) => [String(r.path), parseInt(String(r.count), 10)])
      ),
      requestsByNetwork: Object.fromEntries(
        networkRows.map((r) => [
          String(r.network),
          parseInt(String(r.count), 10),
        ])
      ),
      requestsByScheme: Object.fromEntries(
        schemeRows.map((r) => [String(r.scheme), parseInt(String(r.count), 10)])
      ),
      totalVolumeByNetwork: Object.fromEntries(
        volumeByNetworkRows.map((r) => [String(r.network), String(r.total)])
      ),
      totalVolumeByAsset: Object.fromEntries(
        volumeByAssetRows.map((r) => [String(r.asset_key), String(r.total)])
      ),
    };
  }

  async prune(olderThan: Date): Promise<number> {
    const sql = `
      WITH deleted AS (
        DELETE FROM ${this.table}
        WHERE timestamp < $1
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `;
    const result = await this.client.queryScalar<string>(sql, [olderThan]);
    return parseInt(result ?? "0", 10);
  }

  /**
   * Initialize the database schema.
   * Call this once on startup to create table and indexes.
   */
  async initialize(): Promise<void> {
    const schemaSql =
      this.schema === "public" && this.tableName === "resource_call_records"
        ? POSTGRES_SCHEMA
        : buildPostgresSchemaSql(this.schema, this.tableName);
    await this.client.query(schemaSql);
  }

  private buildWhereClause(filters?: ListFilters): {
    whereClauses: string;
    params: unknown[];
  } {
    if (!filters) return { whereClauses: "", params: [] };

    const clauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.path) {
      clauses.push(`path = $${paramIndex++}`);
      params.push(filters.path);
    }
    if (filters.method) {
      clauses.push(`method = $${paramIndex++}`);
      params.push(filters.method);
    }
    if (filters.network) {
      clauses.push(`payment->>'network' = $${paramIndex++}`);
      params.push(filters.network);
    }
    if (filters.networkType) {
      clauses.push(`payment->>'networkType' = $${paramIndex++}`);
      params.push(filters.networkType);
    }
    if (filters.scheme) {
      clauses.push(`payment->>'scheme' = $${paramIndex++}`);
      params.push(filters.scheme);
    }
    if (filters.paymentRequired !== undefined) {
      clauses.push(`payment_required = $${paramIndex++}`);
      params.push(filters.paymentRequired);
    }
    if (filters.paymentVerified !== undefined) {
      clauses.push(`payment_verified = $${paramIndex++}`);
      params.push(filters.paymentVerified);
    }
    if (filters.settlementSuccess !== undefined) {
      clauses.push(`(settlement->>'success')::boolean = $${paramIndex++}`);
      params.push(filters.settlementSuccess);
    }
    if (filters.startTime) {
      clauses.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.startTime);
    }
    if (filters.endTime) {
      clauses.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.endTime);
    }
    if (filters.minResponseTimeMs !== undefined) {
      clauses.push(`response_time_ms >= $${paramIndex++}`);
      params.push(filters.minResponseTimeMs);
    }
    if (filters.maxResponseTimeMs !== undefined) {
      clauses.push(`response_time_ms <= $${paramIndex++}`);
      params.push(filters.maxResponseTimeMs);
    }
    if (filters.payer) {
      clauses.push(`payment->>'payer' = $${paramIndex++}`);
      params.push(filters.payer);
    }

    return {
      whereClauses: clauses.join(" AND "),
      params,
    };
  }

  private mapSortField(field: string): string {
    switch (field) {
      case "timestamp":
        return "timestamp";
      case "responseTimeMs":
        return "response_time_ms";
      case "path":
        return "path";
      default:
        return "timestamp";
    }
  }

  private rowToRecord(row: QueryResultRow): ResourceCallRecord {
    return {
      id: String(row.id),
      method: String(row.method),
      path: String(row.path),
      routeKey: String(row.route_key),
      url: String(row.url),
      timestamp: new Date(row.timestamp as string | number | Date),
      paymentRequired: Boolean(row.payment_required),
      paymentVerified: Boolean(row.payment_verified),
      verificationError: row.verification_error
        ? String(row.verification_error)
        : undefined,
      payment: row.payment
        ? (this.parseJson(row.payment) as TrackedPayment)
        : undefined,
      settlement: row.settlement
        ? (this.parseJson(row.settlement) as TrackedSettlement)
        : undefined,
      uptoSession: row.upto_session
        ? (this.parseJson(row.upto_session) as TrackedUptoSession)
        : undefined,
      x402Version:
        row.x402_version === null || row.x402_version === undefined
          ? undefined
          : Number(row.x402_version),
      paymentNonce: row.payment_nonce ? String(row.payment_nonce) : undefined,
      paymentValidBefore: row.payment_valid_before
        ? String(row.payment_valid_before)
        : undefined,
      payloadHash: row.payload_hash ? String(row.payload_hash) : undefined,
      requirementsHash: row.requirements_hash
        ? String(row.requirements_hash)
        : undefined,
      paymentSignatureHash: row.payment_signature_hash
        ? String(row.payment_signature_hash)
        : undefined,
      responseStatus: Number(row.response_status),
      responseTimeMs: Number(row.response_time_ms),
      handlerExecuted: Boolean(row.handler_executed),
      request: this.parseJson(row.request) as TrackedRequest,
      routeConfig: row.route_config
        ? (this.parseJson(row.route_config) as TrackedRouteConfig)
        : undefined,
      metadata: row.metadata
        ? (this.parseJson(row.metadata) as Record<string, unknown>)
        : undefined,
    };
  }

  private parseJson(value: unknown): unknown {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value;
  }
}

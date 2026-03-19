/**
 * Resource Tracking Store Interface and In-Memory Implementation
 *
 * Defines the storage interface for resource call tracking with
 * support for both synchronous (in-memory) and asynchronous (Postgres) implementations.
 */

import type {
  MaybePromise,
  ResourceCallRecord,
  ListOptions,
  ListFilters,
  ListSort,
  ListResult,
  TrackingStats,
} from "./types.js";

/**
 * Store interface for resource call tracking.
 * Uses MaybePromise pattern to support both sync and async implementations.
 */
export interface ResourceTrackingStore {
  /**
   * Create a new tracking record
   */
  create(record: ResourceCallRecord): MaybePromise<void>;

  /**
   * Update an existing record (e.g., add settlement info)
   */
  update(id: string, updates: Partial<ResourceCallRecord>): MaybePromise<void>;

  /**
   * Get a specific record by ID
   */
  get(id: string): MaybePromise<ResourceCallRecord | undefined>;

  /**
   * List records with pagination and filtering
   */
  list(options: ListOptions): MaybePromise<ListResult>;

  /**
   * Get aggregated statistics for a time range
   */
  getStats(startTime: Date, endTime: Date): MaybePromise<TrackingStats>;

  /**
   * Prune records older than specified date
   * @returns Count of deleted records
   */
  prune(olderThan: Date): MaybePromise<number>;
}

/**
 * In-memory store for development and testing.
 * WARNING: All data is lost on process restart.
 */
export class InMemoryResourceTrackingStore implements ResourceTrackingStore {
  private readonly records = new Map<string, ResourceCallRecord>();

  create(record: ResourceCallRecord): void {
    this.records.set(record.id, record);
  }

  update(id: string, updates: Partial<ResourceCallRecord>): void {
    const existing = this.records.get(id);
    if (existing) {
      this.records.set(id, { ...existing, ...updates });
    }
  }

  get(id: string): ResourceCallRecord | undefined {
    return this.records.get(id);
  }

  list(options: ListOptions): ListResult {
    let records = Array.from(this.records.values());

    // Apply filters
    if (options.filters) {
      records = this.applyFilters(records, options.filters);
    }

    // Apply sorting
    if (options.sort) {
      records = this.applySort(records, options.sort);
    } else {
      // Default: newest first
      records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    const total = records.length;
    const offset = options.offset ?? 0;
    const limit = Math.min(options.limit ?? 50, 100);
    const page = records.slice(offset, offset + limit);

    return {
      records: page,
      total,
      hasMore: offset + page.length < total,
      nextCursor:
        offset + page.length < total ? String(offset + limit) : undefined,
    };
  }

  getStats(startTime: Date, endTime: Date): TrackingStats {
    const records = Array.from(this.records.values()).filter(
      (r) => r.timestamp >= startTime && r.timestamp <= endTime
    );

    if (records.length === 0) {
      return this.emptyStats(startTime, endTime);
    }

    const stats: TrackingStats = {
      period: { start: startTime, end: endTime },
      totalRequests: records.length,
      paymentRequiredRequests: records.filter((r) => r.paymentRequired).length,
      verifiedPayments: records.filter((r) => r.paymentVerified).length,
      successfulSettlements: records.filter((r) => r.settlement?.success)
        .length,
      failedSettlements: records.filter(
        (r) => r.settlement?.attempted && !r.settlement?.success
      ).length,
      totalVolumeByNetwork: {},
      totalVolumeByAsset: {},
      avgResponseTimeMs: 0,
      p95ResponseTimeMs: 0,
      requestsByPath: {},
      requestsByNetwork: {},
      requestsByScheme: {},
    };

    // Calculate averages and aggregations
    let totalResponseTime = 0;
    const responseTimes: number[] = [];

    for (const record of records) {
      totalResponseTime += record.responseTimeMs;
      responseTimes.push(record.responseTimeMs);

      // Count by path
      stats.requestsByPath[record.path] =
        (stats.requestsByPath[record.path] || 0) + 1;

      if (record.payment) {
        // Count by network
        stats.requestsByNetwork[record.payment.network] =
          (stats.requestsByNetwork[record.payment.network] || 0) + 1;

        // Count by scheme
        stats.requestsByScheme[record.payment.scheme] =
          (stats.requestsByScheme[record.payment.scheme] || 0) + 1;

        // Aggregate volume by network
        const networkVolume = BigInt(
          stats.totalVolumeByNetwork[record.payment.network] || "0"
        );
        stats.totalVolumeByNetwork[record.payment.network] = (
          networkVolume + BigInt(record.payment.amount)
        ).toString();

        // Aggregate volume by asset
        const assetKey = `${record.payment.network}:${record.payment.asset}`;
        const assetVolume = BigInt(stats.totalVolumeByAsset[assetKey] || "0");
        stats.totalVolumeByAsset[assetKey] = (
          assetVolume + BigInt(record.payment.amount)
        ).toString();
      }
    }

    stats.avgResponseTimeMs = totalResponseTime / records.length;

    // Calculate p95
    responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    stats.p95ResponseTimeMs = responseTimes[p95Index] || 0;

    return stats;
  }

  prune(olderThan: Date): number {
    let count = 0;
    for (const [id, record] of this.records) {
      if (record.timestamp < olderThan) {
        this.records.delete(id);
        count++;
      }
    }
    return count;
  }

  private applyFilters(
    records: ResourceCallRecord[],
    filters: ListFilters
  ): ResourceCallRecord[] {
    return records.filter((record) => {
      if (filters.path && record.path !== filters.path) return false;
      if (filters.method && record.method !== filters.method) return false;
      if (filters.network && record.payment?.network !== filters.network)
        return false;
      if (
        filters.networkType &&
        record.payment?.networkType !== filters.networkType
      )
        return false;
      if (filters.scheme && record.payment?.scheme !== filters.scheme)
        return false;
      if (
        filters.paymentRequired !== undefined &&
        record.paymentRequired !== filters.paymentRequired
      )
        return false;
      if (
        filters.paymentVerified !== undefined &&
        record.paymentVerified !== filters.paymentVerified
      )
        return false;
      if (
        filters.settlementSuccess !== undefined &&
        record.settlement?.success !== filters.settlementSuccess
      )
        return false;
      if (filters.startTime && record.timestamp < filters.startTime)
        return false;
      if (filters.endTime && record.timestamp > filters.endTime) return false;
      if (
        filters.minResponseTimeMs !== undefined &&
        record.responseTimeMs < filters.minResponseTimeMs
      )
        return false;
      if (
        filters.maxResponseTimeMs !== undefined &&
        record.responseTimeMs > filters.maxResponseTimeMs
      )
        return false;
      if (filters.payer && record.payment?.payer !== filters.payer)
        return false;

      return true;
    });
  }

  private applySort(
    records: ResourceCallRecord[],
    sort: ListSort
  ): ResourceCallRecord[] {
    const sorted = [...records];
    const multiplier = sort.direction === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sort.field) {
        case "timestamp":
          return (
            multiplier * (a.timestamp.getTime() - b.timestamp.getTime())
          );
        case "responseTimeMs":
          return multiplier * (a.responseTimeMs - b.responseTimeMs);
        case "path":
          return multiplier * a.path.localeCompare(b.path);
        default:
          return 0;
      }
    });

    return sorted;
  }

  private emptyStats(startTime: Date, endTime: Date): TrackingStats {
    return {
      period: { start: startTime, end: endTime },
      totalRequests: 0,
      paymentRequiredRequests: 0,
      verifiedPayments: 0,
      successfulSettlements: 0,
      failedSettlements: 0,
      totalVolumeByNetwork: {},
      totalVolumeByAsset: {},
      avgResponseTimeMs: 0,
      p95ResponseTimeMs: 0,
      requestsByPath: {},
      requestsByNetwork: {},
      requestsByScheme: {},
    };
  }
}

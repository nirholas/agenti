import type {
  UsageRecord,
  UsageStats,
  UsageTracker,
} from "./interface.js";

/**
 * In-memory usage tracker implementation
 * Logs requests for analytics and billing
 * WARNING: All data is lost on process restart
 */
export class InMemoryUsageTracker implements UsageTracker {
  private records = new Map<string, UsageRecord[]>();

  async track(record: UsageRecord): Promise<void> {
    const existing = this.records.get(record.tokenId) || [];
    existing.push(record);
    this.records.set(record.tokenId, existing);
  }

  async getStats(
    tokenId: string,
    period: { start: Date; end: Date },
  ): Promise<UsageStats> {
    const records = this.getRecordsInPeriod(tokenId, period);

    if (records.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalSettlementVolume: 0,
        totalGasCost: 0,
        avgResponseTimeMs: 0,
        requestsByEndpoint: {},
        requestsByNetwork: {},
      };
    }

    const stats: UsageStats = {
      totalRequests: records.length,
      successfulRequests: records.filter((r) => r.success).length,
      failedRequests: records.filter((r) => !r.success).length,
      totalSettlementVolume: records.reduce(
        (sum, r) => sum + (r.paymentAmount || 0),
        0,
      ),
      totalGasCost: records.reduce((sum, r) => sum + (r.gasUsed || 0), 0),
      avgResponseTimeMs:
        records.reduce((sum, r) => sum + r.responseTimeMs, 0) / records.length,
      requestsByEndpoint: {},
      requestsByNetwork: {},
    };

    // Group by endpoint
    for (const record of records) {
      stats.requestsByEndpoint[record.endpoint] =
        (stats.requestsByEndpoint[record.endpoint] || 0) + 1;

      if (record.paymentNetwork) {
        stats.requestsByNetwork[record.paymentNetwork] =
          (stats.requestsByNetwork[record.paymentNetwork] || 0) + 1;
      }
    }

    return stats;
  }

  async getRecentRequests(
    tokenId: string,
    limit: number = 100,
  ): Promise<UsageRecord[]> {
    const records = this.records.get(tokenId) || [];

    // Sort by timestamp descending (most recent first)
    const sorted = [...records].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    return sorted.slice(0, limit);
  }

  private getRecordsInPeriod(
    tokenId: string,
    period: { start: Date; end: Date },
  ): UsageRecord[] {
    const records = this.records.get(tokenId) || [];

    return records.filter((record) => {
      const time = record.timestamp.getTime();
      return time >= period.start.getTime() && time <= period.end.getTime();
    });
  }
}

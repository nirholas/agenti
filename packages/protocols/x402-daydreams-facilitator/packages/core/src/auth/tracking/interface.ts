/**
 * Usage record for a single request
 */
export interface UsageRecord {
  tokenId: string;
  endpoint: string; // /verify, /settle, etc.
  method: string; // GET, POST

  // Payment details (optional)
  paymentScheme?: "exact" | "upto";
  paymentNetwork?: "evm" | "svm" | "starknet";
  paymentAmount?: number; // In token units
  settlementHash?: string; // Blockchain tx hash
  gasUsed?: number;

  // Request context
  ipAddress?: string;
  userAgent?: string;

  // Response
  statusCode: number;
  success: boolean;
  errorMessage?: string;
  responseTimeMs: number;

  // Timestamp
  timestamp: Date;
}

/**
 * Aggregated usage statistics
 */
export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalSettlementVolume: number; // In USD/USDC
  totalGasCost: number;
  avgResponseTimeMs: number;
  requestsByEndpoint: Record<string, number>;
  requestsByNetwork: Record<string, number>;
}

/**
 * Usage tracker interface
 * Log requests for analytics and billing
 */
export interface UsageTracker {
  /**
   * Log a request
   */
  track(record: UsageRecord): Promise<void>;

  /**
   * Get usage statistics for a period
   */
  getStats(
    tokenId: string,
    period: { start: Date; end: Date },
  ): Promise<UsageStats>;

  /**
   * Get recent requests (for debugging)
   */
  getRecentRequests(tokenId: string, limit?: number): Promise<UsageRecord[]>;
}

/**
 * Payment Cache Service
 * 
 * LRU cache with TTL for payment status caching
 */

import { LRUCache } from 'lru-cache';
import type { CachedPayment, PaymentStatus } from '../types.js';
import { logger } from '../middleware/logger.js';

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum number of items in cache */
  maxSize: number;
  /** Time-to-live in milliseconds */
  ttlMs: number;
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 10000,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Payment Cache
 */
export class PaymentCache {
  private cache: LRUCache<string, CachedPayment>;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.cache = new LRUCache({
      max: this.config.maxSize,
      ttl: this.config.ttlMs,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    logger.info('PaymentCache initialized', {
      maxSize: this.config.maxSize,
      ttlMs: this.config.ttlMs,
    });
  }

  /**
   * Get payment from cache
   */
  get(txHash: string): CachedPayment | undefined {
    const payment = this.cache.get(txHash.toLowerCase());
    if (payment) {
      logger.debug('Cache hit', { txHash });
    }
    return payment;
  }

  /**
   * Set payment in cache
   */
  set(txHash: string, payment: Omit<CachedPayment, 'ttl'>): void {
    const cacheEntry: CachedPayment = {
      ...payment,
      ttl: Date.now() + this.config.ttlMs,
    };
    this.cache.set(txHash.toLowerCase(), cacheEntry);
    logger.debug('Cache set', { txHash, verified: payment.verified });
  }

  /**
   * Check if payment exists in cache
   */
  has(txHash: string): boolean {
    return this.cache.has(txHash.toLowerCase());
  }

  /**
   * Delete payment from cache
   */
  delete(txHash: string): boolean {
    return this.cache.delete(txHash.toLowerCase());
  }

  /**
   * Clear all cached payments
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttlMs: this.config.ttlMs,
    };
  }

  /**
   * Get all cached payments (for debugging)
   */
  getAll(): CachedPayment[] {
    const payments: CachedPayment[] = [];
    for (const [, value] of this.cache.entries()) {
      payments.push(value);
    }
    return payments;
  }

  /**
   * Convert cached payment to status response
   */
  toStatus(cached: CachedPayment): PaymentStatus {
    return {
      txHash: cached.txHash,
      verified: cached.verified,
      settled: cached.settled,
      amount: cached.amount,
      token: cached.token,
      from: cached.from,
      to: cached.to,
      timestamp: cached.timestamp,
      blockNumber: cached.blockNumber,
    };
  }

  /**
   * Mark payment as verified
   */
  markVerified(txHash: string, blockNumber?: number): void {
    const existing = this.get(txHash);
    if (existing) {
      this.set(txHash, {
        ...existing,
        verified: true,
        blockNumber,
      });
    }
  }

  /**
   * Mark payment as settled
   */
  markSettled(txHash: string): void {
    const existing = this.get(txHash);
    if (existing) {
      this.set(txHash, {
        ...existing,
        settled: true,
      });
    }
  }
}

/**
 * Create PaymentCache instance
 */
export function createPaymentCache(config: Partial<CacheConfig> = {}): PaymentCache {
  return new PaymentCache(config);
}

// Singleton instance
let cacheInstance: PaymentCache | null = null;

/**
 * Get shared cache instance
 */
export function getPaymentCache(config?: Partial<CacheConfig>): PaymentCache {
  if (!cacheInstance) {
    cacheInstance = createPaymentCache(config);
  }
  return cacheInstance;
}

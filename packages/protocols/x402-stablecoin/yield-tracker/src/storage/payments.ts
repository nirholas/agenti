/**
 * Payment History Storage (In-Memory)
 * 
 * In-memory storage for tracked payments and yield history.
 * For production, replace with a persistent database.
 */

import type { 
  TrackedPayment, 
  YieldHistoryPoint, 
  RebaseEvent 
} from '../types.js';

/**
 * Payment Storage using In-Memory Maps
 */
export class PaymentStorage {
  private payments: Map<string, TrackedPayment> = new Map();
  private paymentsByAddress: Map<string, string[]> = new Map();
  private yieldHistory: Map<string, YieldHistoryPoint[]> = new Map();
  private rebaseEvents: RebaseEvent[] = [];
  private globalState: Map<string, { value: string; updatedAt: number }> = new Map();

  constructor(_dbPath?: string) {
    // dbPath ignored for in-memory storage
  }

  /**
   * Add a tracked payment
   */
  addPayment(payment: TrackedPayment): void {
    const address = payment.address.toLowerCase();
    this.payments.set(payment.id, payment);
    
    const addressPayments = this.paymentsByAddress.get(address) || [];
    addressPayments.push(payment.id);
    this.paymentsByAddress.set(address, addressPayments);
  }

  /**
   * Get payment by ID
   */
  getPayment(id: string): TrackedPayment | null {
    return this.payments.get(id) || null;
  }

  /**
   * Get all payments for an address
   */
  getPaymentsByAddress(address: string): TrackedPayment[] {
    const ids = this.paymentsByAddress.get(address.toLowerCase()) || [];
    return ids
      .map(id => this.payments.get(id))
      .filter((p): p is TrackedPayment => p !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get all tracked addresses
   */
  getTrackedAddresses(): string[] {
    return Array.from(this.paymentsByAddress.keys());
  }

  /**
   * Add yield history point
   */
  addYieldHistory(point: YieldHistoryPoint & { address: string }): void {
    const address = point.address.toLowerCase();
    const history = this.yieldHistory.get(address) || [];
    history.push({
      timestamp: point.timestamp,
      balance: point.balance,
      creditsPerToken: point.creditsPerToken,
      cumulativeYield: point.cumulativeYield,
      blockNumber: point.blockNumber,
    });
    this.yieldHistory.set(address, history);
  }

  /**
   * Get yield history for an address
   */
  getYieldHistory(address: string, limit: number = 100): YieldHistoryPoint[] {
    const history = this.yieldHistory.get(address.toLowerCase()) || [];
    return history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Add rebase event
   */
  addRebaseEvent(event: RebaseEvent): void {
    // Check if already exists
    const exists = this.rebaseEvents.some(e => e.blockNumber === event.blockNumber);
    if (!exists) {
      this.rebaseEvents.push(event);
      this.rebaseEvents.sort((a, b) => b.blockNumber - a.blockNumber);
    }
  }

  /**
   * Get latest rebase event
   */
  getLatestRebaseEvent(): RebaseEvent | null {
    return this.rebaseEvents[0] || null;
  }

  /**
   * Get rebase events in time range
   */
  getRebaseEvents(fromTimestamp: number, toTimestamp?: number, limit: number = 100): RebaseEvent[] {
    const to = toTimestamp || Math.floor(Date.now() / 1000);
    return this.rebaseEvents
      .filter(e => e.timestamp >= fromTimestamp && e.timestamp <= to)
      .slice(0, limit);
  }

  /**
   * Get rebase count
   */
  getRebaseCount(): number {
    return this.rebaseEvents.length;
  }

  /**
   * Set global state value
   */
  setGlobalState(key: string, value: string): void {
    this.globalState.set(key, {
      value,
      updatedAt: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Get global state value
   */
  getGlobalState(key: string): string | null {
    const state = this.globalState.get(key);
    return state ? state.value : null;
  }

  /**
   * Get sum of initial amounts for an address
   */
  getTotalInitialDeposits(address: string): string {
    const payments = this.getPaymentsByAddress(address);
    
    let total = 0n;
    for (const payment of payments) {
      if (!payment.isRebasing) continue;
      try {
        const amount = payment.initialAmount.includes('.')
          ? BigInt(Math.floor(parseFloat(payment.initialAmount) * 10 ** 18))
          : BigInt(payment.initialAmount);
        total += amount;
      } catch {
        // Skip invalid amounts
      }
    }
    
    return total.toString();
  }

  /**
   * Close storage (no-op for in-memory)
   */
  close(): void {
    // No-op for in-memory storage
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.payments.clear();
    this.paymentsByAddress.clear();
    this.yieldHistory.clear();
    this.rebaseEvents = [];
    this.globalState.clear();
  }
}

/**
 * Create payment storage instance
 */
export function createPaymentStorage(dbPath?: string): PaymentStorage {
  return new PaymentStorage(dbPath);
}

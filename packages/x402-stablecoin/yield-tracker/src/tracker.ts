/**
 * Core Yield Tracking Logic
 * 
 * Main orchestrator for tracking USDs payments and calculating yield.
 * Coordinates the USDs contract, rebase monitor, yield calculator, and storage.
 */

import { randomUUID } from 'crypto';
import { parseUnits, type Address } from 'viem';
import { createUSdsContract, type USdsContract } from './contracts/usds.js';
import { createPaymentStorage, type PaymentStorage } from './storage/payments.js';
import { createRebaseMonitor, type RebaseMonitor } from './services/rebase-monitor.js';
import { createYieldCalculator, type YieldCalculator } from './services/yield-calculator.js';
import type {
  TrackedPayment,
  YieldInfo,
  YieldHistory,
  APYInfo,
  RebaseEvent,
  TrackPaymentRequest,
  YieldTrackerConfig,
} from './types.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: YieldTrackerConfig = {
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  port: 3003,
  dbPath: './yield-tracker.db',
  pollInterval: 60000, // 1 minute
  network: 'mainnet',
};

/**
 * USDs Yield Tracker
 * 
 * Main class for tracking USDs payments and calculating yield.
 */
export class YieldTracker {
  private config: YieldTrackerConfig;
  private usdsContract: USdsContract;
  private storage: PaymentStorage;
  private rebaseMonitor: RebaseMonitor;
  private yieldCalculator: YieldCalculator;
  private isRunning: boolean = false;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<YieldTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize components
    this.usdsContract = createUSdsContract(this.config.rpcUrl, this.config.network);
    this.storage = createPaymentStorage(this.config.dbPath);
    this.rebaseMonitor = createRebaseMonitor(this.usdsContract, this.storage, {
      pollInterval: this.config.pollInterval,
    });
    this.yieldCalculator = createYieldCalculator(this.usdsContract, this.storage);
  }

  /**
   * Start the yield tracker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[YieldTracker] Already running');
      return;
    }

    console.log('[YieldTracker] Starting yield tracker...');
    this.isRunning = true;

    // Start rebase monitoring
    await this.rebaseMonitor.start();

    // Register rebase callback to update snapshots
    this.rebaseMonitor.onRebase(async (event) => {
      console.log(`[YieldTracker] Rebase detected: ${event.rebasePercentage}% yield`);
      await this.updateAllSnapshots();
    });

    // Start periodic snapshots (every 6 hours)
    this.snapshotTimer = setInterval(async () => {
      await this.updateAllSnapshots();
    }, 6 * 60 * 60 * 1000);

    console.log('[YieldTracker] Started successfully');
  }

  /**
   * Stop the yield tracker
   */
  stop(): void {
    console.log('[YieldTracker] Stopping...');
    this.isRunning = false;

    this.rebaseMonitor.stop();

    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }

    console.log('[YieldTracker] Stopped');
  }

  /**
   * Track a new payment
   */
  async trackPayment(request: TrackPaymentRequest): Promise<TrackedPayment> {
    const address = request.address.toLowerCase() as Address;
    
    console.log(`[YieldTracker] Tracking payment for ${address}`);

    // Get current credits info
    const creditBalance = await this.usdsContract.getCreditBalance(address);
    const currentCreditsPerToken = await this.usdsContract.getCreditsPerToken();
    const isRebasing = !(await this.usdsContract.isNonRebasingAccount(address));
    const blockNumber = await this.usdsContract.getBlockNumber();
    const timestamp = await this.usdsContract.getBlockTimestamp();

    // Create payment record
    const payment: TrackedPayment = {
      id: randomUUID(),
      address,
      initialAmount: request.amount,
      initialCredits: creditBalance.credits,
      initialCreditsPerToken: currentCreditsPerToken,
      txHash: request.txHash,
      blockNumber: Number(blockNumber),
      timestamp,
      description: request.description,
      isRebasing,
    };

    // Store payment
    this.storage.addPayment(payment);

    // Record initial snapshot
    await this.yieldCalculator.recordYieldSnapshot(address);

    console.log(`[YieldTracker] Payment tracked: ${payment.id}`);

    return payment;
  }

  /**
   * Get yield info for an address
   */
  async getYieldInfo(address: Address): Promise<YieldInfo> {
    return this.yieldCalculator.getYieldInfo(address);
  }

  /**
   * Get yield history for an address
   */
  async getYieldHistory(address: Address, limit: number = 100): Promise<YieldHistory> {
    const history = this.storage.getYieldHistory(address, limit);
    const payments = this.storage.getPaymentsByAddress(address);

    // Calculate total yield
    const currentCreditsPerToken = await this.usdsContract.getCreditsPerToken();
    let totalYield = 0n;

    for (const payment of payments) {
      const yieldCalc = this.usdsContract.calculateYieldFromCreditsChange(
        payment.initialCredits,
        payment.initialCreditsPerToken,
        currentCreditsPerToken
      );
      if (yieldCalc.yield !== '0') {
        totalYield += parseUnits(yieldCalc.yield, 18);
      }
    }

    return {
      address,
      history,
      totalYieldEarned: (Number(totalYield) / 10 ** 18).toFixed(6),
      firstTracked: payments.length > 0 
        ? Math.min(...payments.map(p => p.timestamp))
        : 0,
      lastTracked: history.length > 0 
        ? history[0].timestamp 
        : Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Get current APY info
   */
  async getAPYInfo(): Promise<APYInfo> {
    return this.yieldCalculator.getAPYInfo();
  }

  /**
   * Get latest rebase event
   */
  getLatestRebase(): RebaseEvent | null {
    return this.storage.getLatestRebaseEvent();
  }

  /**
   * Get rebase events in time range
   */
  getRebaseEvents(fromTimestamp: number, toTimestamp?: number): RebaseEvent[] {
    return this.storage.getRebaseEvents(fromTimestamp, toTimestamp);
  }

  /**
   * Get all tracked payments for an address
   */
  getPayments(address: Address): TrackedPayment[] {
    return this.storage.getPaymentsByAddress(address);
  }

  /**
   * Get payment by ID
   */
  getPayment(id: string): TrackedPayment | null {
    return this.storage.getPayment(id);
  }

  /**
   * Get current USDs contract state
   */
  async getContractState() {
    return this.usdsContract.getContractState();
  }

  /**
   * Estimate future yield
   */
  async estimateFutureYield(currentBalance: string, days: number) {
    return this.yieldCalculator.estimateFutureYield(currentBalance, days);
  }

  /**
   * Get tracker status
   */
  getStatus(): {
    isRunning: boolean;
    network: string;
    trackedAddresses: number;
    rebaseMonitor: ReturnType<RebaseMonitor['getStatus']>;
  } {
    return {
      isRunning: this.isRunning,
      network: this.config.network,
      trackedAddresses: this.storage.getTrackedAddresses().length,
      rebaseMonitor: this.rebaseMonitor.getStatus(),
    };
  }

  /**
   * Update yield snapshots for all tracked addresses
   */
  private async updateAllSnapshots(): Promise<void> {
    const addresses = this.storage.getTrackedAddresses();
    console.log(`[YieldTracker] Updating snapshots for ${addresses.length} addresses`);

    for (const address of addresses) {
      try {
        await this.yieldCalculator.recordYieldSnapshot(address as Address);
      } catch (error) {
        console.error(`[YieldTracker] Failed to update snapshot for ${address}:`, error);
      }
    }
  }

  /**
   * Get underlying components for advanced usage
   */
  getComponents() {
    return {
      usdsContract: this.usdsContract,
      storage: this.storage,
      rebaseMonitor: this.rebaseMonitor,
      yieldCalculator: this.yieldCalculator,
    };
  }

  /**
   * Close and cleanup
   */
  close(): void {
    this.stop();
    this.storage.close();
  }
}

/**
 * Create yield tracker instance
 */
export function createYieldTracker(config?: Partial<YieldTrackerConfig>): YieldTracker {
  return new YieldTracker(config);
}

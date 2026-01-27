/**
 * Rebase Monitor Service
 * 
 * Monitors USDs rebase events to track when yield is distributed.
 * USDs rebases approximately every 24 hours when yield exceeds 3%.
 */

import type { RebaseEvent } from '../types.js';
import type { USdsContract } from '../contracts/usds.js';
import type { PaymentStorage } from '../storage/payments.js';

/**
 * Rebase Monitor Configuration
 */
export interface RebaseMonitorConfig {
  /** Polling interval in milliseconds (default: 60000 = 1 minute) */
  pollInterval: number;
  /** Number of blocks to look back for initial sync */
  lookbackBlocks: number;
}

/**
 * Rebase Monitor Service
 */
export class RebaseMonitor {
  private usdsContract: USdsContract;
  private storage: PaymentStorage;
  private config: RebaseMonitorConfig;
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastCreditsPerToken: string | null = null;
  private unwatch: (() => void) | null = null;
  private onRebaseCallbacks: ((event: RebaseEvent) => void)[] = [];

  constructor(
    usdsContract: USdsContract,
    storage: PaymentStorage,
    config: Partial<RebaseMonitorConfig> = {}
  ) {
    this.usdsContract = usdsContract;
    this.storage = storage;
    this.config = {
      pollInterval: config.pollInterval || 60000, // 1 minute
      lookbackBlocks: config.lookbackBlocks || 50000, // ~1 day on Arbitrum
    };
  }

  /**
   * Start monitoring rebase events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[RebaseMonitor] Already running');
      return;
    }

    console.log('[RebaseMonitor] Starting rebase monitoring...');
    this.isRunning = true;

    // Get initial credits per token
    this.lastCreditsPerToken = await this.usdsContract.getCreditsPerToken();
    this.storage.setGlobalState('lastCreditsPerToken', this.lastCreditsPerToken);

    // Try to sync historical events
    await this.syncHistoricalEvents();

    // Start watching for new events
    this.startEventWatcher();

    // Start polling as backup
    this.startPolling();

    console.log('[RebaseMonitor] Monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    console.log('[RebaseMonitor] Stopping...');
    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.unwatch) {
      this.unwatch();
      this.unwatch = null;
    }

    console.log('[RebaseMonitor] Stopped');
  }

  /**
   * Register callback for rebase events
   */
  onRebase(callback: (event: RebaseEvent) => void): void {
    this.onRebaseCallbacks.push(callback);
  }

  /**
   * Sync historical rebase events
   */
  private async syncHistoricalEvents(): Promise<void> {
    try {
      const currentBlock = await this.usdsContract.getBlockNumber();
      const fromBlock = currentBlock - BigInt(this.config.lookbackBlocks);

      console.log(`[RebaseMonitor] Syncing events from block ${fromBlock} to ${currentBlock}`);

      const events = await this.usdsContract.getPastRebaseEvents(fromBlock, currentBlock);
      console.log(`[RebaseMonitor] Found ${events.length} historical rebase events`);

      let prevCPT: string | null = null;

      for (const event of events) {
        const timestamp = await this.usdsContract.getBlockTimestamp(event.blockNumber);
        
        const rebaseEvent = await this.createRebaseEvent(
          event.blockNumber,
          event.transactionHash,
          timestamp,
          prevCPT || event.rebasingCreditsPerToken.toString(),
          event.rebasingCreditsPerToken.toString()
        );

        this.storage.addRebaseEvent(rebaseEvent);
        prevCPT = event.rebasingCreditsPerToken.toString();
      }

      if (events.length > 0) {
        this.lastCreditsPerToken = events[events.length - 1].rebasingCreditsPerToken.toString();
      }
    } catch (error) {
      console.error('[RebaseMonitor] Error syncing historical events:', error);
    }
  }

  /**
   * Start event watcher using websocket/polling
   */
  private startEventWatcher(): void {
    try {
      this.unwatch = this.usdsContract.watchRebaseEvents(async (log) => {
        console.log(`[RebaseMonitor] New rebase event at block ${log.blockNumber}`);

        const timestamp = await this.usdsContract.getBlockTimestamp(log.blockNumber);
        
        const rebaseEvent = await this.createRebaseEvent(
          log.blockNumber,
          log.transactionHash,
          timestamp,
          this.lastCreditsPerToken || log.rebasingCreditsPerToken.toString(),
          log.rebasingCreditsPerToken.toString()
        );

        this.storage.addRebaseEvent(rebaseEvent);
        this.lastCreditsPerToken = log.rebasingCreditsPerToken.toString();
        this.storage.setGlobalState('lastCreditsPerToken', this.lastCreditsPerToken);

        // Notify callbacks
        for (const callback of this.onRebaseCallbacks) {
          try {
            callback(rebaseEvent);
          } catch (err) {
            console.error('[RebaseMonitor] Callback error:', err);
          }
        }
      });
    } catch (error) {
      console.error('[RebaseMonitor] Failed to start event watcher:', error);
    }
  }

  /**
   * Start polling for credits per token changes
   */
  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentCPT = await this.usdsContract.getCreditsPerToken();
        
        if (this.lastCreditsPerToken && currentCPT !== this.lastCreditsPerToken) {
          console.log('[RebaseMonitor] Detected credits per token change via polling');
          
          const blockNumber = await this.usdsContract.getBlockNumber();
          const timestamp = await this.usdsContract.getBlockTimestamp();

          const rebaseEvent = await this.createRebaseEvent(
            blockNumber,
            'polling-detected',
            timestamp,
            this.lastCreditsPerToken,
            currentCPT
          );

          // Only add if not already tracked
          const existing = this.storage.getLatestRebaseEvent();
          if (!existing || existing.newCreditsPerToken !== currentCPT) {
            this.storage.addRebaseEvent(rebaseEvent);
            
            // Notify callbacks
            for (const callback of this.onRebaseCallbacks) {
              try {
                callback(rebaseEvent);
              } catch (err) {
                console.error('[RebaseMonitor] Callback error:', err);
              }
            }
          }

          this.lastCreditsPerToken = currentCPT;
          this.storage.setGlobalState('lastCreditsPerToken', currentCPT);
        }
      } catch (error) {
        console.error('[RebaseMonitor] Polling error:', error);
      }
    }, this.config.pollInterval);
  }

  /**
   * Create a RebaseEvent from raw data
   */
  private async createRebaseEvent(
    blockNumber: bigint,
    txHash: string,
    timestamp: number,
    previousCPT: string,
    newCPT: string
  ): Promise<RebaseEvent> {
    const prevCPT = BigInt(previousCPT);
    const currCPT = BigInt(newCPT);

    // Calculate rebase percentage
    // When CPT decreases, balances increase
    // rebasePercentage = (prevCPT - currCPT) / currCPT * 100
    let rebasePercentage = '0';
    let estimatedAPY = '0';

    if (currCPT > 0n && prevCPT > currCPT) {
      const change = ((prevCPT - currCPT) * 10000n) / currCPT; // basis points
      rebasePercentage = (Number(change) / 100).toFixed(6);

      // Estimate APY assuming daily rebases
      // APY = (1 + dailyRate)^365 - 1
      const dailyRate = Number(change) / 1000000; // convert from basis points
      const apy = (Math.pow(1 + dailyRate, 365) - 1) * 100;
      estimatedAPY = apy.toFixed(2);
    }

    return {
      blockNumber: Number(blockNumber),
      txHash,
      timestamp,
      previousCreditsPerToken: previousCPT,
      newCreditsPerToken: newCPT,
      rebasePercentage,
      estimatedAPY,
    };
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    lastCreditsPerToken: string | null;
    lastRebase: RebaseEvent | null;
    totalRebases: number;
  } {
    return {
      isRunning: this.isRunning,
      lastCreditsPerToken: this.lastCreditsPerToken,
      lastRebase: this.storage.getLatestRebaseEvent(),
      totalRebases: this.storage.getRebaseCount(),
    };
  }
}

/**
 * Create rebase monitor instance
 */
export function createRebaseMonitor(
  usdsContract: USdsContract,
  storage: PaymentStorage,
  config?: Partial<RebaseMonitorConfig>
): RebaseMonitor {
  return new RebaseMonitor(usdsContract, storage, config);
}

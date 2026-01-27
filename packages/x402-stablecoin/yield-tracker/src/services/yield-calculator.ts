/**
 * Yield Calculator Service
 * 
 * Calculates APY and earnings from USDs auto-yield mechanism.
 * 
 * USDs Yield Mechanics:
 * - USDs uses creditsPerToken to track yield
 * - When yield is distributed, creditsPerToken DECREASES
 * - This causes balances to INCREASE (balance = credits / creditsPerToken)
 * - Yield is distributed approximately every 24 hours
 */

import type { APYInfo, YieldInfo, RebaseEvent, TrackedPayment } from '../types.js';
import type { USdsContract } from '../contracts/usds.js';
import type { PaymentStorage } from '../storage/payments.js';
import { formatUnits, parseUnits, type Address } from 'viem';

/**
 * Time constants
 */
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_WEEK = 604800;
const SECONDS_PER_MONTH = 2592000; // 30 days
const SECONDS_PER_YEAR = 31536000;

/**
 * Yield Calculator Service
 */
export class YieldCalculator {
  private usdsContract: USdsContract;
  private storage: PaymentStorage;

  constructor(usdsContract: USdsContract, storage: PaymentStorage) {
    this.usdsContract = usdsContract;
    this.storage = storage;
  }

  /**
   * Get yield info for an address
   */
  async getYieldInfo(address: Address): Promise<YieldInfo> {
    // Get current balance and credits
    const currentBalance = await this.usdsContract.getBalance(address);
    const isRebasing = !(await this.usdsContract.isNonRebasingAccount(address));
    const currentCreditsPerToken = await this.usdsContract.getCreditsPerToken();

    // Get all tracked payments for this address
    const payments = this.storage.getPaymentsByAddress(address);
    const paymentCount = payments.length;

    // Calculate total initial deposits and yield
    let totalInitialWei = 0n;
    let totalYieldWei = 0n;

    for (const payment of payments) {
      if (!payment.isRebasing) continue;

      // Parse initial amount
      const initialAmount = payment.initialAmount.includes('.')
        ? parseUnits(payment.initialAmount, 18)
        : BigInt(payment.initialAmount);
      
      totalInitialWei += initialAmount;

      // Calculate yield for this payment based on credits change
      const yieldCalc = this.usdsContract.calculateYieldFromCreditsChange(
        payment.initialCredits,
        payment.initialCreditsPerToken,
        currentCreditsPerToken
      );

      if (yieldCalc.yield !== '0') {
        totalYieldWei += parseUnits(yieldCalc.yield, 18);
      }
    }

    // Calculate yield percentage
    let yieldPercentage = '0';
    if (totalInitialWei > 0n) {
      const percentage = (totalYieldWei * 10000n) / totalInitialWei;
      yieldPercentage = (Number(percentage) / 100).toFixed(4);
    }

    // Get current APY
    const apyInfo = await this.getAPYInfo();

    return {
      address,
      currentBalance,
      totalInitialDeposits: formatUnits(totalInitialWei, 18),
      totalYieldEarned: formatUnits(totalYieldWei, 18),
      yieldPercentage,
      currentAPY: apyInfo.currentAPY,
      paymentCount,
      isRebasing,
      lastUpdated: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Calculate current APY from recent rebase events
   */
  async getAPYInfo(): Promise<APYInfo> {
    const currentCreditsPerToken = await this.usdsContract.getCreditsPerToken();
    const latestRebase = this.storage.getLatestRebaseEvent();
    const totalRebases = this.storage.getRebaseCount();

    // Get events for different time periods
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - SECONDS_PER_WEEK;
    const monthAgo = now - SECONDS_PER_MONTH;

    const weeklyEvents = this.storage.getRebaseEvents(weekAgo, now);
    const monthlyEvents = this.storage.getRebaseEvents(monthAgo, now);

    // Calculate APY from events
    const currentAPY = this.calculateAPYFromEvents(weeklyEvents, 7);
    const weeklyAverageAPY = this.calculateAPYFromEvents(weeklyEvents, 7);
    const monthlyAverageAPY = this.calculateAPYFromEvents(monthlyEvents, 30);

    return {
      currentAPY: `${currentAPY.toFixed(2)}%`,
      weeklyAverageAPY: `${weeklyAverageAPY.toFixed(2)}%`,
      monthlyAverageAPY: `${monthlyAverageAPY.toFixed(2)}%`,
      currentCreditsPerToken,
      lastRebaseTimestamp: latestRebase?.timestamp || 0,
      totalRebasesTracked: totalRebases,
    };
  }

  /**
   * Calculate APY from rebase events
   */
  private calculateAPYFromEvents(events: RebaseEvent[], days: number): number {
    if (events.length === 0) {
      // Return default Sperax APY estimate
      return 8.5;
    }

    // Sum up all rebase percentages
    let totalRebasePercent = 0;
    for (const event of events) {
      totalRebasePercent += parseFloat(event.rebasePercentage) || 0;
    }

    // Convert to annual rate
    // Daily rate = total / days
    // APY = (1 + dailyRate)^365 - 1
    const dailyRate = totalRebasePercent / 100 / days;
    const apy = (Math.pow(1 + dailyRate, 365) - 1) * 100;

    return Math.max(0, apy);
  }

  /**
   * Calculate yield earned between two timestamps
   */
  async calculateYieldBetween(
    address: Address,
    fromTimestamp: number,
    toTimestamp: number
  ): Promise<{
    yieldEarned: string;
    startBalance: string;
    endBalance: string;
    rebaseEvents: number;
  }> {
    // Get rebase events in range
    const events = this.storage.getRebaseEvents(fromTimestamp, toTimestamp);
    
    // Get yield history for address
    const history = this.storage.getYieldHistory(address);
    
    // Find balances at start and end
    const startPoint = history.find(h => h.timestamp <= fromTimestamp);
    const endPoint = history.find(h => h.timestamp <= toTimestamp);

    const startBalance = startPoint?.balance || '0';
    const endBalance = endPoint?.balance || await this.usdsContract.getBalance(address);

    // Calculate yield
    const startWei = parseUnits(startBalance, 18);
    const endWei = parseUnits(endBalance, 18);
    const yieldWei = endWei > startWei ? endWei - startWei : 0n;

    return {
      yieldEarned: formatUnits(yieldWei, 18),
      startBalance,
      endBalance,
      rebaseEvents: events.length,
    };
  }

  /**
   * Estimate future yield
   */
  async estimateFutureYield(
    currentBalance: string,
    days: number
  ): Promise<{
    estimatedYield: string;
    estimatedBalance: string;
    estimatedAPY: string;
  }> {
    const apyInfo = await this.getAPYInfo();
    const apyPercent = parseFloat(apyInfo.currentAPY) || 8.5;
    
    // Daily rate from APY
    // APY = (1 + dailyRate)^365 - 1
    // dailyRate = (1 + APY)^(1/365) - 1
    const dailyRate = Math.pow(1 + apyPercent / 100, 1 / 365) - 1;
    
    // Calculate compound growth
    const balanceNum = parseFloat(currentBalance);
    const futureBalance = balanceNum * Math.pow(1 + dailyRate, days);
    const yieldAmount = futureBalance - balanceNum;

    return {
      estimatedYield: yieldAmount.toFixed(6),
      estimatedBalance: futureBalance.toFixed(6),
      estimatedAPY: apyInfo.currentAPY,
    };
  }

  /**
   * Calculate yield for a specific payment
   */
  async calculatePaymentYield(payment: TrackedPayment): Promise<{
    originalAmount: string;
    currentValue: string;
    yieldEarned: string;
    yieldPercentage: string;
    daysHeld: number;
    effectiveAPY: string;
  }> {
    const currentCreditsPerToken = await this.usdsContract.getCreditsPerToken();
    
    // Calculate current value from credits
    const yieldCalc = this.usdsContract.calculateYieldFromCreditsChange(
      payment.initialCredits,
      payment.initialCreditsPerToken,
      currentCreditsPerToken
    );

    // Parse original amount
    const originalAmount = payment.initialAmount.includes('.')
      ? payment.initialAmount
      : formatUnits(BigInt(payment.initialAmount), 18);

    // Calculate days held
    const now = Math.floor(Date.now() / 1000);
    const daysHeld = Math.max(1, (now - payment.timestamp) / SECONDS_PER_DAY);

    // Calculate effective APY
    const yieldPercent = parseFloat(yieldCalc.yieldPercentage) || 0;
    const dailyRate = yieldPercent / 100 / daysHeld;
    const effectiveAPY = (Math.pow(1 + dailyRate, 365) - 1) * 100;

    return {
      originalAmount,
      currentValue: yieldCalc.currentBalance,
      yieldEarned: yieldCalc.yield,
      yieldPercentage: yieldCalc.yieldPercentage,
      daysHeld: Math.floor(daysHeld),
      effectiveAPY: `${effectiveAPY.toFixed(2)}%`,
    };
  }

  /**
   * Record current yield snapshot for an address
   */
  async recordYieldSnapshot(address: Address): Promise<void> {
    const balance = await this.usdsContract.getBalance(address);
    const creditsPerToken = await this.usdsContract.getCreditsPerToken();
    const blockNumber = await this.usdsContract.getBlockNumber();
    const timestamp = await this.usdsContract.getBlockTimestamp();

    // Get payments to calculate cumulative yield
    const payments = this.storage.getPaymentsByAddress(address);
    let cumulativeYield = 0n;

    for (const payment of payments) {
      if (!payment.isRebasing) continue;
      
      const yieldCalc = this.usdsContract.calculateYieldFromCreditsChange(
        payment.initialCredits,
        payment.initialCreditsPerToken,
        creditsPerToken
      );

      if (yieldCalc.yield !== '0') {
        cumulativeYield += parseUnits(yieldCalc.yield, 18);
      }
    }

    this.storage.addYieldHistory({
      address,
      timestamp,
      balance,
      creditsPerToken,
      cumulativeYield: formatUnits(cumulativeYield, 18),
      blockNumber: Number(blockNumber),
    });
  }
}

/**
 * Create yield calculator instance
 */
export function createYieldCalculator(
  usdsContract: USdsContract,
  storage: PaymentStorage
): YieldCalculator {
  return new YieldCalculator(usdsContract, storage);
}

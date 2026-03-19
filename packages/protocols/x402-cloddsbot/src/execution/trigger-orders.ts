/**
 * Sniper / Trigger Orders - Execute when price or condition thresholds are met
 *
 * Features:
 * - Monitor real-time price feeds for trigger conditions
 * - Condition types: price_above, price_below, price_cross, spread_below
 * - Executes via ExecutionService when triggered
 * - Supports expiry and one-shot triggers
 * - Cancellable individual triggers
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '../utils/logger';
import type { ExecutionService, OrderResult, OrderType } from './index';
import type { PriceUpdate } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export type TriggerCondition =
  | { type: 'price_above'; price: number }
  | { type: 'price_below'; price: number }
  | { type: 'price_cross'; price: number; direction: 'up' | 'down' }
  | { type: 'spread_below'; maxSpread: number };

export interface TriggerOrderConfig {
  /** Platform */
  platform: 'polymarket' | 'kalshi';
  /** Market to monitor */
  marketId: string;
  /** Token ID (Polymarket) */
  tokenId?: string;
  /** Outcome (Kalshi) */
  outcome?: string;
  /** Condition that triggers execution */
  condition: TriggerCondition;
  /** Order to execute when triggered */
  order: {
    side: 'buy' | 'sell';
    size: number;
    /** If omitted, executes as market order (FOK) */
    price?: number;
    orderType?: OrderType;
  };
  /** NegRisk flag for Polymarket */
  negRisk?: boolean;
  /** Expiry time for the trigger (optional) */
  expiresAt?: Date;
  /** Only trigger once (default: true) */
  oneShot?: boolean;
}

export interface TriggerInfo {
  id: string;
  config: TriggerOrderConfig;
  status: 'active' | 'triggered' | 'expired' | 'cancelled';
  createdAt: Date;
  triggeredAt?: Date;
  orderResult?: OrderResult;
}

export interface TriggerOrderManager extends EventEmitter {
  /** Add a trigger order, returns trigger ID */
  addTrigger(config: TriggerOrderConfig): string;
  /** Cancel a trigger */
  cancelTrigger(triggerId: string): void;
  /** Get all triggers */
  getTriggers(): TriggerInfo[];
  /** Get a specific trigger */
  getTrigger(triggerId: string): TriggerInfo | undefined;
  /** Start monitoring */
  start(): void;
  /** Stop monitoring */
  stop(): void;
}

// =============================================================================
// TYPES (internal)
// =============================================================================

/** Feed manager must provide subscribePrice */
interface FeedManager {
  subscribePrice: (
    platform: string,
    marketId: string,
    callback: (update: PriceUpdate) => void
  ) => () => void;
}

interface TriggerState {
  info: TriggerInfo;
  previousPrice?: number;
  unsubscribe?: () => void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

let nextTriggerId = 1;

export function createTriggerOrderManager(
  executionService: ExecutionService,
  feedManager: FeedManager
): TriggerOrderManager {
  const emitter = new EventEmitter() as TriggerOrderManager;

  const triggers = new Map<string, TriggerState>();
  let expiryTimer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  /**
   * Generate unique trigger ID
   */
  function generateId(): string {
    return `trigger_${nextTriggerId++}_${Date.now()}`;
  }

  /**
   * Evaluate a trigger condition against the current price
   */
  function evaluateCondition(
    condition: TriggerCondition,
    currentPrice: number,
    previousPrice: number | undefined
  ): boolean {
    switch (condition.type) {
      case 'price_above':
        return currentPrice >= condition.price;

      case 'price_below':
        return currentPrice <= condition.price;

      case 'price_cross': {
        if (previousPrice === undefined) return false;

        if (condition.direction === 'up') {
          return previousPrice < condition.price && currentPrice >= condition.price;
        } else {
          return previousPrice > condition.price && currentPrice <= condition.price;
        }
      }

      case 'spread_below': {
        // Approximate spread from price movement — if price is stable near mid,
        // spread is likely tight. Use price volatility as a proxy.
        if (previousPrice === undefined) return false;
        const priceSpread = Math.abs(currentPrice - previousPrice);
        return priceSpread <= condition.maxSpread;
      }

      default:
        return false;
    }
  }

  /**
   * Execute the order for a triggered condition
   */
  async function executeTriggerOrder(state: TriggerState): Promise<OrderResult> {
    const { config } = state.info;
    const { order } = config;

    const request = {
      platform: config.platform as 'polymarket' | 'kalshi',
      marketId: config.marketId,
      tokenId: config.tokenId,
      outcome: config.outcome,
      negRisk: config.negRisk,
      size: order.size,
    };

    if (order.price !== undefined) {
      // Limit order
      if (order.side === 'buy') {
        return executionService.buyLimit({ ...request, price: order.price, orderType: order.orderType });
      } else {
        return executionService.sellLimit({ ...request, price: order.price, orderType: order.orderType });
      }
    } else {
      // Market order (FOK)
      if (order.side === 'buy') {
        return executionService.marketBuy(request);
      } else {
        return executionService.marketSell(request);
      }
    }
  }

  /**
   * Handle price update for a trigger
   */
  async function onPriceUpdate(triggerId: string, update: PriceUpdate): Promise<void> {
    const state = triggers.get(triggerId);
    if (!state || state.info.status !== 'active') return;

    const { condition } = state.info.config;
    const triggered = evaluateCondition(condition, update.price, state.previousPrice);
    state.previousPrice = update.price;

    if (!triggered) return;

    // Mark as triggered
    state.info.status = 'triggered';
    state.info.triggeredAt = new Date();

    logger.info(
      {
        triggerId,
        condition,
        price: update.price,
        marketId: state.info.config.marketId,
      },
      'Trigger condition met, executing order'
    );

    // Execute the order
    try {
      const result = await executeTriggerOrder(state);
      state.info.orderResult = result;

      if (result.success) {
        logger.info(
          { triggerId, orderId: result.orderId, filledSize: result.filledSize },
          'Trigger order executed successfully'
        );
      } else {
        logger.warn(
          { triggerId, error: result.error },
          'Trigger order execution failed'
        );
      }

      emitter.emit('triggered', {
        triggerId,
        trigger: state.info,
        orderResult: result,
        triggerPrice: update.price,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      state.info.orderResult = { success: false, error: msg };
      logger.error({ triggerId, error: msg }, 'Trigger order execution error');

      emitter.emit('triggered', {
        triggerId,
        trigger: state.info,
        orderResult: { success: false, error: msg },
        triggerPrice: update.price,
      });
    }

    // Clean up one-shot triggers
    const oneShot = state.info.config.oneShot ?? true;
    if (oneShot) {
      if (state.unsubscribe) state.unsubscribe();
      // Keep in map for status queries but stop monitoring
    }
  }

  /**
   * Subscribe a trigger to price updates
   */
  function subscribeTrigger(triggerId: string, state: TriggerState): void {
    const { config } = state.info;

    const unsubscribe = feedManager.subscribePrice(
      config.platform,
      config.tokenId || config.marketId,
      (update: PriceUpdate) => {
        onPriceUpdate(triggerId, update).catch((err) => {
          logger.error({ triggerId, error: String(err) }, 'Trigger price update handler error');
        });
      }
    );

    state.unsubscribe = unsubscribe;
  }

  /**
   * Check and expire old triggers
   */
  function checkExpiry(): void {
    const now = new Date();

    for (const [id, state] of triggers) {
      if (state.info.status !== 'active') continue;

      if (state.info.config.expiresAt && now >= state.info.config.expiresAt) {
        state.info.status = 'expired';
        if (state.unsubscribe) state.unsubscribe();

        logger.info({ triggerId: id }, 'Trigger expired');
        emitter.emit('expired', { triggerId: id, trigger: state.info });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  function addTrigger(config: TriggerOrderConfig): string {
    const id = generateId();

    const info: TriggerInfo = {
      id,
      config,
      status: 'active',
      createdAt: new Date(),
    };

    const state: TriggerState = { info };
    triggers.set(id, state);

    // Subscribe immediately if already running
    if (running) {
      subscribeTrigger(id, state);
    }

    logger.info(
      {
        triggerId: id,
        condition: config.condition,
        marketId: config.marketId,
        order: config.order,
      },
      'Trigger order added'
    );

    emitter.emit('trigger_added', { triggerId: id, trigger: info });

    return id;
  }

  function cancelTrigger(triggerId: string): void {
    const state = triggers.get(triggerId);
    if (!state || state.info.status !== 'active') return;

    state.info.status = 'cancelled';
    if (state.unsubscribe) state.unsubscribe();

    logger.info({ triggerId }, 'Trigger cancelled');
    emitter.emit('trigger_cancelled', { triggerId, trigger: state.info });
  }

  function getTriggers(): TriggerInfo[] {
    return Array.from(triggers.values()).map((s) => s.info);
  }

  function getTrigger(triggerId: string): TriggerInfo | undefined {
    return triggers.get(triggerId)?.info;
  }

  function start(): void {
    if (running) return;
    running = true;

    // Subscribe all active triggers
    for (const [id, state] of triggers) {
      if (state.info.status === 'active') {
        subscribeTrigger(id, state);
      }
    }

    // Start expiry checker (every 5 seconds)
    expiryTimer = setInterval(checkExpiry, 5000);

    logger.info({ activeTriggers: triggers.size }, 'Trigger order manager started');
    emitter.emit('started');
  }

  function stop(): void {
    if (!running) return;
    running = false;

    // Unsubscribe all triggers
    for (const state of triggers.values()) {
      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = undefined;
      }
    }

    if (expiryTimer) {
      clearInterval(expiryTimer);
      expiryTimer = null;
    }

    logger.info('Trigger order manager stopped');
    emitter.emit('stopped');
  }

  Object.assign(emitter, {
    addTrigger,
    cancelTrigger,
    getTriggers,
    getTrigger,
    start,
    stop,
  });

  return emitter;
}

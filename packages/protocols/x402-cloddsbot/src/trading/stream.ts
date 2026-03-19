/**
 * Trading Stream - Safe broadcast of trading activity
 *
 * Features:
 * - Sanitize sensitive data before streaming
 * - Broadcast to channels (Telegram, Discord, etc.)
 * - Real-time trade notifications
 * - Daily/weekly digest summaries
 * - Configurable privacy levels
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '../utils/logger';
import type { Platform } from '../types';
import type { Trade } from './logger';
import type { Signal, BotStatus } from './bots/index';

// =============================================================================
// TYPES
// =============================================================================

export type PrivacyLevel = 'public' | 'obscured' | 'private';

export interface StreamConfig {
  /** Privacy level for amounts/prices */
  privacy: PrivacyLevel;
  /** Show platform names */
  showPlatforms: boolean;
  /** Show market questions */
  showMarkets: boolean;
  /** Show exact prices (vs ranges) */
  showExactPrices: boolean;
  /** Show position sizes (vs percentages) */
  showSizes: boolean;
  /** Show PnL amounts (vs percentages) */
  showPnL: boolean;
  /** Show strategy names */
  showStrategies: boolean;
  /** Channels to broadcast to */
  channels: StreamChannel[];
  /** Events to broadcast */
  events: StreamEventType[];
}

export interface StreamChannel {
  type: 'telegram' | 'discord' | 'slack' | 'webhook' | 'console';
  id?: string;
  webhookUrl?: string;
  token?: string;
}

export type StreamEventType =
  | 'trade_opened'
  | 'trade_closed'
  | 'trade_filled'
  | 'signal_generated'
  | 'bot_started'
  | 'bot_stopped'
  | 'bot_error'
  | 'daily_summary'
  | 'position_update'
  | 'pnl_milestone';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: Date;
  /** Sanitized message for display */
  message: string;
  /** Raw data (only for private use) */
  rawData?: unknown;
  /** Metadata */
  meta?: {
    strategyId?: string;
    platform?: Platform;
    marketId?: string;
    pnlPct?: number;
  };
}

export interface TradingStream extends EventEmitter {
  /** Configure stream settings */
  configure(config: Partial<StreamConfig>): void;

  /** Get current config */
  getConfig(): StreamConfig;

  /** Emit a trade event (will be sanitized) */
  emitTrade(trade: Trade, eventType: 'opened' | 'closed' | 'filled'): void;

  /** Emit a signal event */
  emitSignal(signal: Signal, strategyId: string): void;

  /** Emit bot status change */
  emitBotStatus(status: BotStatus, eventType: 'started' | 'stopped' | 'error'): void;

  /** Emit daily summary */
  emitDailySummary(summary: DailySummary): void;

  /** Emit position update */
  emitPositionUpdate(position: PositionUpdate): void;

  /** Emit PnL milestone */
  emitMilestone(milestone: PnLMilestone): void;

  /** Subscribe to stream events */
  subscribe(callback: (event: StreamEvent) => void): () => void;

  /** Add a channel */
  addChannel(channel: StreamChannel): void;

  /** Remove a channel */
  removeChannel(channelId: string): void;

  /** Get formatted message for a channel type */
  formatForChannel(event: StreamEvent, channelType: StreamChannel['type']): string;
}

export interface DailySummary {
  date: string;
  tradesCount: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  totalPnLPct: number;
  bestTrade?: { market: string; pnl: number };
  worstTrade?: { market: string; pnl: number };
  byStrategy: Record<string, { trades: number; pnl: number }>;
}

export interface PositionUpdate {
  platform: Platform;
  marketId: string;
  marketQuestion?: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

export interface PnLMilestone {
  type: 'profit' | 'loss' | 'breakeven';
  amount: number;
  amountPct: number;
  message: string;
}

// =============================================================================
// SANITIZATION
// =============================================================================

const SENSITIVE_PATTERNS = [
  /0x[a-fA-F0-9]{40,}/g,  // Ethereum addresses
  /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/g,  // Bitcoin addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,  // Emails
  /\b\d{16}\b/g,  // Credit card numbers
  /api[_-]?key[_-]?[:=]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,  // API keys
  /secret[_-]?[:=]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,  // Secrets
  /password[_-]?[:=]\s*['"]?[^\s'"]+['"]?/gi,  // Passwords
  /bearer\s+[a-zA-Z0-9_-]+/gi,  // Bearer tokens
];

function sanitizeText(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function truncateAddress(address: string): string {
  if (address.length > 12) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
}

function obscureAmount(amount: number): string {
  if (amount >= 10000) return '$10k+';
  if (amount >= 5000) return '$5k-10k';
  if (amount >= 1000) return '$1k-5k';
  if (amount >= 500) return '$500-1k';
  if (amount >= 100) return '$100-500';
  if (amount >= 50) return '$50-100';
  return '<$50';
}

function obscurePrice(price: number): string {
  const cents = Math.round(price * 100);
  if (cents >= 90) return '90c+';
  if (cents >= 70) return '70-90c';
  if (cents >= 50) return '50-70c';
  if (cents >= 30) return '30-50c';
  if (cents >= 10) return '10-30c';
  return '<10c';
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const DEFAULT_CONFIG: StreamConfig = {
  privacy: 'obscured',
  showPlatforms: true,
  showMarkets: true,
  showExactPrices: false,
  showSizes: false,
  showPnL: false,
  showStrategies: true,
  channels: [],
  events: [
    'trade_closed',
    'bot_started',
    'bot_stopped',
    'bot_error',
    'daily_summary',
    'pnl_milestone',
  ],
};

export function createTradingStream(initialConfig?: Partial<StreamConfig>): TradingStream {
  const emitter = new EventEmitter() as TradingStream;
  let config: StreamConfig = { ...DEFAULT_CONFIG, ...initialConfig };
  const subscribers = new Set<(event: StreamEvent) => void>();

  function shouldEmit(eventType: StreamEventType): boolean {
    return config.events.includes(eventType);
  }

  function formatAmount(amount: number): string {
    if (config.privacy === 'private') return '[hidden]';
    if (config.privacy === 'obscured' || !config.showPnL) {
      return obscureAmount(Math.abs(amount));
    }
    return `$${amount.toFixed(2)}`;
  }

  function formatPrice(price: number): string {
    if (config.privacy === 'private') return '[hidden]';
    if (config.privacy === 'obscured' || !config.showExactPrices) {
      return obscurePrice(price);
    }
    return `${Math.round(price * 100)}c`;
  }

  function formatSize(size: number): string {
    if (config.privacy === 'private') return '[hidden]';
    if (config.privacy === 'obscured' || !config.showSizes) {
      return 'some shares';
    }
    return `${size.toFixed(0)} shares`;
  }

  function formatMarket(question?: string, marketId?: string): string {
    if (!config.showMarkets) return '[market]';
    if (question) {
      const sanitized = sanitizeText(question);
      return sanitized.length > 50 ? `${sanitized.slice(0, 47)}...` : sanitized;
    }
    if (marketId) {
      return truncateAddress(marketId);
    }
    return '[market]';
  }

  function formatPlatform(platform: Platform): string {
    if (!config.showPlatforms) return '';
    return `[${platform}] `;
  }

  function formatStrategy(strategyId?: string, strategyName?: string): string {
    if (!config.showStrategies || (!strategyId && !strategyName)) return '';
    return ` (${strategyName || strategyId})`;
  }

  function broadcast(event: StreamEvent): void {
    // Emit to local subscribers
    for (const callback of subscribers) {
      try {
        callback(event);
      } catch (err) {
        logger.error({ err }, 'Stream subscriber error');
      }
    }

    // Emit via EventEmitter
    emitter.emit('event', event);
    emitter.emit(event.type, event);

    // Broadcast to channels
    for (const channel of config.channels) {
      try {
        const formatted = emitter.formatForChannel(event, channel.type);
        broadcastToChannel(channel, formatted);
      } catch (err) {
        logger.error({ err, channel: channel.type }, 'Channel broadcast error');
      }
    }
  }

  async function broadcastToChannel(channel: StreamChannel, message: string): Promise<void> {
    switch (channel.type) {
      case 'console':
        logger.info({ channel: 'stream' }, message);
        break;

      case 'webhook':
        if (channel.webhookUrl) {
          await fetch(channel.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message, timestamp: new Date().toISOString() }),
          }).catch((err) => logger.error({ err }, 'Webhook broadcast failed'));
        }
        break;

      case 'discord':
        if (channel.webhookUrl) {
          await fetch(channel.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
          }).catch((err) => logger.error({ err }, 'Discord broadcast failed'));
        }
        break;

      case 'slack':
        if (channel.webhookUrl) {
          await fetch(channel.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message }),
          }).catch((err) => logger.error({ err }, 'Slack broadcast failed'));
        }
        break;

      case 'telegram':
        // Would need bot token and chat ID - handled by channel adapter
        emitter.emit('telegram_message', { chatId: channel.id, message });
        break;
    }
  }

  // Attach methods
  Object.assign(emitter, {
    configure(newConfig) {
      config = { ...config, ...newConfig };
      logger.info({ privacy: config.privacy, channels: config.channels.length }, 'Stream configured');
    },

    getConfig() {
      return { ...config };
    },

    emitTrade(trade, eventType) {
      const streamEventType = `trade_${eventType}` as StreamEventType;
      if (!shouldEmit(streamEventType)) return;

      const platform = formatPlatform(trade.platform);
      const market = formatMarket(trade.marketQuestion, trade.marketId);
      const price = formatPrice(trade.price);
      const size = formatSize(trade.size);
      const strategy = formatStrategy(trade.strategyId, trade.strategyName);

      let message: string;
      let pnlInfo = '';

      if (eventType === 'closed' && trade.realizedPnL !== undefined) {
        const pnlPct = trade.realizedPnLPct || 0;
        const pnlEmoji = trade.realizedPnL >= 0 ? '📈' : '📉';
        pnlInfo = ` ${pnlEmoji} ${formatPct(pnlPct)}`;
        if (config.showPnL) {
          pnlInfo += ` (${formatAmount(trade.realizedPnL)})`;
        }
      }

      switch (eventType) {
        case 'opened':
          message = `${platform}📊 ${trade.side.toUpperCase()} ${trade.outcome} @ ${price} - ${market}${strategy}`;
          break;
        case 'filled':
          message = `${platform}✅ Filled: ${trade.side.toUpperCase()} ${size} @ ${price} - ${market}${strategy}`;
          break;
        case 'closed':
          message = `${platform}🔒 Closed: ${trade.outcome}${pnlInfo} - ${market}${strategy}`;
          break;
        default:
          message = `${platform}Trade update: ${trade.status}`;
      }

      broadcast({
        type: streamEventType,
        timestamp: new Date(),
        message: sanitizeText(message),
        meta: {
          strategyId: trade.strategyId,
          platform: trade.platform,
          marketId: trade.marketId,
          pnlPct: trade.realizedPnLPct,
        },
      });
    },

    emitSignal(signal, strategyId) {
      if (!shouldEmit('signal_generated')) return;

      const platform = formatPlatform(signal.platform);
      const price = signal.price ? formatPrice(signal.price) : '';
      const confidence = signal.confidence ? ` (${Math.round(signal.confidence * 100)}% conf)` : '';

      const message = `${platform}🎯 Signal: ${signal.type.toUpperCase()} ${signal.outcome}${price ? ` @ ${price}` : ''}${confidence}`;

      broadcast({
        type: 'signal_generated',
        timestamp: new Date(),
        message: sanitizeText(message),
        meta: {
          strategyId,
          platform: signal.platform,
          marketId: signal.marketId,
        },
      });
    },

    emitBotStatus(status, eventType) {
      const streamEventType = `bot_${eventType}` as StreamEventType;
      if (!shouldEmit(streamEventType)) return;

      const emoji = eventType === 'started' ? '🟢' : eventType === 'stopped' ? '🔴' : '⚠️';
      let message = `${emoji} Bot ${status.name}: ${eventType}`;

      if (eventType === 'error' && status.lastError) {
        message += ` - ${sanitizeText(status.lastError).slice(0, 50)}`;
      }

      if (status.tradesCount > 0) {
        message += ` | ${status.tradesCount} trades | ${formatPct(status.winRate)} win rate`;
      }

      broadcast({
        type: streamEventType,
        timestamp: new Date(),
        message,
        meta: { strategyId: status.id },
      });
    },

    emitDailySummary(summary) {
      if (!shouldEmit('daily_summary')) return;

      const pnlEmoji = summary.totalPnL >= 0 ? '📈' : '📉';
      const winRate = summary.tradesCount > 0
        ? ((summary.winningTrades / summary.tradesCount) * 100).toFixed(1)
        : '0';

      let message = `📊 Daily Summary (${summary.date})\n`;
      message += `${pnlEmoji} PnL: ${formatPct(summary.totalPnLPct)}`;
      if (config.showPnL) {
        message += ` (${formatAmount(summary.totalPnL)})`;
      }
      message += `\n`;
      message += `Trades: ${summary.tradesCount} | Win rate: ${winRate}%\n`;
      message += `W: ${summary.winningTrades} | L: ${summary.losingTrades}`;

      if (summary.bestTrade && config.showMarkets) {
        message += `\nBest: ${formatMarket(summary.bestTrade.market)} ${formatPct(summary.totalPnLPct)}`;
      }

      broadcast({
        type: 'daily_summary',
        timestamp: new Date(),
        message,
      });
    },

    emitPositionUpdate(position) {
      if (!shouldEmit('position_update')) return;

      const platform = formatPlatform(position.platform);
      const market = formatMarket(position.marketQuestion, position.marketId);
      const pnlEmoji = position.unrealizedPnL >= 0 ? '📈' : '📉';

      const message = `${platform}${pnlEmoji} ${position.outcome}: ${formatPct(position.unrealizedPnLPct)} - ${market}`;

      broadcast({
        type: 'position_update',
        timestamp: new Date(),
        message: sanitizeText(message),
        meta: {
          platform: position.platform,
          marketId: position.marketId,
          pnlPct: position.unrealizedPnLPct,
        },
      });
    },

    emitMilestone(milestone) {
      if (!shouldEmit('pnl_milestone')) return;

      const emoji = milestone.type === 'profit' ? '🎉' : milestone.type === 'loss' ? '😔' : '⚖️';
      let message = `${emoji} ${milestone.message}`;

      if (config.showPnL) {
        message += ` (${formatAmount(milestone.amount)})`;
      } else {
        message += ` (${formatPct(milestone.amountPct)})`;
      }

      broadcast({
        type: 'pnl_milestone',
        timestamp: new Date(),
        message,
      });
    },

    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },

    addChannel(channel) {
      config.channels.push(channel);
      logger.info({ type: channel.type }, 'Stream channel added');
    },

    removeChannel(channelId) {
      config.channels = config.channels.filter((c) => c.id !== channelId);
    },

    formatForChannel(event, channelType) {
      switch (channelType) {
        case 'discord':
          // Discord markdown
          return event.message
            .replace(/📈/g, ':chart_with_upwards_trend:')
            .replace(/📉/g, ':chart_with_downwards_trend:')
            .replace(/🎯/g, ':dart:')
            .replace(/🟢/g, ':green_circle:')
            .replace(/🔴/g, ':red_circle:');

        case 'slack':
          // Slack mrkdwn
          return event.message;

        case 'telegram':
          // Telegram HTML
          return event.message
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>');

        default:
          return event.message;
      }
    },
  } as Partial<TradingStream>);

  return emitter;
}

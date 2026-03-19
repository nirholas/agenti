/**
 * Trading DevTools - Optional debugging and analytics integrations
 *
 * Enable in config with:
 * {
 *   "trading": {
 *     "devtools": {
 *       "enabled": true,
 *       "console": true,
 *       "websocket": { "port": 3456 },
 *       "datadog": { "apiKey": "..." },
 *       "sentry": { "dsn": "..." }
 *     }
 *   }
 * }
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '../utils/logger';
import type { Platform } from '../types';
import type { Trade } from './logger';
import type { Signal, BotStatus } from './bots/index';

// =============================================================================
// TYPES
// =============================================================================

export interface DevToolsConfig {
  /** Enable devtools */
  enabled?: boolean;
  /** Log to console with colors */
  console?: boolean | ConsoleConfig;
  /** WebSocket server for live debugging */
  websocket?: WebSocketConfig;
  /** Datadog integration */
  datadog?: DatadogConfig;
  /** Sentry error tracking */
  sentry?: SentryConfig;
  /** Custom webhook for events */
  webhook?: WebhookConfig;
  /** Performance profiling */
  profiling?: ProfilingConfig;
  /** Event replay/recording */
  recording?: RecordingConfig;
}

export interface ConsoleConfig {
  /** Show trade events */
  trades?: boolean;
  /** Show signals */
  signals?: boolean;
  /** Show bot status */
  bots?: boolean;
  /** Show performance metrics */
  perf?: boolean;
  /** Color output */
  colors?: boolean;
  /** Timestamp format */
  timestampFormat?: 'iso' | 'relative' | 'time';
}

export interface WebSocketConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host?: string;
  /** Auth token (optional) */
  authToken?: string;
}

export interface DatadogConfig {
  /** Datadog API key */
  apiKey: string;
  /** Application key (optional) */
  appKey?: string;
  /** Service name */
  service?: string;
  /** Environment tag */
  env?: string;
  /** Custom tags */
  tags?: Record<string, string>;
}

export interface SentryConfig {
  /** Sentry DSN */
  dsn: string;
  /** Environment */
  environment?: string;
  /** Release version */
  release?: string;
  /** Sample rate (0-1) */
  sampleRate?: number;
}

export interface WebhookConfig {
  /** Webhook URL */
  url: string;
  /** Events to send */
  events?: DevToolsEventType[];
  /** Headers */
  headers?: Record<string, string>;
  /** Batch events (send every N ms) */
  batchMs?: number;
}

export interface ProfilingConfig {
  /** Enable CPU profiling */
  cpu?: boolean;
  /** Enable memory profiling */
  memory?: boolean;
  /** Profile interval (ms) */
  intervalMs?: number;
  /** Save profiles to disk */
  savePath?: string;
}

export interface RecordingConfig {
  /** Enable event recording */
  enabled?: boolean;
  /** Max events to keep in memory */
  maxEvents?: number;
  /** Save recordings to disk */
  savePath?: string;
  /** Auto-save interval (ms) */
  autoSaveMs?: number;
}

export type DevToolsEventType =
  | 'trade'
  | 'signal'
  | 'bot_status'
  | 'error'
  | 'perf'
  | 'safety'
  | 'position'
  | 'custom';

export interface DevToolsEvent {
  type: DevToolsEventType;
  timestamp: Date;
  data: unknown;
  meta?: {
    strategyId?: string;
    platform?: Platform;
    tradeId?: string;
    duration?: number;
  };
}

export interface DevTools extends EventEmitter {
  /** Check if devtools is enabled */
  isEnabled(): boolean;

  /** Log a trade event */
  logTrade(trade: Trade, action: 'opened' | 'filled' | 'closed' | 'cancelled'): void;

  /** Log a signal */
  logSignal(signal: Signal, strategyId: string): void;

  /** Log bot status change */
  logBotStatus(status: BotStatus, action: 'started' | 'stopped' | 'error'): void;

  /** Log an error */
  logError(error: Error, context?: Record<string, unknown>): void;

  /** Log performance metric */
  logPerf(metric: string, value: number, tags?: Record<string, string>): void;

  /** Log safety event */
  logSafety(event: string, data: unknown): void;

  /** Log custom event */
  log(type: DevToolsEventType, data: unknown, meta?: DevToolsEvent['meta']): void;

  /** Start profiling */
  startProfile(name: string): void;

  /** Stop profiling */
  stopProfile(name: string): { duration: number; memory?: number };

  /** Get recorded events */
  getRecording(limit?: number): DevToolsEvent[];

  /** Clear recording */
  clearRecording(): void;

  /** Export recording */
  exportRecording(): string;

  /** Import recording for replay */
  importRecording(json: string): void;

  /** Get connected WebSocket clients */
  getConnectedClients(): number;

  /** Send message to all WebSocket clients */
  broadcast(message: unknown): void;

  /** Shutdown devtools */
  shutdown(): Promise<void>;
}

// =============================================================================
// CONSOLE FORMATTING
// =============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function formatTimestamp(date: Date, format: ConsoleConfig['timestampFormat']): string {
  switch (format) {
    case 'relative': {
      const diff = Date.now() - date.getTime();
      if (diff < 1000) return 'now';
      if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      return `${Math.floor(diff / 3600000)}h ago`;
    }
    case 'time':
      return date.toLocaleTimeString();
    default:
      return date.toISOString();
  }
}

function colorize(text: string, color: keyof typeof COLORS, useColors: boolean): string {
  return useColors ? `${COLORS[color]}${text}${COLORS.reset}` : text;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const DEFAULT_CONFIG: DevToolsConfig = {
  enabled: false,
  console: {
    trades: true,
    signals: true,
    bots: true,
    perf: false,
    colors: true,
    timestampFormat: 'time',
  },
};

export function createDevTools(config: DevToolsConfig = {}): DevTools {
  const cfg: DevToolsConfig = { ...DEFAULT_CONFIG, ...config };
  const emitter = new EventEmitter() as DevTools;

  // Recording buffer
  const recording: DevToolsEvent[] = [];
  const maxRecording = (cfg.recording?.maxEvents) || 1000;

  // Profiling state
  const profiles = new Map<string, { start: number; startMemory?: number }>();

  // WebSocket clients (would need actual ws implementation)
  const wsClients = new Set<any>();

  // Webhook batch buffer
  let webhookBatch: DevToolsEvent[] = [];
  let webhookTimer: NodeJS.Timeout | null = null;

  // Console config
  const consoleConfig: ConsoleConfig = typeof cfg.console === 'object'
    ? cfg.console
    : { trades: true, signals: true, bots: true, colors: true, timestampFormat: 'time' };

  function addToRecording(event: DevToolsEvent): void {
    if (!cfg.recording?.enabled) return;

    recording.push(event);
    if (recording.length > maxRecording) {
      recording.shift();
    }
  }

  function sendToWebhook(event: DevToolsEvent): void {
    if (!cfg.webhook?.url) return;

    const events = cfg.webhook.events;
    if (events && !events.includes(event.type)) return;

    if (cfg.webhook.batchMs) {
      webhookBatch.push(event);

      if (!webhookTimer) {
        webhookTimer = setTimeout(() => {
          flushWebhook();
          webhookTimer = null;
        }, cfg.webhook.batchMs);
      }
    } else {
      flushWebhook([event]);
    }
  }

  async function flushWebhook(events?: DevToolsEvent[]): Promise<void> {
    const toSend = events || webhookBatch;
    webhookBatch = [];

    if (toSend.length === 0 || !cfg.webhook?.url) return;

    try {
      await fetch(cfg.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...cfg.webhook.headers,
        },
        body: JSON.stringify({ events: toSend }),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send to webhook');
    }
  }

  function sendToDatadog(metric: string, value: number, tags?: Record<string, string>): void {
    if (!cfg.datadog?.apiKey) return;

    const ddTags = {
      service: cfg.datadog.service || 'clodds',
      env: cfg.datadog.env || 'production',
      ...cfg.datadog.tags,
      ...tags,
    };

    const tagString = Object.entries(ddTags)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    // Would send to Datadog API
    // For now, just log
    logger.debug({ metric, value, tags: tagString }, 'Datadog metric');
  }

  function sendToSentry(error: Error, context?: Record<string, unknown>): void {
    if (!cfg.sentry?.dsn) return;

    // Would send to Sentry
    // For now, just log
    logger.error({ error, context, sentry: true }, 'Sentry error');
  }

  function logToConsole(event: DevToolsEvent): void {
    if (!cfg.console) return;

    const ts = formatTimestamp(event.timestamp, consoleConfig.timestampFormat);
    const useColors = consoleConfig.colors !== false;

    let prefix = '';
    let message = '';

    switch (event.type) {
      case 'trade': {
        if (!consoleConfig.trades) return;
        const trade = event.data as any;
        const action = event.meta?.tradeId?.includes('opened') ? 'OPEN' : 'TRADE';
        const side = trade.side?.toUpperCase() || '';
        const pnl = trade.realizedPnL !== undefined
          ? ` PnL: ${trade.realizedPnL >= 0 ? '+' : ''}$${trade.realizedPnL.toFixed(2)}`
          : '';

        prefix = colorize(`[${action}]`, side === 'BUY' ? 'green' : 'red', useColors);
        message = `${side} ${trade.outcome} @ ${trade.price?.toFixed(2)}${pnl}`;
        break;
      }

      case 'signal': {
        if (!consoleConfig.signals) return;
        const signal = event.data as any;
        prefix = colorize('[SIGNAL]', 'cyan', useColors);
        message = `${signal.type?.toUpperCase()} ${signal.outcome} (${event.meta?.strategyId})`;
        if (signal.confidence) {
          message += ` conf: ${(signal.confidence * 100).toFixed(0)}%`;
        }
        break;
      }

      case 'bot_status': {
        if (!consoleConfig.bots) return;
        const status = event.data as any;
        const color = status.status === 'running' ? 'green' : status.status === 'error' ? 'red' : 'yellow';
        prefix = colorize('[BOT]', color, useColors);
        message = `${status.name}: ${status.status}`;
        break;
      }

      case 'error': {
        const error = event.data as any;
        prefix = colorize('[ERROR]', 'red', useColors);
        message = error.message || String(error);
        break;
      }

      case 'perf': {
        if (!consoleConfig.perf) return;
        const perf = event.data as any;
        prefix = colorize('[PERF]', 'magenta', useColors);
        message = `${perf.metric}: ${perf.value}${perf.unit || ''}`;
        break;
      }

      case 'safety': {
        prefix = colorize('[SAFETY]', 'bgYellow', useColors);
        message = String(event.data);
        break;
      }

      default: {
        prefix = colorize(`[${event.type.toUpperCase()}]`, 'dim', useColors);
        message = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      }
    }

    const dimTs = colorize(ts, 'dim', useColors);
    logger.debug({ type: event.type }, `${prefix} ${message}`);
  }

  function broadcastToWs(event: DevToolsEvent): void {
    if (wsClients.size === 0) return;

    const message = JSON.stringify(event);
    for (const client of wsClients) {
      try {
        client.send(message);
      } catch {
        wsClients.delete(client);
      }
    }
  }

  function processEvent(event: DevToolsEvent): void {
    if (!cfg.enabled) return;

    // Add to recording
    addToRecording(event);

    // Console output
    logToConsole(event);

    // WebSocket broadcast
    broadcastToWs(event);

    // Webhook
    sendToWebhook(event);

    // Emit for listeners
    emitter.emit('event', event);
    emitter.emit(event.type, event);
  }

  // Attach methods
  Object.assign(emitter, {
    isEnabled() {
      return cfg.enabled === true;
    },

    logTrade(trade, action) {
      processEvent({
        type: 'trade',
        timestamp: new Date(),
        data: trade,
        meta: {
          tradeId: `${trade.id}_${action}`,
          platform: trade.platform,
          strategyId: trade.strategyId,
        },
      });
    },

    logSignal(signal, strategyId) {
      processEvent({
        type: 'signal',
        timestamp: new Date(),
        data: signal,
        meta: {
          strategyId,
          platform: signal.platform,
        },
      });
    },

    logBotStatus(status, action) {
      processEvent({
        type: 'bot_status',
        timestamp: new Date(),
        data: { ...status, action },
        meta: { strategyId: status.id },
      });
    },

    logError(error, context) {
      processEvent({
        type: 'error',
        timestamp: new Date(),
        data: { message: error.message, ...context },
      });

      // Also send to Sentry if configured
      sendToSentry(error, context);
    },

    logPerf(metric, value, tags) {
      processEvent({
        type: 'perf',
        timestamp: new Date(),
        data: { metric, value, tags },
      });

      // Also send to Datadog if configured
      sendToDatadog(metric, value, tags);
    },

    logSafety(event, data) {
      processEvent({
        type: 'safety',
        timestamp: new Date(),
        data: { event, ...data as object },
      });
    },

    log(type, data, meta) {
      processEvent({
        type,
        timestamp: new Date(),
        data,
        meta,
      });
    },

    startProfile(name) {
      profiles.set(name, {
        start: performance.now(),
        startMemory: process.memoryUsage?.()?.heapUsed,
      });
    },

    stopProfile(name) {
      const profile = profiles.get(name);
      if (!profile) {
        return { duration: 0 };
      }

      const duration = performance.now() - profile.start;
      const memory = profile.startMemory !== undefined
        ? (process.memoryUsage?.()?.heapUsed || 0) - profile.startMemory
        : undefined;

      profiles.delete(name);

      // Log perf metric directly via processEvent
      processEvent({
        type: 'perf',
        timestamp: new Date(),
        data: { metric: `profile.${name}`, value: duration, tags: { unit: 'ms' } },
      });

      return { duration, memory };
    },

    getRecording(limit) {
      return limit ? recording.slice(-limit) : [...recording];
    },

    clearRecording() {
      recording.length = 0;
    },

    exportRecording() {
      return JSON.stringify(recording, null, 2);
    },

    importRecording(json) {
      const imported = JSON.parse(json) as DevToolsEvent[];
      recording.length = 0;
      recording.push(...imported);
    },

    getConnectedClients() {
      return wsClients.size;
    },

    broadcast(message) {
      const event: DevToolsEvent = {
        type: 'custom',
        timestamp: new Date(),
        data: message,
      };
      broadcastToWs(event);
    },

    async shutdown() {
      // Flush webhook
      if (webhookTimer) {
        clearTimeout(webhookTimer);
        await flushWebhook();
      }

      // Close WebSocket connections
      for (const client of wsClients) {
        try {
          client.close();
        } catch {
          // Ignore
        }
      }
      wsClients.clear();

      logger.info('DevTools shutdown');
    },
  } as Partial<DevTools>);

  if (cfg.enabled) {
    logger.info({ console: !!cfg.console, webhook: !!cfg.webhook, datadog: !!cfg.datadog }, 'DevTools enabled');
  }

  return emitter;
}

// =============================================================================
// PERFORMANCE HELPERS
// =============================================================================

/**
 * Measure execution time of async function
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  devtools?: DevTools
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    devtools?.logPerf(name, duration, { unit: 'ms' });
  }
}

/**
 * Create a performance-tracked version of a function
 */
export function withProfiling<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  devtools?: DevTools
): T {
  return (async (...args: Parameters<T>) => {
    return measure(name, () => fn(...args), devtools);
  }) as T;
}

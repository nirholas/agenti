// Error Monitoring and Logging Implementation for QR Pay
// Supports Sentry integration, structured logging, and metrics collection

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Structured log entry
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  requestId?: string;
  traceId?: string;
}

// API call metrics
export interface ApiCallMetrics {
  endpoint: string;
  method: string;
  requestId: string;
  latency: number;
  status: number;
  [key: string]: unknown; // Additional metadata
}

// Performance metrics
interface PerformanceMetrics {
  apiCalls: Map<string, { count: number; totalLatency: number; errors: number }>;
  lastReset: number;
}

// In-memory metrics store
const metrics: PerformanceMetrics = {
  apiCalls: new Map(),
  lastReset: Date.now(),
};

// Log buffer for batch processing
const logBuffer: LogEntry[] = [];
const LOG_BUFFER_SIZE = 100;
const LOG_FLUSH_INTERVAL = 10000; // 10 seconds

// Configuration
const config = {
  logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  enableConsole: process.env.NODE_ENV !== 'test',
  enableSentry: !!process.env.SENTRY_DSN,
  sentryDsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  serviceName: 'qr-pay-api',
};

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.logLevel];
}

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.requestId ? `[${entry.requestId.slice(0, 8)}]` : '',
    entry.message,
  ].filter(Boolean);

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }

  if (entry.error) {
    parts.push(`\n  Error: ${entry.error.name}: ${entry.error.message}`);
    if (entry.error.stack) {
      parts.push(`\n  Stack: ${entry.error.stack}`);
    }
  }

  return parts.join(' ');
}

/**
 * Write log entry
 */
function writeLog(entry: LogEntry): void {
  if (!shouldLog(entry.level)) {
    return;
  }

  // Console output
  if (config.enableConsole) {
    const formatted = formatLogEntry(entry);
    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  // Add to buffer
  logBuffer.push(entry);

  // Flush if buffer is full
  if (logBuffer.length >= LOG_BUFFER_SIZE) {
    flushLogs();
  }
}

/**
 * Flush log buffer
 */
async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return;

  const logs = [...logBuffer];
  logBuffer.length = 0;

  // Send to external logging service if configured
  // This is where you'd integrate with services like:
  // - Datadog
  // - Logtail
  // - AWS CloudWatch
  // - etc.

  if (process.env.LOGGING_ENDPOINT) {
    try {
      await fetch(process.env.LOGGING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs, service: config.serviceName }),
      });
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }
}

// Flush logs periodically
if (typeof setInterval !== 'undefined') {
  setInterval(flushLogs, LOG_FLUSH_INTERVAL);
}

/**
 * Log a debug message
 */
export function logDebug(
  message: string,
  context?: Record<string, unknown>
): void {
  writeLog({
    level: 'debug',
    message,
    timestamp: new Date().toISOString(),
    context,
  });
}

/**
 * Log an info message
 */
export function logInfo(
  message: string,
  context?: Record<string, unknown>
): void {
  writeLog({
    level: 'info',
    message,
    timestamp: new Date().toISOString(),
    context,
  });
}

/**
 * Log a warning message
 */
export function logWarn(
  message: string,
  context?: Record<string, unknown>
): void {
  writeLog({
    level: 'warn',
    message,
    timestamp: new Date().toISOString(),
    context,
  });
}

/**
 * Log an error
 */
export function logError(
  message: string,
  context?: Record<string, unknown> & { error?: unknown; requestId?: string }
): void {
  const { error, requestId, ...restContext } = context || {};

  const entry: LogEntry = {
    level: 'error',
    message,
    timestamp: new Date().toISOString(),
    context: restContext,
    requestId,
  };

  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (error) {
    entry.error = {
      name: 'UnknownError',
      message: String(error),
    };
  }

  writeLog(entry);

  // Report to Sentry if enabled
  if (config.enableSentry && error instanceof Error) {
    reportToSentry(error, { message, ...restContext });
  }
}

/**
 * Report error to Sentry
 */
async function reportToSentry(
  error: Error,
  context: Record<string, unknown>
): Promise<void> {
  // Sentry integration would go here
  // For now, this is a placeholder
  // In production, you'd use @sentry/node
  
  if (process.env.SENTRY_DSN) {
    // Example Sentry integration:
    // Sentry.captureException(error, { extra: context });
    console.error('[Sentry] Would report:', error.message, context);
  }
}

/**
 * Log an API call with metrics
 */
export function logApiCall(callMetrics: ApiCallMetrics): void {
  const { endpoint, method, requestId, latency, status, ...metadata } = callMetrics;

  // Update performance metrics
  const key = `${method}:${endpoint}`;
  
  // Use the global metrics object
  const globalMetrics = getMetrics();
  const existingMetric = globalMetrics.apiCalls.get(key) || { count: 0, totalLatency: 0, errors: 0 };
  
  globalMetrics.apiCalls.set(key, {
    count: existingMetric.count + 1,
    totalLatency: existingMetric.totalLatency + latency,
    errors: existingMetric.errors + (status >= 400 ? 1 : 0),
  });

  // Log the call
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  
  writeLog({
    level,
    message: `API ${method} ${endpoint} ${status}`,
    timestamp: new Date().toISOString(),
    requestId,
    context: {
      latency: `${latency}ms`,
      status,
      ...metadata,
    },
  });
}

/**
 * Get current performance metrics
 */
function getMetrics(): PerformanceMetrics {
  return metrics;
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): {
  apiCalls: Record<string, { count: number; avgLatency: number; errorRate: number }>;
  periodStart: string;
  periodEnd: string;
} {
  const summary: Record<string, { count: number; avgLatency: number; errorRate: number }> = {};

  for (const [key, data] of metrics.apiCalls.entries()) {
    summary[key] = {
      count: data.count,
      avgLatency: data.count > 0 ? Math.round(data.totalLatency / data.count) : 0,
      errorRate: data.count > 0 ? Number((data.errors / data.count * 100).toFixed(2)) : 0,
    };
  }

  return {
    apiCalls: summary,
    periodStart: new Date(metrics.lastReset).toISOString(),
    periodEnd: new Date().toISOString(),
  };
}

/**
 * Reset performance metrics
 */
export function resetMetrics(): void {
  metrics.apiCalls.clear();
  metrics.lastReset = Date.now();
}

/**
 * Create a request context for tracing
 */
export function createRequestContext(requestId?: string): {
  requestId: string;
  traceId: string;
  startTime: number;
} {
  return {
    requestId: requestId || crypto.randomUUID(),
    traceId: crypto.randomUUID(),
    startTime: Date.now(),
  };
}

/**
 * Health check for monitoring service
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
}> {
  const checks: Record<string, boolean> = {
    logging: true,
    metrics: metrics.apiCalls !== undefined,
  };

  // Check Sentry connectivity if enabled
  if (config.enableSentry) {
    checks.sentry = !!process.env.SENTRY_DSN;
  }

  const allHealthy = Object.values(checks).every(Boolean);
  const anyHealthy = Object.values(checks).some(Boolean);

  return {
    status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
    checks,
  };
}

/**
 * Wrap an async function with error monitoring
 */
export function withErrorMonitoring<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  name: string
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      logDebug(`${name} completed`, { latency: Date.now() - startTime });
      return result;
    } catch (error) {
      logError(`${name} failed`, { error, latency: Date.now() - startTime });
      throw error;
    }
  }) as T;
}

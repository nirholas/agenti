/**
 * API Request Logger
 *
 * Structured logging for API requests with timing and context.
 */

export interface RequestLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  duration: number;
  status: number;
  clientId?: string;
  sessionId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Whether to pretty-print JSON */
  pretty?: boolean;
  /** Custom log handler */
  handler?: (entry: RequestLogEntry, level: LogLevel) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class ApiLogger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      minLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      pretty: process.env.NODE_ENV === 'development',
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const minLevelValue = LOG_LEVELS[this.config.minLevel || 'info'];
    const levelValue = LOG_LEVELS[level];
    return levelValue >= minLevelValue;
  }

  private formatEntry(entry: RequestLogEntry): string {
    if (this.config.pretty) {
      return JSON.stringify(entry, null, 2);
    }
    return JSON.stringify(entry);
  }

  private log(entry: RequestLogEntry, level: LogLevel): void {
    if (!this.shouldLog(level)) return;

    if (this.config.handler) {
      this.config.handler(entry, level);
      return;
    }

    const formatted = this.formatEntry(entry);

    switch (level) {
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

  /**
   * Log a successful request
   */
  success(entry: Omit<RequestLogEntry, 'timestamp'>): void {
    this.log(
      {
        ...entry,
        timestamp: new Date().toISOString(),
      },
      entry.status >= 400 ? 'warn' : 'info'
    );
  }

  /**
   * Log a failed request
   */
  error(entry: Omit<RequestLogEntry, 'timestamp'>): void {
    this.log(
      {
        ...entry,
        timestamp: new Date().toISOString(),
      },
      'error'
    );
  }

  /**
   * Log a debug message
   */
  debug(entry: Omit<RequestLogEntry, 'timestamp'>): void {
    this.log(
      {
        ...entry,
        timestamp: new Date().toISOString(),
      },
      'debug'
    );
  }
}

// Singleton logger instance
export const logger = new ApiLogger();

/**
 * Creates a request context for logging
 */
export function createLogContext(
  method: string,
  path: string,
  requestId: string,
  clientId?: string
): {
  startTime: number;
  log: (status: number, sessionId?: string, error?: string, metadata?: Record<string, unknown>) => void;
} {
  const startTime = Date.now();

  return {
    startTime,
    log: (status: number, sessionId?: string, error?: string, metadata?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      const entry: Omit<RequestLogEntry, 'timestamp'> = {
        requestId,
        method,
        path,
        duration,
        status,
        clientId,
        sessionId,
        error,
        metadata,
      };

      if (error || status >= 500) {
        logger.error(entry);
      } else {
        logger.success(entry);
      }
    },
  };
}

/**
 * Decorator for timing async functions
 */
export async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  onComplete?: (duration: number) => void
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const duration = Date.now() - start;
    if (onComplete) {
      onComplete(duration);
    }
  }
}

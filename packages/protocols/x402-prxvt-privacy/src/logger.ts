/**
 * Configurable debug logger for Privacy SDK
 * Controlled via SDK options or environment variable
 */

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

class Logger {
  private level: LogLevel = 'none';
  private prefix: string = '[PrivacySDK]';

  configure(options: LoggerOptions): void {
    if (options.level !== undefined) {
      this.level = options.level;
    }
    if (options.prefix !== undefined) {
      this.prefix = options.prefix;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.prefix, ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.prefix, ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(this.prefix, ...args);
    }
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.prefix, ...args);
    }
  }

  /** Get current log level */
  getLevel(): LogLevel {
    return this.level;
  }

  /** Check if debug mode is enabled */
  isDebug(): boolean {
    return this.level === 'debug';
  }
}

// Singleton instance
export const logger = new Logger();

// Initialize from environment if available
if (typeof process !== 'undefined' && process.env?.PRIVACY_SDK_DEBUG === 'true') {
  logger.configure({ level: 'debug' });
}

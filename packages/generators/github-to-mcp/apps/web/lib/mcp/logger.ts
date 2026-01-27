/**
 * MCP Logger - Pluggable logging interface for MCP client
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

// ============================================================================
// Log Levels
// ============================================================================

/**
 * Log level enumeration with numeric values for comparison
 */
export enum LogLevel {
  /** No logging */
  None = 0,
  /** Error messages only */
  Error = 1,
  /** Warnings and errors */
  Warn = 2,
  /** Informational messages */
  Info = 3,
  /** Debug information */
  Debug = 4,
  /** Verbose tracing */
  Trace = 5,
}

/**
 * Log level string type for configuration
 */
export type LogLevelName = 'none' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Convert log level name to enum value
 */
export function parseLogLevel(level: LogLevelName): LogLevel {
  const levelMap: Record<LogLevelName, LogLevel> = {
    none: LogLevel.None,
    error: LogLevel.Error,
    warn: LogLevel.Warn,
    info: LogLevel.Info,
    debug: LogLevel.Debug,
    trace: LogLevel.Trace,
  };
  return levelMap[level] ?? LogLevel.Info;
}

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Log entry metadata
 */
export interface LogContext {
  /** Timestamp of the log entry */
  readonly timestamp: Date;
  /** Logger name/namespace */
  readonly logger: string;
  /** Log level */
  readonly level: LogLevel;
  /** Additional structured data */
  readonly data?: Readonly<Record<string, unknown>>;
  /** Error object if applicable */
  readonly error?: Error;
  /** Request/operation ID for correlation */
  readonly requestId?: string;
  /** Session ID if applicable */
  readonly sessionId?: string;
}

/**
 * Logger interface that all loggers must implement
 */
export interface Logger {
  /** Current log level */
  readonly level: LogLevel;

  /**
   * Log an error message
   * @param message - Error message
   * @param context - Optional context data
   */
  error(message: string, context?: Partial<LogContext>): void;

  /**
   * Log a warning message
   * @param message - Warning message
   * @param context - Optional context data
   */
  warn(message: string, context?: Partial<LogContext>): void;

  /**
   * Log an informational message
   * @param message - Info message
   * @param context - Optional context data
   */
  info(message: string, context?: Partial<LogContext>): void;

  /**
   * Log a debug message
   * @param message - Debug message
   * @param context - Optional context data
   */
  debug(message: string, context?: Partial<LogContext>): void;

  /**
   * Log a trace message
   * @param message - Trace message
   * @param context - Optional context data
   */
  trace(message: string, context?: Partial<LogContext>): void;

  /**
   * Create a child logger with a sub-namespace
   * @param namespace - Child namespace
   * @returns Child logger instance
   */
  child(namespace: string): Logger;

  /**
   * Create a logger with bound context
   * @param context - Context to bind
   * @returns Logger with bound context
   */
  withContext(context: Partial<LogContext>): Logger;
}

// ============================================================================
// Console Logger Implementation
// ============================================================================

/**
 * Console logger configuration
 */
export interface ConsoleLoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;
  /** Logger namespace */
  namespace?: string;
  /** Whether to include timestamps */
  timestamps?: boolean;
  /** Whether to colorize output (for terminals) */
  colors?: boolean;
  /** Custom formatter function */
  formatter?: (entry: LogEntry) => string;
}

/**
 * Log entry for formatting
 */
export interface LogEntry {
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly levelName: string;
  readonly namespace: string;
  readonly message: string;
  readonly context?: Partial<LogContext>;
}

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

/**
 * Level to color mapping
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.None]: COLORS.white,
  [LogLevel.Error]: COLORS.red,
  [LogLevel.Warn]: COLORS.yellow,
  [LogLevel.Info]: COLORS.blue,
  [LogLevel.Debug]: COLORS.cyan,
  [LogLevel.Trace]: COLORS.gray,
};

/**
 * Level to name mapping
 */
const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.None]: 'NONE',
  [LogLevel.Error]: 'ERROR',
  [LogLevel.Warn]: 'WARN',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Debug]: 'DEBUG',
  [LogLevel.Trace]: 'TRACE',
};

/**
 * Default log formatter
 */
function defaultFormatter(entry: LogEntry, colors: boolean): string {
  const timestamp = entry.timestamp.toISOString();
  const levelName = entry.levelName.padEnd(5);
  const namespace = entry.namespace ? `[${entry.namespace}]` : '';

  let contextStr = '';
  if (entry.context) {
    const { timestamp: _, level: __, logger: ___, ...rest } = entry.context;
    if (Object.keys(rest).length > 0) {
      if (rest.error instanceof Error) {
        contextStr = ` ${rest.error.message}`;
        if (rest.error.stack) {
          contextStr += `\n${rest.error.stack}`;
        }
      } else {
        contextStr = ` ${JSON.stringify(rest)}`;
      }
    }
  }

  if (colors) {
    const color = LEVEL_COLORS[entry.level] || COLORS.white;
    return `${COLORS.gray}${timestamp}${COLORS.reset} ${color}${levelName}${COLORS.reset} ${COLORS.cyan}${namespace}${COLORS.reset} ${entry.message}${contextStr}`;
  }

  return `${timestamp} ${levelName} ${namespace} ${entry.message}${contextStr}`;
}

/**
 * Console-based logger implementation
 */
export class ConsoleLogger implements Logger {
  readonly level: LogLevel;
  private readonly _namespace: string;
  private readonly _timestamps: boolean;
  private readonly _colors: boolean;
  private readonly _formatter: (entry: LogEntry) => string;
  private readonly _boundContext: Partial<LogContext>;

  constructor(options: ConsoleLoggerOptions = {}) {
    this.level = options.level ?? LogLevel.Info;
    this._namespace = options.namespace ?? 'mcp';
    this._timestamps = options.timestamps ?? true;
    this._colors = options.colors ?? (typeof process !== 'undefined' && process.stdout?.isTTY === true);
    this._formatter = options.formatter ?? ((entry) => defaultFormatter(entry, this._colors));
    this._boundContext = {};
  }

  /**
   * Private constructor for creating child loggers
   */
  private static _createChild(
    level: LogLevel,
    namespace: string,
    timestamps: boolean,
    colors: boolean,
    formatter: (entry: LogEntry) => string,
    boundContext: Partial<LogContext>
  ): ConsoleLogger {
    const logger = Object.create(ConsoleLogger.prototype) as ConsoleLogger;
    // Use Object.defineProperty to set readonly properties
    Object.defineProperty(logger, 'level', { value: level, writable: false });
    Object.defineProperty(logger, '_namespace', { value: namespace, writable: false });
    Object.defineProperty(logger, '_timestamps', { value: timestamps, writable: false });
    Object.defineProperty(logger, '_colors', { value: colors, writable: false });
    Object.defineProperty(logger, '_formatter', { value: formatter, writable: false });
    Object.defineProperty(logger, '_boundContext', { value: boundContext, writable: false });
    return logger;
  }

  private _log(level: LogLevel, message: string, context?: Partial<LogContext>): void {
    if (level > this.level) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      levelName: LEVEL_NAMES[level],
      namespace: this._namespace,
      message,
      context: { ...this._boundContext, ...context },
    };

    const formatted = this._formatter(entry);

    switch (level) {
      case LogLevel.Error:
        console.error(formatted);
        break;
      case LogLevel.Warn:
        console.warn(formatted);
        break;
      case LogLevel.Info:
        console.info(formatted);
        break;
      case LogLevel.Debug:
      case LogLevel.Trace:
        console.debug(formatted);
        break;
    }
  }

  error(message: string, context?: Partial<LogContext>): void {
    this._log(LogLevel.Error, message, context);
  }

  warn(message: string, context?: Partial<LogContext>): void {
    this._log(LogLevel.Warn, message, context);
  }

  info(message: string, context?: Partial<LogContext>): void {
    this._log(LogLevel.Info, message, context);
  }

  debug(message: string, context?: Partial<LogContext>): void {
    this._log(LogLevel.Debug, message, context);
  }

  trace(message: string, context?: Partial<LogContext>): void {
    this._log(LogLevel.Trace, message, context);
  }

  child(namespace: string): Logger {
    const childNamespace = this._namespace ? `${this._namespace}:${namespace}` : namespace;
    return ConsoleLogger._createChild(
      this.level,
      childNamespace,
      this._timestamps,
      this._colors,
      this._formatter,
      { ...this._boundContext }
    );
  }

  withContext(context: Partial<LogContext>): Logger {
    return ConsoleLogger._createChild(
      this.level,
      this._namespace,
      this._timestamps,
      this._colors,
      this._formatter,
      { ...this._boundContext, ...context }
    );
  }
}

// ============================================================================
// Noop Logger Implementation
// ============================================================================

/**
 * No-operation logger that discards all log messages
 * Useful for testing or when logging should be completely disabled
 */
export class NoopLogger implements Logger {
  readonly level = LogLevel.None;

  error(_message: string, _context?: Partial<LogContext>): void {
    // No-op
  }

  warn(_message: string, _context?: Partial<LogContext>): void {
    // No-op
  }

  info(_message: string, _context?: Partial<LogContext>): void {
    // No-op
  }

  debug(_message: string, _context?: Partial<LogContext>): void {
    // No-op
  }

  trace(_message: string, _context?: Partial<LogContext>): void {
    // No-op
  }

  child(_namespace: string): Logger {
    return this;
  }

  withContext(_context: Partial<LogContext>): Logger {
    return this;
  }
}

// ============================================================================
// Logger Factory
// ============================================================================

/** Global default logger instance */
let globalLogger: Logger = new ConsoleLogger({ level: LogLevel.Warn });

/**
 * Get the global logger instance
 */
export function getLogger(): Logger {
  return globalLogger;
}

/**
 * Set the global logger instance
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Create a new console logger
 */
export function createConsoleLogger(options?: ConsoleLoggerOptions): Logger {
  return new ConsoleLogger(options);
}

/**
 * Create a no-op logger
 */
export function createNoopLogger(): Logger {
  return new NoopLogger();
}

/**
 * Create a logger with the specified level
 */
export function createLogger(level: LogLevel | LogLevelName, namespace?: string): Logger {
  const numericLevel = typeof level === 'string' ? parseLogLevel(level) : level;
  return new ConsoleLogger({ level: numericLevel, namespace });
}

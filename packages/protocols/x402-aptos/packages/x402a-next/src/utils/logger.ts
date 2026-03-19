export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
  component?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

function getCurrentLogLevel(): LogLevel {
  if (typeof process !== "undefined" && process.env?.X402A_LOG_LEVEL) {
    const envLevel = process.env.X402A_LOG_LEVEL.toLowerCase() as LogLevel;
    if (LOG_LEVELS[envLevel]) {
      return envLevel;
    }
  }

  const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  return nodeEnv === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(entry: LogEntry): string {
  const { level, timestamp, message, context, component } = entry;

  const parts = [
    `[${timestamp}]`,
    `[${level.toUpperCase()}]`,
    component ? `[${component}]` : "",
    message,
  ].filter(Boolean);

  let logString = parts.join(" ");

  if (context && Object.keys(context).length > 0) {
    logString += ` ${JSON.stringify(context)}`;
  }

  return logString;
}

function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  component?: string
) {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    context,
    component,
  };

  const formatted = formatLog(entry);

  if (level === "error" || level === "fatal") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export function createLogger(componentName: string) {
  return {
    trace(message: string, context?: Record<string, unknown>) {
      log("trace", message, context, componentName);
    },
    debug(message: string, context?: Record<string, unknown>) {
      log("debug", message, context, componentName);
    },
    info(message: string, context?: Record<string, unknown>) {
      log("info", message, context, componentName);
    },
    warn(message: string, context?: Record<string, unknown>) {
      log("warn", message, context, componentName);
    },
    error(message: string, context?: Record<string, unknown>) {
      log("error", message, context, componentName);
    },
    fatal(message: string, context?: Record<string, unknown>) {
      log("fatal", message, context, componentName);
    },
  };
}

export const logger = createLogger("x402a-next");

export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

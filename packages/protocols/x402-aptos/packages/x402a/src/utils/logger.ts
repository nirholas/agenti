import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const isBrowser = typeof window !== "undefined";

function getLogLevel(): LogLevel {
  if (isBrowser) {
    return "info"; // Browser default
  }
  const envLevel = process.env.X402A_LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel) {
    return envLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

interface PinoConfig {
  level: LogLevel;
  base: {
    service: string;
  };
  redact: {
    paths: string[];
    censor: string;
  };
  timestamp: () => string;
  browser?: {
    asObject: boolean;
    write: {
      trace: typeof console.trace;
      debug: typeof console.debug;
      info: typeof console.info;
      warn: typeof console.warn;
      error: typeof console.error;
      fatal: typeof console.error;
    };
  };
}

function createBaseLogger() {
  const config: PinoConfig = {
    level: getLogLevel(),
    base: {
      service: "x402a",
    },

    redact: {
      paths: ["privateKey", "signature", "nonce", "req.headers.authorization"],
      censor: "[REDACTED]",
    },

    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (isBrowser) {
    config.browser = {
      asObject: true,
      write: {
        trace: console.trace.bind(console),
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        fatal: console.error.bind(console),
      },
    };
  }

  return pino(config);
}

// Simplified: Direct instance instead of Proxy pattern
export const logger = createBaseLogger();

export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createRequestLogger(req: {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
}) {
  const correlationId = generateCorrelationId();
  return createLogger({
    correlationId,
    method: req.method,
    url: req.url,
    userAgent: req.headers?.["user-agent"],
  });
}

export default logger;

/**
 * Request Logging Middleware
 * 
 * Structured logging with timestamps for all requests
 */

import winston from 'winston';
import type { Request, Response, NextFunction } from 'express';

/**
 * Winston logger configuration
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'x402-facilitator' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }: { level: string; message: string; timestamp: string; [key: string]: unknown }) => {
          const metaStr = Object.keys(meta).length > 1 
            ? ` ${JSON.stringify(meta, null, 0)}` 
            : '';
          return `[${timestamp}] ${level}: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    })
  );
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Attach request ID for tracing
  req.headers['x-request-id'] = requestId;

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('User-Agent'),
  });

  // Capture response
  const originalSend = res.send.bind(res);
  res.send = function (body: unknown) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });

    return originalSend(body);
  };

  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Error logging middleware
 */
export function errorLogger(
  err: Error,
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  logger.error('Request error', {
    requestId: req.headers['x-request-id'],
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
  });

  next(err);
}

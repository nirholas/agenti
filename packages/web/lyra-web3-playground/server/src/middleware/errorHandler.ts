/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Embrace the bugs, they make you stronger 🦋
 */

import { Request, Response, NextFunction } from 'express';

interface HttpError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: HttpError | Error | unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Type-safe error handling
  const error = err instanceof Error ? err : new Error('Unknown error occurred');
  const statusCode = (err as HttpError)?.statusCode || 500;
  const message = error.message || 'Internal server error';
  
  console.error('Error:', message);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

export class AppError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

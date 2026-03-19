import type { Request, Response, NextFunction } from 'express';
import { verifySignature } from './verifier.js';

declare global {
  namespace Express {
    interface Request {
      signerAddress?: string;
    }
  }
}

export interface AuthOptions {
  protectedRoutes?: string[];
  requireRegistered?: boolean;
}

export function authMiddleware(options: AuthOptions = {}) {
  const { protectedRoutes } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // If protectedRoutes specified, only check those
    if (protectedRoutes) {
      const routeKey = `${req.method} ${req.path}`;
      if (!protectedRoutes.includes(routeKey) && !protectedRoutes.includes(req.path)) {
        return next();
      }
    }

    const result = await verifySignature(req);

    if (!result.valid) {
      return res.status(401).json({
        error: 'Authentication failed',
        detail: result.error,
      });
    }

    req.signerAddress = result.address;
    next();
  };
}

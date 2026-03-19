import type { Request, Response, NextFunction } from 'express';
import { getAuth } from '../auth/index.js';
import { isAdmin } from '../utils/admin.js';

// Extend Express Request to include user session
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
      session?: {
        id: string;
        userId: string;
        expiresAt: Date;
      };
    }
  }
}

/**
 * Middleware to require authentication
 * Validates the session and attaches user to request
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = getAuth();

    // Get session from the request
    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (!session || !session.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Attach user and session to request
    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session',
    });
  }
}

/**
 * Optional auth middleware - doesn't require auth but attaches user if present
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = getAuth();

    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (session?.user) {
      req.user = session.user;
      req.session = session.session;
    }

    next();
  } catch {
    // Continue without user
    next();
  }
}

/**
 * Middleware to require admin access
 * First validates session, then checks if user is admin
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = getAuth();

    // Get session from the request
    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (!session || !session.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Attach user and session to request
    req.user = session.user;
    req.session = session.session;

    // Check if user is admin
    if (!isAdmin(session.user.id)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session',
    });
  }
}


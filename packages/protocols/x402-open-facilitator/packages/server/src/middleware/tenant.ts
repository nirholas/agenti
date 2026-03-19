import type { Request, Response, NextFunction } from 'express';
import { getFacilitatorBySubdomain, getFacilitatorByCustomDomain } from '../db/facilitators.js';
import type { FacilitatorRecord } from '../db/types.js';

// Extend Express Request to include facilitator
declare global {
  namespace Express {
    interface Request {
      facilitator?: FacilitatorRecord;
    }
  }
}

/**
 * Extract subdomain from hostname
 */
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];

  // Handle localhost for development
  if (host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  // Check for .openfacilitator.io pattern
  if (host.endsWith('.openfacilitator.io')) {
    const parts = host.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }
  }

  // Check for custom.openfacilitator.io (custom domain CNAME target)
  if (host === 'custom.openfacilitator.io') {
    return null; // Will be resolved by custom domain
  }

  return null;
}

/**
 * Middleware to resolve the facilitator based on subdomain or custom domain
 */
export function resolveFacilitator(req: Request, res: Response, next: NextFunction): void {
  const hostname = req.hostname || req.headers.host || '';

  // Skip facilitator resolution for API routes
  if (req.path.startsWith('/api/')) {
    next();
    return;
  }

  // Dev mode: allow X-Facilitator-Subdomain header or ?_subdomain= query param for local testing
  const devSubdomain = req.headers['x-facilitator-subdomain'] as string | undefined
    || req.query._subdomain as string | undefined;
  if (devSubdomain) {
    const facilitator = getFacilitatorBySubdomain(devSubdomain);
    if (facilitator) {
      req.facilitator = facilitator;
      next();
      return;
    }
  }

  // Try subdomain first
  const subdomain = extractSubdomain(hostname);
  if (subdomain) {
    const facilitator = getFacilitatorBySubdomain(subdomain);
    if (facilitator) {
      req.facilitator = facilitator;
      next();
      return;
    }
  }

  // Try custom domain
  const customDomain = hostname.split(':')[0];
  if (customDomain && customDomain !== 'localhost') {
    const facilitator = getFacilitatorByCustomDomain(customDomain);
    if (facilitator) {
      req.facilitator = facilitator;
      next();
      return;
    }
  }

  // No facilitator found - continue without one
  // This allows access to root domain endpoints
  next();
}

/**
 * Middleware that requires a facilitator to be resolved
 */
export function requireFacilitator(req: Request, res: Response, next: NextFunction): void {
  if (!req.facilitator) {
    res.status(404).json({
      error: 'Facilitator not found',
      message: 'No facilitator configured for this domain',
    });
    return;
  }
  next();
}


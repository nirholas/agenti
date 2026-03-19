import { validateTokenFormat } from "./tokens.js";
import type { TokenStorage } from "./storage/interface.js";
import type { RateLimiter } from "./rate-limit/interface.js";

/**
 * Authentication context for validated requests
 */
export interface AuthContext {
  tokenId: string;
  userId: string | null;
  tier: string;
  metadata: Record<string, unknown>;
}

/**
 * Result of token validation
 */
export interface ValidationResult {
  valid: boolean;
  context?: AuthContext;
  error?: {
    code:
      | "MISSING_TOKEN"
      | "INVALID_TOKEN"
      | "EXPIRED_TOKEN"
      | "RATE_LIMITED"
      | "INACTIVE_TOKEN";
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Bearer token validator
 * Orchestrates token validation, rate limiting, and context creation
 */
export class BearerTokenValidator {
  constructor(
    private storage: TokenStorage,
    private rateLimiter: RateLimiter,
  ) {}

  /**
   * Validate Authorization header and return validation result
   *
   * @param authHeader - Authorization header value (e.g., "Bearer fac_test_...")
   * @returns Validation result with context or error
   */
  async validate(
    authHeader: string | null | undefined,
  ): Promise<ValidationResult> {
    // 1. Check if header exists
    if (!authHeader || !authHeader.trim()) {
      return {
        valid: false,
        error: {
          code: "MISSING_TOKEN",
          message:
            "Authorization header missing. Expected: Bearer <token>",
        },
      };
    }

    // 2. Extract bearer token
    const token = this.extractToken(authHeader);
    if (!token) {
      return {
        valid: false,
        error: {
          code: "INVALID_TOKEN",
          message:
            "Invalid authorization header format. Expected: Bearer <token>",
        },
      };
    }

    // 3. Validate token format
    if (!this.isValidTokenFormat(token)) {
      return {
        valid: false,
        error: {
          code: "INVALID_TOKEN",
          message: `Invalid token format. Expected: fac_{test|live}_{24-char-base58}`,
        },
      };
    }

    // 4. Lookup token in storage (getToken returns null for inactive tokens)
    const apiToken = await this.storage.getToken(token);
    if (!apiToken) {
      // Check if token exists but is inactive (need raw lookup)
      // For now, we'll use a simple heuristic: if format is valid but not found, it could be inactive
      // This is a limitation of the current interface - in production, we'd want a separate method
      return {
        valid: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Token not found or inactive",
        },
      };
    }

    // 5. Check if token is active (double-check, though storage should already filter)
    if (!apiToken.isActive) {
      return {
        valid: false,
        error: {
          code: "INACTIVE_TOKEN",
          message: "Token has been revoked or deactivated",
        },
      };
    }

    // 6. Check expiry
    if (apiToken.expiresAt && apiToken.expiresAt.getTime() < Date.now()) {
      return {
        valid: false,
        error: {
          code: "EXPIRED_TOKEN",
          message: `Token expired at ${apiToken.expiresAt.toISOString()}`,
        },
      };
    }

    // 7. Check rate limits
    const rateLimitResult = await this.rateLimiter.check(apiToken.id, {
      perMinute: apiToken.requestsPerMinute,
      perDay: apiToken.requestsPerDay,
    });

    if (!rateLimitResult.allowed) {
      return {
        valid: false,
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded. Try again after ${rateLimitResult.resetAt.toISOString()}`,
          details: {
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
            limit: rateLimitResult.limit,
          },
        },
      };
    }

    // 8. Update lastUsedAt
    await this.storage.touchToken(apiToken.id);

    // 9. Return success with context
    return {
      valid: true,
      context: {
        tokenId: apiToken.id,
        userId: apiToken.userId,
        tier: apiToken.tier,
        metadata: apiToken.metadata,
      },
    };
  }

  /**
   * Extract bearer token from Authorization header
   * Supports case-insensitive "Bearer" prefix
   */
  private extractToken(authHeader: string | null | undefined): string | null {
    if (!authHeader || typeof authHeader !== "string") {
      return null;
    }

    const trimmed = authHeader.trim();
    if (!trimmed) {
      return null;
    }

    // Check for Bearer prefix (case-insensitive)
    const bearerPrefix = /^bearer\s+/i;
    if (!bearerPrefix.test(trimmed)) {
      return null;
    }

    // Extract token after "Bearer "
    const token = trimmed.replace(bearerPrefix, "").trim();
    if (!token) {
      return null;
    }

    return token;
  }

  /**
   * Validate token format (delegates to tokens module)
   */
  private isValidTokenFormat(token: string): boolean {
    return validateTokenFormat(token);
  }
}

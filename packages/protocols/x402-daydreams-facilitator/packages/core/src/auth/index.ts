/**
 * Authentication module exports
 */

// Configuration
export { createAuthConfig } from "./config.js";
export type { AuthConfig } from "./config.js";

// Token utilities
export { generateToken, hashToken, validateTokenFormat } from "./tokens.js";

// Storage
export { InMemoryTokenStorage } from "./storage/memory.js";
export type {
  ApiToken,
  CreateTokenInput,
  TokenStorage,
} from "./storage/interface.js";

// Rate limiting
export { InMemoryRateLimiter } from "./rate-limit/memory.js";
export type {
  RateLimitConfig,
  RateLimitResult,
  RateLimiter,
} from "./rate-limit/interface.js";

// Usage tracking
export { InMemoryUsageTracker } from "./tracking/memory.js";
export type {
  UsageRecord,
  UsageStats,
  UsageTracker,
} from "./tracking/interface.js";

// Validator
export { BearerTokenValidator } from "./validator.js";
export type { AuthContext, ValidationResult } from "./validator.js";

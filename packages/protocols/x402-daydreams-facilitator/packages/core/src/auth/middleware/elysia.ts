import { Elysia } from "elysia";
import { BearerTokenValidator } from "../validator.js";
import { InMemoryTokenStorage } from "../storage/memory.js";
import { InMemoryRateLimiter } from "../rate-limit/memory.js";
import { InMemoryUsageTracker } from "../tracking/memory.js";
import type { AuthContext } from "../validator.js";
import type { TokenStorage } from "../storage/interface.js";
import type { RateLimiter } from "../rate-limit/interface.js";
import type { UsageTracker } from "../tracking/interface.js";

/**
 * Configuration for auth plugin
 */
export interface AuthPluginConfig {
  enabled?: boolean;
  storage?: TokenStorage;
  rateLimiter?: RateLimiter;
  tracker?: UsageTracker;
}

/**
 * Create Elysia authentication plugin
 *
 * @param config - Plugin configuration
 * @returns Elysia plugin instance
 *
 * @example
 * ```typescript
 * const app = new Elysia()
 *   .use(createAuthPlugin({ enabled: true }))
 *   .get('/protected', (ctx) => {
 *     return { user: ctx.auth.userId };
 *   });
 * ```
 */
export function createAuthPlugin(config: AuthPluginConfig = {}) {
  const enabled = config.enabled !== false; // Default to enabled
  const storage = config.storage || new InMemoryTokenStorage();
  const rateLimiter = config.rateLimiter || new InMemoryRateLimiter();
  const tracker = config.tracker || new InMemoryUsageTracker();
  const validator = new BearerTokenValidator(storage, rateLimiter);

  return new Elysia({ name: "auth" })
    .decorate("auth", null as AuthContext | null)
    .onBeforeHandle(async ({ request, set }) => {
      // Skip auth if disabled
      if (!enabled) {
        return;
      }

      const startTime = Date.now();
      const authHeader = request.headers.get("authorization");
      const result = await validator.validate(authHeader);

      if (!result.valid) {
        // Track failed authentication
        if (tracker && result.error) {
          await tracker.track({
            tokenId: "anonymous",
            endpoint: new URL(request.url).pathname,
            method: request.method,
            statusCode: 401,
            success: false,
            errorMessage: result.error.message,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date(),
          });
        }

        set.status = 401;
        return {
          error: "Unauthorized",
          message: result.error?.message || "Authentication required",
          code: result.error?.code,
        };
      }

      // Success - attach auth context
      (request as any).auth = result.context;

      // Increment rate limiter
      if (result.context) {
        await rateLimiter.increment(result.context.tokenId);
      }

      // Note: Usage tracking happens in onAfterHandle to capture response details
    })
    .onAfterHandle(async ({ request, response, set }) => {
      if (!enabled || !tracker) {
        return;
      }

      const auth = (request as any).auth as AuthContext | undefined;
      if (!auth) {
        return; // Not authenticated
      }

      const startTime = (request as any)._startTime || Date.now();
      const responseTime = Date.now() - startTime;

      const statusCode = typeof set.status === 'number' ? set.status : 200;

      await tracker.track({
        tokenId: auth.tokenId,
        endpoint: new URL(request.url).pathname,
        method: request.method,
        statusCode,
        success: statusCode < 400,
        responseTimeMs: responseTime,
        timestamp: new Date(),
      });
    })
    .derive(({ request }) => {
      // Make auth context available to route handlers
      return {
        auth: (request as any).auth as AuthContext | null,
      };
    });
}

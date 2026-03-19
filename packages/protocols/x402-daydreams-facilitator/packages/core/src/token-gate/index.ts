// Core exports
export {
  createTokenGateChecker,
  type TokenGateChecker,
} from "./checker.js";

export {
  createTokenGateMiddleware,
  type TokenGateMiddlewareConfig,
  type TokenGateMiddlewareResult,
} from "./middleware.js";

// Types
export type {
  TokenRequirement,
  TokenGateConfig,
  TokenGateResult,
  TokenGateCacheEntry,
  TokenGateCacheKey,
  TokenGateCache,
} from "./types.js";

// Cache implementations
export { InMemoryTokenGateCache } from "./cache/memory.js";

// Framework middlewares
export { elysiaTokenGate } from "./elysia.js";
export { honoTokenGate } from "./hono.js";
export { expressTokenGate } from "./express.js";

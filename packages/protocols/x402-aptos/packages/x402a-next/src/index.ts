export {
  DEFAULT_FACILITATOR_CONFIG,
  DEFAULT_NETWORK,
  DEFAULT_SCHEME,
  DEFAULT_TIMEOUT,
  DEFAULT_X402_VERSION,
} from "./config/defaults";
export {
  createPaymentMiddleware,
  createSupportedHandler,
} from "./middleware";

export type {
  AptosPaymentPayloadData,
  PaymentPayload,
  PaymentRequirements,
} from "./middleware/protocol";

export {
  X402_HEADER,
  X402_RESPONSE_HEADER,
  X402_VERSION,
} from "./middleware/protocol";
export type {
  FacilitatorConfig,
  MiddlewareConfig,
  PaymentContext,
  RouteConfig,
  VerificationResult,
} from "./types";
export type { LogLevel } from "./utils/logger";
export {
  createLogger,
  generateCorrelationId,
  logger,
} from "./utils/logger";
export type { SecurityHeadersConfig } from "./utils/security-headers";
export {
  applySecurityHeaders,
  createSecurityHeadersMiddleware,
  DEV_SECURITY,
  getSecurityHeaders,
  STRICT_SECURITY,
} from "./utils/security-headers";

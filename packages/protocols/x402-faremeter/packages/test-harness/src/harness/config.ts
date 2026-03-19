import type { FacilitatorHandler } from "@faremeter/types/facilitator";
import type { PaymentHandlerV1 } from "@faremeter/types/client";
import type { x402PaymentRequirements } from "@faremeter/types/x402";
import type { SupportedVersionsConfig } from "@faremeter/middleware/common";
import type { Interceptor } from "../interceptors/types";

/**
 * How the middleware handles payment verification and settlement.
 *
 * - `"settle-only"` - Skip verification, settle directly (faster tests).
 * - `"verify-then-settle"` - Verify payment before settling (more realistic).
 */
export type SettleMode = "settle-only" | "verify-then-settle";

/**
 * Configuration for {@link TestHarness}.
 */
export type TestHarnessConfig = {
  /**
   * Payment requirements the middleware accepts.
   * Uses Partial because the facilitator will fill in missing fields.
   */
  accepts: Partial<x402PaymentRequirements>[];

  /**
   * Facilitator handlers to register.
   * Multiple handlers can be provided for different schemes.
   */
  facilitatorHandlers: FacilitatorHandler[];

  /**
   * Client payment handlers (v1).
   * Internally adapted to v2 for use with the fetch client.
   * Multiple handlers can be provided for different schemes.
   */
  clientHandlers: PaymentHandlerV1[];

  /**
   * Settlement mode for the middleware.
   * @default "settle-only"
   */
  settleMode?: SettleMode;

  /**
   * Protocol versions the middleware should support.
   * Passed through to middleware without modification.
   */
  supportedVersions?: SupportedVersionsConfig;

  /**
   * Interceptors between test code and middleware.
   * These see all requests from the wrapped fetch to the Hono app.
   */
  clientInterceptors?: Interceptor[];

  /**
   * Interceptors between middleware and facilitator.
   * These see requests from middleware to facilitator endpoints.
   */
  middlewareInterceptors?: Interceptor[];
};

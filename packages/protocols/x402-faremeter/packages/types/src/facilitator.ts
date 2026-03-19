import type {
  x402PaymentRequirements,
  x402SettleResponse,
  x402PaymentPayload,
  x402SupportedKind,
  x402VerifyResponse,
  x402ResourceInfo,
} from "./x402v2";

/**
 * Arguments passed to the facilitator's getRequirements method.
 */
export interface GetRequirementsArgs {
  /** Payment requirements the server is willing to accept */
  accepts: x402PaymentRequirements[];
  /** Optional resource information for the protected content */
  resource?: x402ResourceInfo;
}

/**
 * Handler interface implemented by payment scheme facilitators.
 *
 * Each method returns null when the request doesn't match the handler's
 * payment scheme, allowing multiple handlers to be composed.
 */
export interface FacilitatorHandler {
  /** Returns the payment schemes this handler supports */
  getSupported?: () => Promise<x402SupportedKind>[];
  /** Filters and enriches payment requirements this handler can process */
  getRequirements: (
    args: GetRequirementsArgs,
  ) => Promise<x402PaymentRequirements[]>;
  /** Verifies a payment without settling it (optional) */
  handleVerify?: (
    requirements: x402PaymentRequirements,
    payment: x402PaymentPayload,
  ) => Promise<x402VerifyResponse | null>;
  /** Settles a payment by executing the on-chain transaction */
  handleSettle: (
    requirements: x402PaymentRequirements,
    payment: x402PaymentPayload,
  ) => Promise<x402SettleResponse | null>;
  /** Returns signer addresses organized by network (optional) */
  getSigners?: () => Promise<Record<string, string[]>>;
}

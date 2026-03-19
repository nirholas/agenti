import type { x402PaymentRequirements as x402PaymentRequirementsV1 } from "./x402";
import type { x402PaymentRequirements } from "./x402v2";
import {
  adaptRequirementsV1ToV2,
  adaptRequirementsV2ToV1,
  type NetworkTranslator,
} from "./x402-adapters";

export type RequestContext = {
  request: RequestInfo | URL;
};

export type PaymentExecResult = {
  payload: object;
};

/**
 * Payment execer - the primary interface for payment execution.
 * Uses requirements with the `amount` field.
 */
export type PaymentExecer = {
  requirements: x402PaymentRequirements;
  exec(): Promise<PaymentExecResult>;
};

/**
 * Payment handler - the primary interface for payment handlers.
 * Receives requirements and returns execers.
 */
export type PaymentHandler = (
  context: RequestContext,
  accepts: x402PaymentRequirements[],
) => Promise<PaymentExecer[]>;

/**
 * V1 requirements with mimeType guaranteed to be a string.
 * Used for compatibility with legacy handlers that expect mimeType to be required.
 */
type x402PaymentRequirementsV1Strict = x402PaymentRequirementsV1 & {
  mimeType: string;
};

/**
 * @deprecated Use PaymentExecer instead
 */
export type PaymentExecerV1 = {
  requirements: x402PaymentRequirementsV1;
  exec(): Promise<PaymentExecResult>;
};

/**
 * Legacy payment execer type for handlers that expect mimeType to be required.
 * @deprecated Use PaymentExecer instead
 */
type PaymentExecerV1Strict = {
  requirements: x402PaymentRequirementsV1Strict;
  exec(): Promise<PaymentExecResult>;
};

/**
 * @deprecated Use PaymentHandler instead
 */
export type PaymentHandlerV1 = (
  context: RequestContext,
  accepts: x402PaymentRequirementsV1[],
) => Promise<PaymentExecerV1[]>;

/**
 * Legacy payment handler type for handlers that expect mimeType to be required.
 * @deprecated Use PaymentHandler instead
 */
type PaymentHandlerV1Strict = (
  context: RequestContext,
  accepts: x402PaymentRequirementsV1Strict[],
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- deprecated type for compatibility
) => Promise<PaymentExecerV1Strict[]>;

/**
 * Adapt a v1 PaymentHandlerV1 to the PaymentHandler interface.
 *
 * This allows existing v1 payment handlers to be used with v2 infrastructure.
 * Requirements are converted from v2 to v1 before being passed to the handler,
 * and the resulting execers are wrapped to convert requirements back to v2.
 *
 * Accepts both spec-compliant handlers (with optional mimeType) and legacy
 * handlers (with required mimeType) for backwards compatibility.
 *
 * @param handler - The v1 payment handler to adapt
 * @param translateNetwork - Function to translate legacy network IDs to CAIP-2
 */
export function adaptPaymentHandlerV1ToV2(
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- adapter for legacy v1 handlers
  handler: PaymentHandlerV1 | PaymentHandlerV1Strict,
  translateNetwork: NetworkTranslator,
): PaymentHandler {
  return async (
    context: RequestContext,
    accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecer[]> => {
    // Convert v2 requirements to v1 for the handler
    // adaptRequirementsV2ToV1 always provides mimeType as a string
    const v1Accepts = accepts.map((req) =>
      adaptRequirementsV2ToV1(req, { url: "" }),
    );

    // Call the v1 handler - v1Accepts has mimeType: string so it works with both
    // PaymentHandlerV1 and PaymentHandlerV1Strict
    const v1Execers = await handler(context, v1Accepts);

    // Wrap v1 execers to return v2 requirements
    return v1Execers.map((execer) => ({
      requirements: adaptRequirementsV1ToV2(
        execer.requirements,
        translateNetwork,
      ),
      exec: () => execer.exec(),
    }));
  };
}

/**
 * Adapt a PaymentHandler to the v1 PaymentHandlerV1 interface.
 *
 * This allows v2 payment handlers to be used with v1 infrastructure.
 *
 * @param handler - The v2 payment handler to adapt
 * @param translateNetwork - Function to translate legacy network IDs to CAIP-2
 */
export function adaptPaymentHandlerV2ToV1(
  handler: PaymentHandler,
  translateNetwork: NetworkTranslator,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- adapter for legacy v1 handlers
): PaymentHandlerV1 {
  return async (
    context: RequestContext,
    accepts: x402PaymentRequirementsV1[],
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- adapter for legacy v1 handlers
  ): Promise<PaymentExecerV1[]> => {
    // Convert v1 requirements to v2 for the handler
    const v2Accepts = accepts.map((req) =>
      adaptRequirementsV1ToV2(req, translateNetwork),
    );

    // Call the v2 handler
    const v2Execers = await handler(context, v2Accepts);

    // Wrap v2 execers to return v1 requirements
    return v2Execers.map((execer) => ({
      requirements: adaptRequirementsV2ToV1(execer.requirements, { url: "" }),
      exec: () => execer.exec(),
    }));
  };
}

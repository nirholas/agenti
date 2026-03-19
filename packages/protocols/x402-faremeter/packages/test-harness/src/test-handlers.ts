/* eslint-disable @typescript-eslint/no-deprecated -- v1 test harness uses v1 types */
import type {
  PaymentHandlerV1,
  PaymentExecerV1,
  RequestContext,
} from "@faremeter/types/client";
import type { FacilitatorHandler } from "@faremeter/types/facilitator";
import type { x402PaymentRequirements as x402PaymentRequirementsV1 } from "@faremeter/types/x402";
import type {
  x402PaymentRequirements,
  x402SupportedKind,
} from "@faremeter/types/x402v2";
import { isMatchingRequirement } from "./scheme/constants";

export { isMatchingRequirement };

/**
 * Creates a payment handler that returns no matching execers.
 * Useful for testing "no handler matches" scenarios.
 */
export function createNonMatchingHandler(): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    _accepts: x402PaymentRequirementsV1[],
  ): Promise<PaymentExecerV1[]> => {
    return [];
  };
}

/**
 * Creates a payment handler that throws during the match phase.
 */
export function createThrowingHandler(message: string): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    _accepts: x402PaymentRequirementsV1[],
  ): Promise<PaymentExecerV1[]> => {
    throw new Error(message);
  };
}

/**
 * Creates a payment handler that throws during exec().
 */
export function createThrowingExecHandler(message: string): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirementsV1[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => {
        throw new Error(message);
      },
    }));
  };
}

/**
 * Creates a payment handler that returns null payload.
 */
export function createNullPayloadHandler(): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirementsV1[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => {
        // Intentionally passing null to test error handling for invalid payloads
        return { payload: null as unknown as object };
      },
    }));
  };
}

/**
 * Creates a payment handler that returns an empty payload object.
 */
export function createEmptyPayloadHandler(): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirementsV1[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => {
        return { payload: {} };
      },
    }));
  };
}

/**
 * Creates a payment handler that works correctly.
 * Useful for fallback testing scenarios.
 */
export function createWorkingHandler(): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirementsV1[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => ({
        payload: {
          testId: "test-123",
          amount: requirements.maxAmountRequired,
          timestamp: Date.now(),
        },
      }),
    }));
  };
}

/**
 * Creates a payment handler with a custom payload factory.
 * Useful for testing invalid/edge-case payloads.
 */
export function createInvalidPayloadHandler(
  payloadFactory: (requirements: x402PaymentRequirementsV1) => object,
): PaymentHandlerV1 {
  return async (
    _context: RequestContext,
    accepts: x402PaymentRequirementsV1[],
  ): Promise<PaymentExecerV1[]> => {
    return accepts.filter(isMatchingRequirement).map((requirements) => ({
      requirements,
      exec: async () => ({
        payload: payloadFactory(requirements),
      }),
    }));
  };
}

/**
 * Options for creating a simple facilitator handler.
 */
export type CreateSimpleFacilitatorHandlerOpts = {
  /** Network identifier for settle responses. */
  networkId: string;
  /** Optional function returning supported payment kinds. */
  getSupported?: () => Promise<x402SupportedKind>[];
};

/**
 * Creates a minimal facilitator handler for testing.
 * Useful for testing /supported endpoint behavior.
 */
export function createSimpleFacilitatorHandler(
  opts: CreateSimpleFacilitatorHandlerOpts,
): FacilitatorHandler {
  const base = {
    getRequirements: ({
      accepts: req,
    }: {
      accepts: x402PaymentRequirements[];
    }): Promise<x402PaymentRequirements[]> => Promise.resolve(req),
    handleSettle: () =>
      Promise.resolve({
        success: true,
        transaction: "test-tx",
        network: opts.networkId,
        payer: "test-payer",
      }),
  };

  if (opts.getSupported) {
    return { ...base, getSupported: opts.getSupported };
  }
  return base;
}

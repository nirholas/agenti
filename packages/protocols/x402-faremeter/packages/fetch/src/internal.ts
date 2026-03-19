import {
  type PaymentExecer,
  type RequestContext,
  type PaymentHandler,
} from "@faremeter/types/client";

import {
  x402PaymentRequiredResponseLenient as x402PaymentRequiredResponseV1,
  type x402PaymentPayload as x402PaymentPayloadV1,
  X_PAYMENT_HEADER,
} from "@faremeter/types/x402";

import {
  x402PaymentRequiredResponse,
  type x402PaymentPayload,
  type x402PaymentRequirements,
  type x402ResourceInfo,
  V2_PAYMENT_HEADER,
  V2_PAYMENT_REQUIRED_HEADER,
} from "@faremeter/types/x402v2";

import { isValidationError, throwValidationError } from "@faremeter/types";

import { adaptRequirementsV1ToV2 } from "@faremeter/types/x402-adapters";
import { normalizeNetworkId, translateNetworkToLegacy } from "@faremeter/info";

export { X_PAYMENT_HEADER, V2_PAYMENT_HEADER, V2_PAYMENT_REQUIRED_HEADER };

export type DetectedVersion = 1 | 2;

/**
 * Default payer chooser that selects the first available payment execer.
 *
 * @param possiblePayers - Array of payment execers that can handle the requirements
 * @returns The first execer in the array
 */
export function chooseFirstAvailable(
  possiblePayers: PaymentExecer[],
): PaymentExecer {
  if (possiblePayers.length < 1) {
    throw new Error("no applicable payers found");
  }

  const payer = possiblePayers[0];

  if (payer === undefined) {
    throw new Error("undefined payer found");
  }

  return payer;
}

/**
 * Options for processing a 402 Payment Required response.
 */
export type ProcessPaymentRequiredResponseOpts = {
  /** Payment handlers that produce execers for payment requirements. */
  handlers: PaymentHandler[];
  /** Optional function to select among multiple possible payers. Defaults to chooseFirstAvailable. */
  payerChooser?: (execer: PaymentExecer[]) => Promise<PaymentExecer>;
};

/**
 * Result of processing a 402 Payment Required response.
 */
export type ProcessPaymentRequiredResponseResult = {
  /** The selected payment execer. */
  payer: PaymentExecer;
  /** The result from executing the payment. */
  payerResult: { payload: object };
  /** The payment payload in the detected protocol version format. */
  paymentPayload: x402PaymentPayload | x402PaymentPayloadV1;
  /** Base64-encoded payment header ready to attach to the retry request. */
  paymentHeader: string;
  /** The detected protocol version (1 or 2). */
  detectedVersion: DetectedVersion;
};

/**
 * Process a 402 Payment Required response, auto-detecting v1 or v2 protocol.
 *
 * @param ctx - Request context
 * @param response - The 402 Response object (must not have been consumed)
 * @param options - Processing options including payment handlers
 * @returns Payment information including header and detected version
 */
export async function processPaymentRequiredResponse(
  ctx: RequestContext,
  response: Response,
  options: ProcessPaymentRequiredResponseOpts,
): Promise<ProcessPaymentRequiredResponseResult> {
  const payerChooser = options.payerChooser ?? chooseFirstAvailable;

  // Detect version from response structure
  const paymentRequiredHeader = response.headers.get(
    V2_PAYMENT_REQUIRED_HEADER,
  );

  let detectedVersion: DetectedVersion;
  let v2Accepts: x402PaymentRequirements[];
  let v2ResourceInfo: x402ResourceInfo | null = null;

  if (paymentRequiredHeader) {
    // V2: decode from header
    detectedVersion = 2;

    let decoded: unknown;
    try {
      decoded = JSON.parse(atob(paymentRequiredHeader));
    } catch {
      throw new Error("failed to decode PAYMENT-REQUIRED header");
    }

    const payResp = x402PaymentRequiredResponse(decoded);
    if (isValidationError(payResp)) {
      throwValidationError(
        "couldn't parse v2 payment required response",
        payResp,
      );
    }

    v2Accepts = payResp.accepts;
    v2ResourceInfo = payResp.resource;
  } else {
    // V1: parse from body
    detectedVersion = 1;

    const payResp = x402PaymentRequiredResponseV1(await response.json());
    if (isValidationError(payResp)) {
      throwValidationError(
        "couldn't parse v1 payment required response",
        payResp,
      );
    }

    // Convert v1 accepts to v2 for PaymentHandler interface
    v2Accepts = payResp.accepts.map((req) =>
      adaptRequirementsV1ToV2(req, normalizeNetworkId),
    );
  }

  // Find payers using v2 requirements (PaymentHandler interface)
  const possiblePayers: PaymentExecer[] = [];
  for (const h of options.handlers) {
    possiblePayers.push(...(await h(ctx, v2Accepts)));
  }

  const payer = await payerChooser(possiblePayers);
  const payerResult = await payer.exec();

  // Build payment payload in the detected version's format
  let paymentPayload: x402PaymentPayload | x402PaymentPayloadV1;

  if (detectedVersion === 2) {
    const v2Payload: x402PaymentPayload = {
      x402Version: 2,
      accepted: payer.requirements,
      payload: payerResult.payload,
    };
    if (v2ResourceInfo) {
      v2Payload.resource = v2ResourceInfo;
    }
    paymentPayload = v2Payload;
  } else {
    // Translate network back to legacy format for v1 payload
    const v1Payload: x402PaymentPayloadV1 = {
      x402Version: 1,
      scheme: payer.requirements.scheme,
      network: translateNetworkToLegacy(payer.requirements.network),
      asset: payer.requirements.asset,
      payload: payerResult.payload,
    };
    paymentPayload = v1Payload;
  }

  const paymentHeader = btoa(JSON.stringify(paymentPayload));

  return {
    payer,
    payerResult,
    paymentPayload,
    paymentHeader,
    detectedVersion,
  };
}

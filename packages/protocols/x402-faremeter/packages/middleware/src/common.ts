import { isValidationError } from "@faremeter/types";
import {
  type x402PaymentRequirements as x402PaymentRequirementsV1,
  type x402PaymentPayload as x402PaymentPayloadV1,
  type x402VerifyResponse as x402VerifyResponseV1,
  type x402PaymentRequiredResponse as x402PaymentRequiredResponseV1,
  x402PaymentRequiredResponseLenient,
  normalizePaymentRequiredResponse,
  x402PaymentHeaderToPayload as x402PaymentHeaderToPayloadV1,
  x402VerifyRequest as x402VerifyRequestV1,
  x402VerifyResponseLenient,
  normalizeVerifyResponse,
  x402SettleRequest as x402SettleRequestV1,
  x402SettleResponse as x402SettleResponseV1,
  x402SettleResponseLenient,
  normalizeSettleResponse,
  X_PAYMENT_HEADER,
  X_PAYMENT_RESPONSE_HEADER,
} from "@faremeter/types/x402";
import {
  type x402PaymentRequirements,
  type x402PaymentPayload,
  type x402ResourceInfo,
  x402PaymentRequiredResponse,
  x402PaymentHeaderToPayload,
  x402VerifyRequest,
  x402VerifyResponse,
  x402SettleRequest,
  x402SettleResponse,
  V2_PAYMENT_HEADER,
  V2_PAYMENT_REQUIRED_HEADER,
  V2_PAYMENT_RESPONSE_HEADER,
} from "@faremeter/types/x402v2";
import {
  adaptPaymentRequiredResponseV1ToV2,
  adaptPaymentRequiredResponseV2ToV1,
} from "@faremeter/types/x402-adapters";
import { normalizeNetworkId } from "@faremeter/info";
import { type AgedLRUCacheOpts, AgedLRUCache } from "./cache";

import { logger } from "./logger";

/**
 * Build the X-PAYMENT-RESPONSE header value from a settle response.
 *
 * The header uses spec-compliant field names: `transaction`, `network`,
 * and `errorReason`.
 */
function buildPaymentResponseHeader(
  settlementResponse: x402SettleResponse,
): string {
  const headerPayload: {
    success: boolean;
    transaction: string;
    network: string;
    payer?: string;
    errorReason?: string | null;
  } = {
    success: settlementResponse.success,
    transaction: settlementResponse.transaction ?? "",
    network: settlementResponse.network ?? "",
  };

  if (settlementResponse.payer !== undefined) {
    headerPayload.payer = settlementResponse.payer;
  }

  if (
    !settlementResponse.success &&
    settlementResponse.errorReason !== undefined
  ) {
    headerPayload.errorReason = settlementResponse.errorReason;
  }

  return btoa(JSON.stringify(headerPayload));
}

type MatchCriteria = {
  scheme: string;
  network: string;
  asset?: string;
};

function findMatching<R extends MatchCriteria>(
  accepts: R[],
  criteria: MatchCriteria,
  label: string,
  payload: Record<string, unknown>,
): R | undefined {
  const possible =
    criteria.asset !== undefined
      ? accepts.filter(
          (x) =>
            x.network === criteria.network &&
            x.scheme === criteria.scheme &&
            x.asset === criteria.asset,
        )
      : accepts.filter(
          (x) => x.network === criteria.network && x.scheme === criteria.scheme,
        );

  if (possible.length > 1) {
    logger.warning(
      `found ${possible.length} ambiguous matching requirements for ${label} client payment`,
      payload,
    );
  }

  // XXX - If there are more than one, this really should be an error.
  // For now, err on the side of potential compatibility.
  return possible[0];
}

/**
 * Finds the payment requirement that matches the client's v1 payment payload.
 *
 * @param accepts - Array of accepted payment requirements from the facilitator
 * @param payload - The client's payment payload
 * @returns The matching requirement, or undefined if no match found
 */
export function findMatchingPaymentRequirements(
  accepts: x402PaymentRequirementsV1[],
  payload: x402PaymentPayloadV1,
) {
  return findMatching(accepts, payload, "v1", payload);
}

/**
 * Finds the payment requirement that matches the client's v2 payment payload.
 *
 * @param accepts - Array of accepted payment requirements from the facilitator
 * @param payload - The client's v2 payment payload
 * @returns The matching requirement, or undefined if no match found
 */
export function findMatchingPaymentRequirementsV2(
  accepts: x402PaymentRequirements[],
  payload: x402PaymentPayload,
): x402PaymentRequirements | undefined {
  return findMatching(accepts, payload.accepted, "v2", payload);
}

/**
 * Validates that a facilitator response is successful, throwing if not.
 *
 * @param res - The Response from the facilitator
 */
export function gateGetPaymentRequiredResponse(res: Response) {
  if (res.status === 200) {
    return;
  }

  const msg = `received a non success response to requirements request from facilitator: ${res.statusText} (${res.status})`;

  logger.error(msg);
  throw new Error(msg);
}

export type RelaxedRequirements = Partial<x402PaymentRequirementsV1>;
export type RelaxedRequirementsV2 = Partial<x402PaymentRequirements>;

function relaxedRequirementsToV2(
  req: RelaxedRequirements,
): RelaxedRequirementsV2 {
  const result: RelaxedRequirementsV2 = {};
  if (req.scheme !== undefined) result.scheme = req.scheme;
  if (req.network !== undefined) result.network = req.network;
  if (req.maxAmountRequired !== undefined)
    result.amount = req.maxAmountRequired;
  if (req.asset !== undefined) result.asset = req.asset;
  if (req.payTo !== undefined) result.payTo = req.payTo;
  if (req.maxTimeoutSeconds !== undefined)
    result.maxTimeoutSeconds = req.maxTimeoutSeconds;
  if (req.extra !== undefined) result.extra = req.extra;
  return result;
}

/**
 * Parsed payment header result, discriminated by version.
 */
type ParsedPaymentHeader =
  | { version: 1; payload: x402PaymentPayloadV1; rawHeader: string }
  | { version: 2; payload: x402PaymentPayload; rawHeader: string };

/**
 * Parse a payment header from either v1 (X-PAYMENT) or v2 (PAYMENT-SIGNATURE).
 * Returns the parsed payload with version discriminant, or undefined if no valid header found.
 */
function parsePaymentHeader(
  getHeader: (key: string) => string | undefined,
): ParsedPaymentHeader | undefined {
  // Try v2 header first
  const v2Header = getHeader(V2_PAYMENT_HEADER);
  if (v2Header) {
    const v2Payload = x402PaymentHeaderToPayload(v2Header);
    if (!isValidationError(v2Payload)) {
      return { version: 2, payload: v2Payload, rawHeader: v2Header };
    }
    logger.debug(`couldn't validate v2 client payload: ${v2Payload.summary}`);
  }

  const v1Header = getHeader(X_PAYMENT_HEADER);
  if (v1Header) {
    const v1Payload = x402PaymentHeaderToPayloadV1(v1Header);
    if (!isValidationError(v1Payload)) {
      return { version: 1, payload: v1Payload, rawHeader: v1Header };
    }
    logger.debug(`couldn't validate v1 client payload: ${v1Payload.summary}`);
  }

  return undefined;
}

type getPaymentRequiredResponseArgs = {
  facilitatorURL: string;
  accepts: RelaxedRequirements[];
  resource: string;
  fetch?: typeof fetch;
};

/**
 * Fetches v1 payment requirements from the facilitator's /accepts endpoint.
 *
 * @param args - Arguments including facilitator URL and accepted payment types
 * @returns The validated payment required response from the facilitator
 */
export async function getPaymentRequiredResponse(
  args: getPaymentRequiredResponseArgs,
) {
  const fetchFn = args.fetch ?? fetch;
  const accepts = args.accepts.map((x) => ({
    ...x,
    resource: x.resource ?? args.resource,
  }));

  const t = await fetchFn(`${args.facilitatorURL}/accepts`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      x402Version: 1,
      accepts,
      error: "",
    }),
  });

  gateGetPaymentRequiredResponse(t);

  const rawResponse = x402PaymentRequiredResponseLenient(await t.json());

  if (isValidationError(rawResponse)) {
    throw new Error(
      `invalid payment requirements from facilitator: ${rawResponse.summary}`,
    );
  }

  return normalizePaymentRequiredResponse(rawResponse);
}

type getPaymentRequiredResponseV2Args = {
  facilitatorURL: string;
  accepts: RelaxedRequirementsV2[];
  resource: x402ResourceInfo;
  fetch?: typeof fetch;
};

/**
 * Fetches v2 payment requirements from the facilitator's /accepts endpoint.
 *
 * @param args - Arguments including facilitator URL, resource info, and accepted payment types
 * @returns The validated v2 payment required response from the facilitator
 */
export async function getPaymentRequiredResponseV2(
  args: getPaymentRequiredResponseV2Args,
) {
  const fetchFn = args.fetch ?? fetch;

  const t = await fetchFn(`${args.facilitatorURL}/accepts`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      x402Version: 2,
      resource: args.resource,
      accepts: args.accepts,
    }),
  });

  gateGetPaymentRequiredResponse(t);

  const response = x402PaymentRequiredResponse(await t.json());

  if (isValidationError(response)) {
    throw new Error(
      `invalid v2 payment requirements from facilitator: ${response.summary}`,
    );
  }

  return response;
}

type PossibleStatusCodes = 400 | 402;
type PossibleJSONResponse = object;

/**
 * Configuration for which x402 protocol versions the middleware supports.
 * At least one version must be enabled.
 */
export type SupportedVersionsConfig = {
  /** Support x402 v1 protocol (JSON body responses, X-PAYMENT header). Default: true */
  x402v1?: boolean;
  /** Support x402 v2 protocol (PAYMENT-REQUIRED header, PAYMENT-SIGNATURE header). Default: false */
  x402v2?: boolean;
};

/**
 * Resolve and validate supported versions config.
 * Returns resolved config with defaults applied.
 * Throws if configuration is invalid.
 */
export function resolveSupportedVersions(
  config?: SupportedVersionsConfig,
): Required<SupportedVersionsConfig> {
  const resolved = {
    x402v1: config?.x402v1 ?? true,
    x402v2: config?.x402v2 ?? false,
  };

  if (!resolved.x402v1 && !resolved.x402v2) {
    throw new Error(
      "Invalid supportedVersions configuration: at least one protocol version must be enabled",
    );
  }

  return resolved;
}

/**
 * Common configuration arguments shared by all middleware implementations.
 */
export type CommonMiddlewareArgs = {
  /** URL of the facilitator service. */
  facilitatorURL: string;
  /** Payment requirements this endpoint accepts. Can be flat or nested arrays. */
  accepts: (RelaxedRequirements | RelaxedRequirements[])[];
  /** Optional cache configuration for payment requirements responses. */
  cacheConfig?: createPaymentRequiredResponseCacheOpts;
  /** Which x402 protocol versions to support. */
  supportedVersions?: SupportedVersionsConfig;
};

export type SettleResultV1<MiddlewareResponse> =
  | { success: true; facilitatorResponse: x402SettleResponseV1 }
  | { success: false; errorResponse: MiddlewareResponse };

export type SettleResultV2<MiddlewareResponse> =
  | { success: true; facilitatorResponse: x402SettleResponse }
  | { success: false; errorResponse: MiddlewareResponse };

export type SettleResult<MiddlewareResponse> =
  | SettleResultV1<MiddlewareResponse>
  | SettleResultV2<MiddlewareResponse>;

export type VerifyResultV1<MiddlewareResponse> =
  | { success: true; facilitatorResponse: x402VerifyResponseV1 }
  | { success: false; errorResponse: MiddlewareResponse };

export type VerifyResultV2<MiddlewareResponse> =
  | { success: true; facilitatorResponse: x402VerifyResponse }
  | { success: false; errorResponse: MiddlewareResponse };

export type VerifyResult<MiddlewareResponse> =
  | VerifyResultV1<MiddlewareResponse>
  | VerifyResultV2<MiddlewareResponse>;

/**
 * Context provided to the middleware body handler for v1 protocol requests.
 * Contains payment information and functions to verify or settle the payment.
 */
export type MiddlewareBodyContextV1<MiddlewareResponse> = {
  protocolVersion: 1;
  paymentRequirements: x402PaymentRequirementsV1;
  paymentPayload: x402PaymentPayloadV1;
  settle: () => Promise<SettleResultV1<MiddlewareResponse>>;
  verify: () => Promise<VerifyResultV1<MiddlewareResponse>>;
};

/**
 * Context provided to the middleware body handler for v2 protocol requests.
 * Contains payment information and functions to verify or settle the payment.
 */
export type MiddlewareBodyContextV2<MiddlewareResponse> = {
  protocolVersion: 2;
  paymentRequirements: x402PaymentRequirements;
  paymentPayload: x402PaymentPayload;
  settle: () => Promise<SettleResultV2<MiddlewareResponse>>;
  verify: () => Promise<VerifyResultV2<MiddlewareResponse>>;
};

/**
 * Context provided to the middleware body handler.
 * Use protocolVersion to discriminate between v1 and v2 request types.
 */
export type MiddlewareBodyContext<MiddlewareResponse> =
  | MiddlewareBodyContextV1<MiddlewareResponse>
  | MiddlewareBodyContextV2<MiddlewareResponse>;

/**
 * Arguments for the core middleware request handler.
 * Framework-specific middleware implementations adapt their request/response
 * objects to this interface.
 */
export type HandleMiddlewareRequestArgs<MiddlewareResponse = unknown> = Omit<
  CommonMiddlewareArgs,
  "supportedVersions"
> & {
  /** The resource URL being accessed. */
  resource: string;
  /** Function to retrieve a request header value. */
  getHeader: (key: string) => string | undefined;
  /** Function to fetch v1 payment requirements from the facilitator. */
  getPaymentRequiredResponse: typeof getPaymentRequiredResponse;
  /** Optional function to fetch v2 payment requirements from the facilitator. */
  getPaymentRequiredResponseV2?: typeof getPaymentRequiredResponseV2;
  /** Resolved supported versions configuration. */
  supportedVersions: Required<SupportedVersionsConfig>;
  /** Function to send a JSON response with optional headers. */
  sendJSONResponse: (
    status: PossibleStatusCodes,
    body?: PossibleJSONResponse,
    headers?: Record<string, string>,
  ) => MiddlewareResponse;
  /** Handler function called when a valid payment is received. */
  body: (
    context: MiddlewareBodyContext<MiddlewareResponse>,
  ) => Promise<MiddlewareResponse | undefined>;
  /** Optional function to set a response header. */
  setResponseHeader?: (key: string, value: string) => void;
  /** Optional custom fetch function for facilitator requests. */
  fetch?: typeof fetch;
};

/**
 * Core middleware request handler that processes x402 payment flows.
 *
 * This function handles both v1 and v2 protocol versions, validates payment
 * headers, communicates with the facilitator, and delegates to the body
 * handler when payment is valid.
 *
 * @param args - Handler arguments including framework-specific adapters
 * @returns The middleware response, or undefined if the body handler should continue
 */
export async function handleMiddlewareRequest<MiddlewareResponse>(
  args: HandleMiddlewareRequestArgs<MiddlewareResponse>,
) {
  const accepts = args.accepts.flat();
  const fetchFn = args.fetch ?? fetch;
  const { supportedVersions } = args;

  // Fetch requirements in the highest supported version, adapt downward as needed.
  let v1Response: x402PaymentRequiredResponseV1 | undefined;
  let v2Response: x402PaymentRequiredResponse | undefined;

  if (supportedVersions.x402v2 && args.getPaymentRequiredResponseV2) {
    const firstAccept = accepts.find((a) => a.resource !== undefined);
    const resourceInfo: x402ResourceInfo = {
      url: firstAccept?.resource ?? args.resource,
    };
    if (firstAccept?.description) {
      resourceInfo.description = firstAccept.description;
    }
    if (firstAccept?.mimeType) {
      resourceInfo.mimeType = firstAccept.mimeType;
    }

    v2Response = await args.getPaymentRequiredResponseV2({
      accepts: accepts.map(relaxedRequirementsToV2),
      facilitatorURL: args.facilitatorURL,
      resource: resourceInfo,
      fetch: fetchFn,
    });
    if (supportedVersions.x402v1) {
      v1Response = adaptPaymentRequiredResponseV2ToV1(v2Response);
    }
  } else {
    v1Response = await args.getPaymentRequiredResponse({
      accepts,
      facilitatorURL: args.facilitatorURL,
      resource: args.resource,
      fetch: fetchFn,
    });
    if (supportedVersions.x402v2) {
      v2Response = adaptPaymentRequiredResponseV1ToV2(
        v1Response,
        args.resource,
        normalizeNetworkId,
      );
    }
  }

  const parsedHeader = parsePaymentHeader(args.getHeader);

  const sendPaymentRequired = (): MiddlewareResponse => {
    if (supportedVersions.x402v2 && v2Response) {
      const v2Headers = {
        [V2_PAYMENT_REQUIRED_HEADER]: btoa(JSON.stringify(v2Response)),
      };
      if (supportedVersions.x402v1 && v1Response) {
        return args.sendJSONResponse(402, v1Response, v2Headers);
      }
      return args.sendJSONResponse(
        402,
        v2Response.error ? { error: v2Response.error } : undefined,
        v2Headers,
      );
    }
    if (v1Response) {
      return args.sendJSONResponse(402, v1Response);
    }
    throw new Error("no payment required response available");
  };

  if (!parsedHeader) {
    return sendPaymentRequired();
  }

  if (parsedHeader.version === 2 && !supportedVersions.x402v2) {
    return args.sendJSONResponse(400, {
      error: "This server does not support x402 protocol version 2",
    });
  }

  if (parsedHeader.version === 1 && !supportedVersions.x402v1) {
    return args.sendJSONResponse(400, {
      error: "This server does not support x402 protocol version 1",
    });
  }

  if (parsedHeader.version === 2) {
    if (!v2Response) {
      throw new Error("v2 response unavailable for v2 request");
    }
    return handleV2Request(
      args,
      parsedHeader.payload,
      v2Response,
      sendPaymentRequired,
      fetchFn,
    );
  }

  if (!v1Response) {
    throw new Error("v1 response unavailable for v1 request");
  }
  return handleV1Request(
    args,
    parsedHeader.payload,
    parsedHeader.rawHeader,
    v1Response,
    sendPaymentRequired,
    fetchFn,
  );
}

/**
 * Handle v1 protocol request.
 */
async function handleV1Request<MiddlewareResponse>(
  args: HandleMiddlewareRequestArgs<MiddlewareResponse>,
  paymentPayload: x402PaymentPayloadV1,
  paymentHeader: string,
  paymentRequiredResponse: x402PaymentRequiredResponseV1,
  sendPaymentRequired: () => MiddlewareResponse,
  fetchFn: typeof fetch,
): Promise<MiddlewareResponse | undefined> {
  const paymentRequirements = findMatchingPaymentRequirements(
    paymentRequiredResponse.accepts,
    paymentPayload,
  );

  if (!paymentRequirements) {
    logger.warning(
      `couldn't find matching payment requirements for v1 payload`,
      paymentPayload,
    );
    return sendPaymentRequired();
  }

  const settle = async (): Promise<SettleResultV1<MiddlewareResponse>> => {
    const settleRequest: x402SettleRequestV1 = {
      paymentHeader,
      paymentPayload,
      paymentRequirements,
    };

    const t = await fetchFn(`${args.facilitatorURL}/settle`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      // x402Version is not part of the v1 spec but older Faremeter
      // facilitators require it, so include it for backwards compatibility.
      body: JSON.stringify({ x402Version: 1, ...settleRequest }),
    });
    // Parse with lenient type to accept both legacy and spec-compliant field names
    const rawSettlementResponse = x402SettleResponseLenient(await t.json());

    if (isValidationError(rawSettlementResponse)) {
      const msg = `error getting response from facilitator for settlement: ${rawSettlementResponse.summary}`;
      logger.error(msg);
      throw new Error(msg);
    }

    // Normalize to spec-compliant field names
    const settlementResponse = normalizeSettleResponse(rawSettlementResponse);

    // Set the X-PAYMENT-RESPONSE header for both success and failure
    if (args.setResponseHeader) {
      args.setResponseHeader(
        X_PAYMENT_RESPONSE_HEADER,
        buildPaymentResponseHeader(settlementResponse),
      );
    }

    if (!settlementResponse.success) {
      logger.warning(
        "failed to settle payment: {errorReason}",
        settlementResponse,
      );
      return { success: false, errorResponse: sendPaymentRequired() };
    }

    return { success: true, facilitatorResponse: settlementResponse };
  };

  const verify = async (): Promise<VerifyResultV1<MiddlewareResponse>> => {
    const verifyRequest: x402VerifyRequestV1 = {
      paymentHeader,
      paymentPayload,
      paymentRequirements,
    };

    const t = await fetchFn(`${args.facilitatorURL}/verify`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      // x402Version is not part of the v1 spec but older Faremeter
      // facilitators require it, so include it for backwards compatibility.
      body: JSON.stringify({ x402Version: 1, ...verifyRequest }),
    });
    const rawVerifyResponse = x402VerifyResponseLenient(await t.json());

    if (isValidationError(rawVerifyResponse)) {
      const msg = `error getting response from facilitator for verification: ${rawVerifyResponse.summary}`;
      logger.error(msg);
      throw new Error(msg);
    }

    const verifyResponse = normalizeVerifyResponse(rawVerifyResponse);

    if (!verifyResponse.isValid) {
      logger.warning(
        "failed to verify payment: {invalidReason}",
        verifyResponse,
      );
      return { success: false, errorResponse: sendPaymentRequired() };
    }

    return { success: true, facilitatorResponse: verifyResponse };
  };

  return await args.body({
    protocolVersion: 1,
    paymentRequirements,
    paymentPayload,
    settle,
    verify,
  });
}

/**
 * Handle v2 protocol request.
 */
async function handleV2Request<MiddlewareResponse>(
  args: HandleMiddlewareRequestArgs<MiddlewareResponse>,
  paymentPayload: x402PaymentPayload,
  paymentRequiredResponse: x402PaymentRequiredResponse,
  sendPaymentRequired: () => MiddlewareResponse,
  fetchFn: typeof fetch,
): Promise<MiddlewareResponse | undefined> {
  const paymentRequirements = findMatchingPaymentRequirementsV2(
    paymentRequiredResponse.accepts,
    paymentPayload,
  );

  if (!paymentRequirements) {
    logger.warning(
      `couldn't find matching payment requirements for v2 payload`,
      paymentPayload,
    );
    return sendPaymentRequired();
  }

  const settle = async (): Promise<SettleResultV2<MiddlewareResponse>> => {
    const settleRequest: x402SettleRequest = {
      paymentPayload,
      paymentRequirements,
    };

    const t = await fetchFn(`${args.facilitatorURL}/settle`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settleRequest),
    });
    const settlementResponse = x402SettleResponse(await t.json());

    if (isValidationError(settlementResponse)) {
      const msg = `error getting response from facilitator for v2 settlement: ${settlementResponse.summary}`;
      logger.error(msg);
      throw new Error(msg);
    }

    if (args.setResponseHeader) {
      args.setResponseHeader(
        V2_PAYMENT_RESPONSE_HEADER,
        btoa(JSON.stringify(settlementResponse)),
      );
    }

    if (!settlementResponse.success) {
      logger.warning(
        "failed to settle v2 payment: {errorReason}",
        settlementResponse,
      );
      return { success: false, errorResponse: sendPaymentRequired() };
    }

    return { success: true, facilitatorResponse: settlementResponse };
  };

  const verify = async (): Promise<VerifyResultV2<MiddlewareResponse>> => {
    const verifyRequest: x402VerifyRequest = {
      paymentPayload,
      paymentRequirements,
    };

    const t = await fetchFn(`${args.facilitatorURL}/verify`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verifyRequest),
    });
    const verifyResponse = x402VerifyResponse(await t.json());

    if (isValidationError(verifyResponse)) {
      const msg = `error getting response from facilitator for v2 verification: ${verifyResponse.summary}`;
      logger.error(msg);
      throw new Error(msg);
    }

    if (!verifyResponse.isValid) {
      logger.warning(
        "failed to verify v2 payment: {invalidReason}",
        verifyResponse,
      );
      return { success: false, errorResponse: sendPaymentRequired() };
    }

    return { success: true, facilitatorResponse: verifyResponse };
  };

  return await args.body({
    protocolVersion: 2,
    paymentRequirements,
    paymentPayload,
    settle,
    verify,
  });
}

/**
 * Configuration options for the payment requirements response cache.
 */
export type createPaymentRequiredResponseCacheOpts = AgedLRUCacheOpts & {
  /** If true, disables caching entirely. */
  disable?: boolean;
};

/**
 * Creates a cached wrapper around payment requirements fetching functions.
 *
 * The cache reduces load on the facilitator by reusing recent responses
 * for identical requirements.
 *
 * @param opts - Cache configuration options
 * @returns Object containing cached getPaymentRequiredResponse functions
 */
export function createPaymentRequiredResponseCache(
  opts: createPaymentRequiredResponseCacheOpts = {},
) {
  if (opts.disable) {
    logger.warning("payment required response cache disabled");

    return {
      getPaymentRequiredResponse,
      getPaymentRequiredResponseV2,
    };
  }

  const v1Cache = new AgedLRUCache<
    RelaxedRequirements[],
    x402PaymentRequiredResponseV1
  >(opts);

  const v2Cache = new AgedLRUCache<
    RelaxedRequirementsV2[],
    x402PaymentRequiredResponse
  >(opts);

  return {
    getPaymentRequiredResponse: async (
      args: getPaymentRequiredResponseArgs,
    ) => {
      let response = v1Cache.get(args.accepts);

      if (response === undefined) {
        response = await getPaymentRequiredResponse(args);
        v1Cache.put(args.accepts, response);
      }

      return response;
    },
    getPaymentRequiredResponseV2: async (
      args: getPaymentRequiredResponseV2Args,
    ) => {
      let response = v2Cache.get(args.accepts);

      if (response === undefined) {
        response = await getPaymentRequiredResponseV2(args);
        v2Cache.put(args.accepts, response);
      }

      return response;
    },
  };
}

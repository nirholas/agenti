/**
 * Unified client wrapper for x402 fetch-with-payment flows.
 *
 * Supports EVM, SVM, and Starknet schemes with a single fetchWithPayment helper.
 */

import {
  x402Client,
  x402HTTPClient,
  type PaymentPolicy,
  type SelectPaymentRequirements,
} from "@x402/core/client";
import type { PaymentPayload, PaymentRequired } from "@x402/core/types";
import {
  registerExactEvmScheme,
  type EvmClientConfig,
} from "@x402/evm/exact/client";
import {
  registerExactSvmScheme,
  type SvmClientConfig,
} from "@x402/svm/exact/client";
import {
  registerUptoEvmClientScheme,
  type UptoEvmClientConfig,
  type UptoEvmClientScheme,
} from "./upto/evm/client.js";
import {
  assertStarknetTypedData,
  registerExactStarknetClientScheme,
  type ExactStarknetClientConfig,
} from "./starknet/exact/client.js";

// ============================================================================
// Types
// ============================================================================

type EvmExactConfig = Omit<EvmClientConfig, "policies" | "paymentRequirementsSelector">;
type SvmExactConfig = Omit<SvmClientConfig, "policies" | "paymentRequirementsSelector">;

export interface UnifiedClientConfig {
  evmExact?: EvmExactConfig;
  evmUpto?: UptoEvmClientConfig;
  svmExact?: SvmExactConfig;
  starknetExact?: ExactStarknetClientConfig;
  policies?: PaymentPolicy[];
  paymentRequirementsSelector?: SelectPaymentRequirements;
  fetch?: typeof fetch;
}

export interface UnifiedClient {
  fetchWithPayment: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  client: x402Client;
  httpClient: x402HTTPClient;
  uptoScheme?: UptoEvmClientScheme;
}

// ============================================================================
// Public API
// ============================================================================

export function createUnifiedClient(config: UnifiedClientConfig): UnifiedClient {
  const fetchFn = config.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("fetch function is required.");
  }

  const schemeCount = [
    config.evmExact,
    config.evmUpto,
    config.svmExact,
    config.starknetExact,
  ].filter(Boolean).length;

  if (schemeCount === 0) {
    throw new Error("Unified client requires at least one scheme configuration.");
  }

  const client = new x402Client(config.paymentRequirementsSelector);

  for (const policy of config.policies ?? []) {
    client.registerPolicy(policy);
  }

  if (config.evmExact) {
    registerExactEvmScheme(client, config.evmExact);
  }

  let uptoScheme: UptoEvmClientScheme | undefined;
  if (config.evmUpto) {
    uptoScheme = registerUptoEvmClientScheme(client, config.evmUpto);
  }

  if (config.svmExact) {
    registerExactSvmScheme(client, config.svmExact);
  }

  if (config.starknetExact) {
    registerExactStarknetClientScheme(client, config.starknetExact);
  }

  const httpClient = new x402HTTPClient(client);

  const fetchWithPayment = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const baseRequest = createBaseRequest(input, init);
    const initialResponse = await fetchFn(withHeaders(baseRequest));

    if (initialResponse.status !== 402) {
      return initialResponse;
    }

    const initialParse = await parsePaymentRequiredResponse(
      initialResponse,
      httpClient
    );

    const paymentPayload = await httpClient.createPaymentPayload(
      initialParse.paymentRequired
    );

    assertStarknetTypedDataIfNeeded(paymentPayload);

    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
    const paidResponse = await fetchFn(withHeaders(baseRequest, paymentHeaders));

    if (paidResponse.status !== 402) {
      return paidResponse;
    }

    const retryParse = await parsePaymentRequiredResponse(
      paidResponse,
      httpClient
    ).catch(() => ({
      paymentRequired: initialParse.paymentRequired,
      errorCode: undefined,
    }));

    if (
      shouldInvalidateUptoPermit(
        retryParse.errorCode,
        paymentPayload.accepted.scheme,
        uptoScheme
      )
    ) {
      uptoScheme?.invalidatePermit(
        paymentPayload.accepted.network,
        paymentPayload.accepted.asset as `0x${string}`
      );

      const refreshedPayload = await httpClient.createPaymentPayload(
        retryParse.paymentRequired
      );

      assertStarknetTypedDataIfNeeded(refreshedPayload);

      const refreshedHeaders =
        httpClient.encodePaymentSignatureHeader(refreshedPayload);

      return fetchFn(withHeaders(baseRequest, refreshedHeaders));
    }

    return paidResponse;
  };

  return {
    fetchWithPayment,
    client,
    httpClient,
    ...(uptoScheme ? { uptoScheme } : {}),
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createBaseRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  try {
    return new Request(input, init);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create request from input.";
    throw new Error(`Invalid request: ${message}`);
  }
}

function withHeaders(
  baseRequest: Request,
  extraHeaders?: Record<string, string>
): Request {
  const request = baseRequest.clone();
  const headers = new Headers(request.headers);

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value);
    }
  }

  return new Request(request, { headers });
}

async function parsePaymentRequiredResponse(
  response: Response,
  httpClient: x402HTTPClient
): Promise<{ paymentRequired: PaymentRequired; errorCode?: string }>
{
  const body = await readJsonBody(response);
  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => response.headers.get(name),
    body ?? undefined
  );

  return {
    paymentRequired,
    errorCode: extractErrorCode(body),
  };
}

async function readJsonBody(response: Response): Promise<unknown | undefined> {
  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
}

function extractErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const error = record.error ?? record.code ?? record.reason;
  return typeof error === "string" ? error : undefined;
}

function shouldInvalidateUptoPermit(
  errorCode: string | undefined,
  scheme: string,
  uptoScheme?: UptoEvmClientScheme
): uptoScheme is UptoEvmClientScheme {
  if (!uptoScheme || scheme !== "upto") {
    return false;
  }

  return errorCode === "cap_exhausted" || errorCode === "session_closed";
}

function assertStarknetTypedDataIfNeeded(paymentPayload: PaymentPayload): void {
  if (paymentPayload.accepted.network.startsWith("starknet:")) {
    assertStarknetTypedData(paymentPayload);
  }
}

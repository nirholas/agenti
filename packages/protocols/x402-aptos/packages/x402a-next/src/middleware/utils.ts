import type { PaymentPayload } from "x402a";
import { DEFAULT_NETWORK, DEFAULT_SCHEME } from "../config/defaults";
import type { MiddlewareConfig, RouteConfig, VerificationResult } from "../types";
import type { PaymentRequirements } from "./protocol";
import { parsePaymentHeader, X402_RESPONSE_HEADER } from "./protocol";

export function buildPaymentRequirements(
  routeConfig: RouteConfig,
  config: MiddlewareConfig,
  requestPath: string
): PaymentRequirements {
  if (routeConfig.paymentRequirements) {
    return routeConfig.paymentRequirements;
  }

  const network = routeConfig.network || DEFAULT_NETWORK;
  const resource = routeConfig.resource || requestPath;

  return {
    scheme: DEFAULT_SCHEME,
    network,
    maxAmountRequired: routeConfig.price,
    resource,
    description: routeConfig.description || `Payment required for ${requestPath}`,
    payTo: config.payTo,
    asset: "0x1::aptos_coin::AptosCoin", // Default Aptos coin
  };
}

export function matchRoute(
  pathname: string,
  routes: Record<string, RouteConfig>
): RouteConfig | null {
  if (routes[pathname]) {
    return routes[pathname];
  }

  for (const [pattern, config] of Object.entries(routes)) {
    if (matchPattern(pathname, pattern)) {
      return config;
    }
  }

  return null;
}

function matchPattern(pathname: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\*/g, ".*") // * becomes .*
    .replace(/:\w+/g, "[^/]+"); // :param becomes [^/]+

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathname);
}

export function parsePaymentFromHeader(headerValue: string | null): {
  valid: boolean;
  payload?: PaymentPayload;
  error?: string;
} {
  if (!headerValue) {
    return { valid: false, error: "No payment header provided" };
  }

  try {
    const payload = parsePaymentHeader(headerValue);
    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid payment header",
    };
  }
}

export async function verifyPayment(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
  config: MiddlewareConfig
): Promise<VerificationResult> {
  if (config.facilitator) {
    return verifyWithFacilitator(paymentPayload, requirements, config);
  }

  return verifyClientSide(paymentPayload, requirements);
}

async function verifyWithFacilitator(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
  config: MiddlewareConfig
): Promise<VerificationResult> {
  const facilitator = config.facilitator;
  if (!facilitator) {
    return { valid: false, error: "Facilitator not configured" };
  }

  try {
    const response = await fetch(`${facilitator.url}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...facilitator.headers,
      },
      body: JSON.stringify({
        payment: paymentPayload,
        requirements,
      }),
      signal: AbortSignal.timeout(facilitator.timeout || 10000),
    });

    if (!response.ok) {
      const error = await response.text();
      return { valid: false, error: `Facilitator verification failed: ${error}` };
    }

    const result = await response.json();
    return {
      valid: result.success,
      payer: result.payer,
      txHash: result.txHash,
      error: result.error,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Facilitator request failed",
    };
  }
}

function verifyClientSide(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements
): VerificationResult {
  const payloadData = paymentPayload.payload;

  if (!payloadData?.to) {
    return { valid: false, error: "Invalid payment payload: missing recipient" };
  }

  const recipient = Array.isArray(payloadData.to) ? payloadData.to[0] : payloadData.to;
  if (recipient !== requirements.payTo) {
    return {
      valid: false,
      error: `Recipient mismatch: expected ${requirements.payTo}, got ${recipient}`,
    };
  }

  const amountStr = Array.isArray(payloadData.amount) ? payloadData.amount[0] : payloadData.amount;
  const amount = BigInt(amountStr || "0");
  const required = BigInt(requirements.maxAmountRequired);

  if (amount < required) {
    return {
      valid: false,
      error: `Insufficient amount: expected ${required}, got ${amount}`,
    };
  }

  const payer = payloadData.from;

  return {
    valid: true,
    payer,
  };
}

export function create402Response(requirements: PaymentRequirements): Response {
  return new Response(
    JSON.stringify({
      error: "Payment Required",
      code: "payment_required",
      requirements,
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Required": Buffer.from(JSON.stringify(requirements)).toString("base64"),
      },
    }
  );
}

export function createSuccessResponse(payer: string, txHash?: string): Record<string, string> {
  const paymentInfo: Record<string, string> = {
    "X-Payment-Verified": "true",
    "X-Payment-Payer": payer,
  };

  if (txHash) {
    paymentInfo["X-Payment-TxHash"] = txHash;
    paymentInfo[X402_RESPONSE_HEADER] = Buffer.from(
      JSON.stringify({
        success: true,
        transaction: txHash,
        payer,
      })
    ).toString("base64");
  }

  return paymentInfo;
}

export function debug(config: MiddlewareConfig, message: string, data?: unknown): void {
  if (config.debug) {
    console.log(`[x402a-next] ${message}`, data || "");
  }
}

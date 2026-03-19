/**
 * Resource Tracking Helper Functions
 *
 * Utilities for extracting payment details and request metadata
 * from the x402 payment flow.
 */

import type { HTTPAdapter } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { createHash } from "node:crypto";
import type {
  ResourceCallRecord,
  TrackedPayment,
  TrackedRequest,
  TrackedRouteConfig,
} from "./types.js";

/**
 * Default headers to capture from requests
 */
const DEFAULT_CAPTURE_HEADERS = [
  "content-type",
  "accept",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  "x-request-id",
  "x-correlation-id",
  "origin",
  "referer",
];

/**
 * Detect network type from CAIP-2 network identifier
 */
export function detectNetworkType(
  network: string
): "evm" | "svm" | "starknet" {
  if (network.startsWith("eip155:")) return "evm";
  if (network.startsWith("solana:")) return "svm";
  if (network.startsWith("starknet:")) return "starknet";
  // Fallback for v1 network names (e.g., "base", "base-sepolia")
  return "evm";
}

/**
 * Extract currency symbol from asset address or network
 */
export function extractCurrency(asset: string, network?: string): string {
  // Native currency
  if (asset === "native" || asset === "0x0000000000000000000000000000000000000000") {
    if (network?.startsWith("solana:")) return "SOL";
    if (network?.startsWith("starknet:")) return "ETH";
    return "ETH";
  }

  // Known stablecoin addresses (common across networks)
  const lowerAsset = asset.toLowerCase();
  if (lowerAsset.includes("usdc") || lowerAsset === "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") {
    return "USDC";
  }
  if (lowerAsset.includes("usdt") || lowerAsset === "0xdac17f958d2ee523a2206206994597c13d831ec7") {
    return "USDT";
  }
  if (lowerAsset.includes("dai") || lowerAsset === "0x6b175474e89094c44da98b954eedeac495271d0f") {
    return "DAI";
  }

  // Return truncated address as fallback
  return asset.slice(0, 10) + "...";
}

/**
 * Format amount with decimals for human readability
 * Note: This is a simplified version - production code should use token decimals
 */
export function formatAmount(amount: string, asset: string): string {
  try {
    const value = BigInt(amount);
    // Assume 6 decimals for stablecoins, 18 for others
    const decimals = asset.toLowerCase().includes("usd") ? 6 : 18;
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const fraction = value % divisor;
    const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 4);
    return `${whole}.${fractionStr}`;
  } catch {
    return amount;
  }
}

/**
 * Extract payer address from payment payload
 */
export function extractPayer(payload: PaymentPayload): string {
  // Cast to unknown first for safe property access
  const p = payload as Record<string, unknown>;
  const nestedPayload = isRecord(p.payload)
    ? (p.payload as Record<string, unknown>)
    : undefined;

  // The payer is typically in the authorization field
  if (p.authorization && typeof p.authorization === "object") {
    const auth = p.authorization as Record<string, unknown>;
    // EVM: authorization.from
    if (typeof auth.from === "string") {
      return auth.from;
    }
    // Check for owner field (upto scheme)
    if (typeof auth.owner === "string") {
      return auth.owner;
    }
  }
  if (nestedPayload?.authorization && typeof nestedPayload.authorization === "object") {
    const nestedAuth = nestedPayload.authorization as Record<string, unknown>;
    if (typeof nestedAuth.from === "string") {
      return nestedAuth.from;
    }
    if (typeof nestedAuth.owner === "string") {
      return nestedAuth.owner;
    }
  }

  // Solana: signer field
  if (typeof p.signer === "string") {
    return p.signer;
  }

  // EVM direct: from field
  if (typeof p.from === "string") {
    return p.from;
  }

  // Fallback: unknown
  return "unknown";
}

/**
 * Extract payment details from verified payment
 */
export function extractPaymentDetails(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): TrackedPayment {
  const networkType = detectNetworkType(requirements.network);
  const currency = extractCurrency(requirements.asset, requirements.network);

  return {
    scheme: requirements.scheme as "exact" | "upto",
    network: requirements.network,
    networkType,
    asset: requirements.asset,
    amount: requirements.amount,
    amountDecimal: formatAmount(requirements.amount, requirements.asset),
    currency,
    payer: extractPayer(payload),
    payTo: requirements.payTo,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const canonicalizeJson = (value: unknown): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (!isRecord(value)) return "null";

  const keys = Object.keys(value).sort();
  const serialized = keys
    .filter((key) => typeof value[key] !== "undefined")
    .map((key) => {
      const keyPart = JSON.stringify(key);
      const valuePart = canonicalizeJson(value[key]);
      return `${keyPart}:${valuePart}`;
    });

  return `{${serialized.join(",")}}`;
};

export function hashCanonicalJson(value: unknown): string {
  const canonical = canonicalizeJson(value);
  return createHash("sha256").update(canonical).digest("hex");
}

const normalizeOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return undefined;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
};

/**
 * Extract audit-focused x402 fields for first-class SQL columns.
 */
export function extractX402AuditFields(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Pick<
  ResourceCallRecord,
  | "x402Version"
  | "paymentNonce"
  | "paymentValidBefore"
  | "payloadHash"
  | "requirementsHash"
  | "paymentSignatureHash"
> {
  const p = payload as Record<string, unknown>;
  const nestedPayload = isRecord(p.payload) ? p.payload : undefined;
  const rootAuth = isRecord(p.authorization) ? p.authorization : undefined;
  const nestedAuth = nestedPayload && isRecord(nestedPayload.authorization)
    ? nestedPayload.authorization
    : undefined;
  const auth = nestedAuth ?? rootAuth;

  const signature = normalizeOptionalString(
    nestedPayload?.signature ?? p.signature
  );

  return {
    x402Version: normalizeOptionalNumber(p.x402Version ?? p.x402_version),
    paymentNonce: normalizeOptionalString(auth?.nonce),
    paymentValidBefore: normalizeOptionalString(auth?.validBefore),
    payloadHash: hashCanonicalJson(payload),
    requirementsHash: hashCanonicalJson(requirements),
    paymentSignatureHash: signature
      ? createHash("sha256").update(signature).digest("hex")
      : undefined,
  };
}

/**
 * Extract request metadata from HTTP adapter
 */
export function extractRequestMetadata(
  adapter: HTTPAdapter,
  captureHeaders: string[] = []
): TrackedRequest {
  const allHeaders = [
    ...new Set([
      ...DEFAULT_CAPTURE_HEADERS,
      ...captureHeaders.map((h) => h.toLowerCase()),
    ]),
  ];

  const headers: Record<string, string> = {};
  for (const name of allHeaders) {
    const value = adapter.getHeader(name);
    if (value) {
      headers[name] = value;
    }
  }

  // Extract client IP from common headers
  const clientIp =
    adapter.getHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    adapter.getHeader("x-real-ip") ??
    undefined;

  // Get content length
  const contentLengthStr = adapter.getHeader("content-length");
  const contentLength = contentLengthStr
    ? parseInt(contentLengthStr, 10)
    : undefined;

  return {
    clientIp,
    userAgent: adapter.getUserAgent?.() || undefined,
    headers,
    queryParams: adapter.getQueryParams?.() ?? {},
    contentType: adapter.getHeader("content-type") ?? undefined,
    contentLength: Number.isNaN(contentLength) ? undefined : contentLength,
    acceptHeader: adapter.getAcceptHeader?.() || undefined,
  };
}

/**
 * Extract route configuration from payment requirements
 */
export function extractRouteConfig(
  requirements: PaymentRequirements
): TrackedRouteConfig | undefined {
  // Only include if there's meaningful data
  const config: TrackedRouteConfig = {};

  if ("description" in requirements && requirements.description) {
    config.description = String(requirements.description);
  }

  if ("mimeType" in requirements && requirements.mimeType) {
    config.mimeType = String(requirements.mimeType);
  }

  if (requirements.scheme === "upto" && "maxAmountRequired" in requirements) {
    config.maxAmountRequired = String(requirements.maxAmountRequired);
  }

  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Generate a unique tracking ID
 */
export function generateTrackingId(): string {
  return crypto.randomUUID();
}

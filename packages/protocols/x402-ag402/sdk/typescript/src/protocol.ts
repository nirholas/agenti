/**
 * x402 Protocol types — mirrors open402 Python package.
 *
 * Ref: https://github.com/coinbase/x402
 */

const HEADER_UNSAFE_RE = /[\r\n"]/;

/** Parsed from HTTP 402 response — what the server demands. */
export interface X402PaymentChallenge {
  /** e.g. "solana", "base" */
  chain: string;
  /** e.g. "USDC" or mint address */
  token: string;
  /** e.g. "0.05" — kept as string for precision */
  amount: string;
  /** Recipient wallet address */
  address: string;
  /** (Optional) SHA256 hash of service description */
  serviceHash?: string;
  /** (Optional) Service tier */
  serviceTier?: string;
  /** (Optional) Smart contract for dispute resolution */
  refundContract?: string;
}

/**
 * Strict decimal pattern: optional leading digits, optional decimal point with digits.
 * Rejects hex (0x), scientific notation (1e5), multi-token strings ("1 2"), whitespace.
 */
const DECIMAL_RE = /^\d+(\.\d+)?$/;

/** Parse the amount field as a validated positive finite float. */
export function parseAmount(challenge: X402PaymentChallenge): number {
  const raw = challenge.amount;
  if (!DECIMAL_RE.test(raw)) {
    throw new Error(`Amount must be a decimal string (e.g. "0.05"), got: ${raw}`);
  }
  const val = parseFloat(raw);
  if (!isFinite(val)) {
    throw new Error(`Amount must be a finite number, got: ${raw}`);
  }
  if (val <= 0) {
    throw new Error(`Amount must be positive, got: ${raw}`);
  }
  return val;
}

/** Sent by client to prove payment — injected into retry request. */
export interface X402PaymentProof {
  /** On-chain transaction hash */
  txHash: string;
  chain?: string;
  payerAddress?: string;
  requestId?: string;
}

/** Describes a paid service endpoint. */
export interface X402ServiceDescriptor {
  endpoint: string;
  price: string;
  chain?: string;
  token?: string;
  address?: string;
  description?: string;
  serviceHash?: string;
}

/** Convert a service descriptor to a payment challenge. */
export function descriptorToChallenge(svc: X402ServiceDescriptor): X402PaymentChallenge {
  return {
    chain: svc.chain ?? "solana",
    token: svc.token ?? "USDC",
    amount: svc.price,
    address: svc.address ?? "",
    serviceHash: svc.serviceHash,
  };
}

const X402_FIELD_RE = /(\w+)="([^"]*)"/g;

/**
 * Maximum byte length accepted for a WWW-Authenticate header value (8 KB).
 * Protects against malicious servers sending oversized headers to exhaust regex.
 */
const MAX_HEADER_BYTES = 8192;

/** Serialize a challenge to WWW-Authenticate header value. */
export function buildWwwAuthenticate(challenge: X402PaymentChallenge): string {
  const fields: Record<string, string> = {
    chain: challenge.chain,
    token: challenge.token,
    amount: challenge.amount,
    address: challenge.address,
  };
  if (challenge.serviceHash) fields["service_hash"] = challenge.serviceHash;
  if (challenge.serviceTier) fields["service_tier"] = challenge.serviceTier;
  if (challenge.refundContract) fields["refund_contract"] = challenge.refundContract;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (HEADER_UNSAFE_RE.test(value)) {
      throw new Error(`Field ${key} contains unsafe characters: ${value}`);
    }
    parts.push(`${key}="${value}"`);
  }
  return "x402 " + parts.join(" ");
}

/** Parse WWW-Authenticate header value into a challenge. Returns null if not x402. */
export function parseWwwAuthenticate(headerValue: string): X402PaymentChallenge | null {
  if (!headerValue) return null;
  if (headerValue.length > MAX_HEADER_BYTES) return null;

  const value = headerValue.trim();
  let payload: string;
  if (value.toLowerCase().startsWith("x402 ")) {
    payload = value.slice(5);
  } else if (value.toLowerCase().startsWith("x402")) {
    payload = value.slice(4);
  } else {
    return null;
  }

  const fields: Record<string, string> = {};
  const re = new RegExp(X402_FIELD_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(payload)) !== null) {
    fields[match[1]] = match[2];
  }

  for (const req of ["chain", "token", "amount", "address"]) {
    if (!fields[req]) return null;
  }

  return {
    chain: fields["chain"],
    token: fields["token"],
    amount: fields["amount"],
    address: fields["address"],
    // Optional fields: return undefined when absent (not empty string)
    // so callers can reliably use `if (challenge.serviceHash)` or `!== undefined`
    serviceHash: fields["service_hash"] || undefined,
    serviceTier: fields["service_tier"] || undefined,
    refundContract: fields["refund_contract"] || undefined,
  };
}

/**
 * Build Authorization header value from payment proof.
 * Validates all string fields for header-unsafe characters to prevent injection.
 */
export function buildAuthorization(proof: X402PaymentProof): string {
  const fields: Record<string, string | undefined> = {
    tx_hash: proof.txHash,
    payer_address: proof.payerAddress,
    chain: proof.chain,
    request_id: proof.requestId,
  };
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!value) continue;
    if (HEADER_UNSAFE_RE.test(value)) {
      throw new Error(`Field ${key} contains unsafe characters: ${value}`);
    }
    parts.push(`${key}="${value}"`);
  }
  if (!parts.length) throw new Error("buildAuthorization requires at least tx_hash");
  return "x402 " + parts.join(" ");
}

/** Parse Authorization header value into a payment proof. Returns null if not x402. */
export function parseAuthorization(headerValue: string): X402PaymentProof | null {
  if (!headerValue) return null;

  const value = headerValue.trim();
  if (!value.toLowerCase().startsWith("x402 ")) return null;

  const payload = value.slice(5).trim();
  if (!payload) return null;

  const fields: Record<string, string> = {};
  const re = new RegExp(X402_FIELD_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(payload)) !== null) {
    fields[match[1]] = match[2];
  }

  if (fields["tx_hash"]) {
    return {
      txHash: fields["tx_hash"],
      chain: fields["chain"] ?? "solana",
      // Optional fields: return undefined when absent so callers can use `!== undefined`
      payerAddress: fields["payer_address"] || undefined,
      requestId: fields["request_id"] || undefined,
    };
  }

  // Legacy format: x402 <tx_hash> — must be a single word-char token (no spaces/special chars)
  if (/^\w+$/.test(payload)) {
    return { txHash: payload };
  }

  return null;
}

/**
 * x402 protocol helpers: header codecs, requirement building, payload checks,
 * facilitator calls and parsing of 402 responses from third-party servers.
 * Spec: https://github.com/coinbase/x402 (v2 headers PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE;
 * v1 body `accepts` + X-PAYMENT / X-PAYMENT-RESPONSE).
 */
import { HttpError } from './kit';

export const FACILITATOR_URL = 'https://x402.org/facilitator';

/** The network Agenti Cloud paywalls charge on. The public x402.org facilitator settles `exact` here for free. */
export const PAYWALL_NETWORK = {
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  caip: 'eip155:84532',
  chainId: 84532,
  explorer: 'https://sepolia.basescan.org',
  extra: { name: 'USDC', version: '2' },
  name: 'Base Sepolia',
} as const;

export interface EvmChain {
  caip: string;
  explorer: string;
  id: number;
  name: string;
  rpc: string;
  v1: string;
}

/** EVM chains an x402 payment can be signed for from the browser (wallet switch details included). */
export const EVM_CHAINS: EvmChain[] = [
  { caip: 'eip155:8453', explorer: 'https://basescan.org', id: 8453, name: 'Base', rpc: 'https://mainnet.base.org', v1: 'base' },
  { caip: 'eip155:84532', explorer: 'https://sepolia.basescan.org', id: 84532, name: 'Base Sepolia', rpc: 'https://sepolia.base.org', v1: 'base-sepolia' },
  { caip: 'eip155:137', explorer: 'https://polygonscan.com', id: 137, name: 'Polygon', rpc: 'https://polygon-rpc.com', v1: 'polygon' },
  { caip: 'eip155:80002', explorer: 'https://amoy.polygonscan.com', id: 80002, name: 'Polygon Amoy', rpc: 'https://rpc-amoy.polygon.technology', v1: 'polygon-amoy' },
  { caip: 'eip155:43114', explorer: 'https://snowtrace.io', id: 43114, name: 'Avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc', v1: 'avalanche' },
  { caip: 'eip155:43113', explorer: 'https://testnet.snowtrace.io', id: 43113, name: 'Avalanche Fuji', rpc: 'https://api.avax-test.network/ext/bc/C/rpc', v1: 'avalanche-fuji' },
];

export const chainFor = (network: string) => EVM_CHAINS.find((c) => c.caip === network || c.v1 === network) ?? null;

export interface Requirement {
  amount: string;
  asset: string;
  extra?: Record<string, unknown>;
  maxTimeoutSeconds: number;
  network: string;
  payTo: string;
  scheme: string;
}

export interface Resource {
  description: string;
  mimeType: string;
  url: string;
}

export interface PaymentRequired {
  accepts: Requirement[];
  error?: string;
  resource: Resource;
  x402Version: 2;
}

export interface Authorization {
  from: string;
  nonce: string;
  to: string;
  validAfter: string;
  validBefore: string;
  value: string;
}

export interface PaymentPayload {
  accepted?: Requirement;
  network?: string;
  payload?: { authorization?: Authorization; signature?: string };
  resource?: Resource;
  scheme?: string;
  x402Version?: number;
}

export interface VerifyResult {
  invalidReason?: string;
  isValid: boolean;
  payer?: string;
}

export interface SettleResult {
  errorReason?: string;
  network?: string;
  payer?: string;
  success: boolean;
  transaction?: string;
}

export function b64encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function b64decode<T>(value: string): T {
  try {
    const bin = atob(value.trim());
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as T;
  } catch {
    throw new HttpError(400, 'Payment header is not base64-encoded JSON');
  }
}

/** "0.01" → "10000" (USDC has 6 decimals). */
export function usdcToAtomic(price: string): string {
  const m = /^(\d{1,3})(?:\.(\d{1,6}))?$/.exec(price.trim());
  if (!m) throw new HttpError(400, 'Price must be a USDC amount like 0.01 (up to 6 decimals)');
  const atomic = BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0'));
  if (atomic <= 0n) throw new HttpError(400, 'Price must be greater than 0');
  if (atomic > 100_000_000n) throw new HttpError(400, 'Price can be at most 100 USDC per request');
  return atomic.toString();
}

export function atomicToUsdc(atomic: string | number | bigint): string {
  const v = BigInt(atomic);
  const frac = (v % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${v / 1_000_000n}${frac ? `.${frac}` : ''}`;
}

export function paywallRequirement(amount: string, payTo: string): Requirement {
  return {
    amount,
    asset: PAYWALL_NETWORK.asset,
    extra: { ...PAYWALL_NETWORK.extra },
    maxTimeoutSeconds: 300,
    network: PAYWALL_NETWORK.caip,
    payTo,
    scheme: 'exact',
  };
}

const same = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

/** Cheap local checks before asking the facilitator; returns a reason string when the payload cannot satisfy `req`. */
export function payloadProblem(p: PaymentPayload, req: Requirement): string | null {
  if (p.x402Version !== 2) return 'Unsupported x402Version; this paywall speaks x402 v2';
  const a = p.accepted;
  if (!a || a.scheme !== req.scheme || a.network !== req.network || !same(a.asset, req.asset) || !same(a.payTo, req.payTo) || a.amount !== req.amount) {
    return 'Payment does not match the accepted requirements';
  }
  const auth = p.payload?.authorization;
  if (!auth || typeof p.payload?.signature !== 'string') return 'Payment is missing the EIP-3009 authorization or signature';
  if (!same(auth.to, req.payTo)) return 'Authorization recipient does not match payTo';
  if (auth.value !== req.amount) return 'Authorization value does not match the price';
  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.validBefore) < now + 6) return 'Authorization has expired';
  if (Number(auth.validAfter) > now) return 'Authorization is not valid yet';
  return null;
}

async function callFacilitator<T>(path: 'settle' | 'verify', paymentPayload: PaymentPayload, paymentRequirements: Requirement): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FACILITATOR_URL}/${path}`, {
      body: JSON.stringify({ paymentPayload, paymentRequirements, x402Version: 2 }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new HttpError(502, `x402 facilitator unreachable (${(error as Error).message}); you were not charged`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(502, `x402 facilitator ${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

export const verifyPayment = (p: PaymentPayload, r: Requirement) => callFacilitator<VerifyResult>('verify', p, r);
export const settlePayment = (p: PaymentPayload, r: Requirement) => callFacilitator<SettleResult>('settle', p, r);

export interface QuoteOption {
  amount: string;
  asset: string;
  chainId: number | null;
  extra: Record<string, unknown>;
  maxTimeoutSeconds: number;
  network: string;
  networkName: string;
  payTo: string;
  raw: Record<string, unknown>;
  scheme: string;
  /** Why this option cannot be signed in the browser, if it cannot. */
  unsupported: string | null;
}

export interface Quote {
  error: string | null;
  options: QuoteOption[];
  resource: Resource | null;
  version: 1 | 2;
}

const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function option(raw: Record<string, unknown>, version: 1 | 2): QuoteOption {
  const network = s(raw.network);
  const chain = chainFor(network);
  const extra = (raw.extra && typeof raw.extra === 'object' ? raw.extra : {}) as Record<string, unknown>;
  const amount = s(version === 2 ? raw.amount : raw.maxAmountRequired);
  const scheme = s(raw.scheme);
  let unsupported: string | null = null;
  if (scheme !== 'exact') unsupported = `Scheme "${scheme}" is not supported; only "exact" is`;
  else if (!chain) unsupported = `Network ${network} is not an EVM chain this console can sign for`;
  else if (typeof extra.name !== 'string' || typeof extra.version !== 'string') unsupported = 'Requirement has no EIP-712 token name/version in `extra`';
  else if (!/^\d+$/.test(amount)) unsupported = 'Requirement amount is not an integer';
  return {
    amount,
    asset: s(raw.asset),
    chainId: chain?.id ?? null,
    extra,
    maxTimeoutSeconds: Number(raw.maxTimeoutSeconds) || 60,
    network,
    networkName: chain?.name ?? network,
    payTo: s(raw.payTo),
    raw,
    scheme,
    unsupported,
  };
}

/** Parses a 402 from any x402 server (v2 header first, then a v1 JSON body). Returns null when the body is not x402. */
export function parse402(res: Response, bodyText: string, url: string): Quote | null {
  const header = res.headers.get('payment-required');
  if (header) {
    const pr = b64decode<Partial<PaymentRequired>>(header);
    return {
      error: pr.error ?? null,
      options: (pr.accepts ?? []).map((r) => option(r as unknown as Record<string, unknown>, 2)),
      resource: pr.resource ?? { description: '', mimeType: '', url },
      version: 2,
    };
  }
  let body: { accepts?: Record<string, unknown>[]; error?: string; x402Version?: number };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return null;
  }
  if (!Array.isArray(body?.accepts)) return null;
  const first = body.accepts[0] ?? {};
  return {
    error: body.error ?? null,
    options: body.accepts.map((r) => option(r, 1)),
    resource: { description: s(first.description), mimeType: s(first.mimeType), url: s(first.resource) || url },
    version: 1,
  };
}

const PRIVATE_V4 = [/^10\./, /^127\./, /^0\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

/** Rejects URLs that point at loopback, link-local or private hosts, or carry credentials. */
export function publicUrl(input: string, { httpsOnly = false } = {}): URL {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new HttpError(400, 'Enter a full URL, e.g. https://api.example.com/data');
  }
  if (u.protocol !== 'https:' && (httpsOnly || u.protocol !== 'http:')) throw new HttpError(400, httpsOnly ? 'URL must use https' : 'URL must use http or https');
  if (u.username || u.password) throw new HttpError(400, 'URL must not contain credentials');
  const host = u.hostname.toLowerCase();
  if (host.startsWith('[') || host === 'localhost' || /\.(localhost|local|internal|lan|home|arpa)$/.test(host) || !host.includes('.')) {
    throw new HttpError(400, 'URL must point at a public host');
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && PRIVATE_V4.some((r) => r.test(host))) throw new HttpError(400, 'URL must point at a public host');
  return u;
}

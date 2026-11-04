import { base58 } from '@scure/base';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
import { HttpError, json, kitRoutes, metered, readJson, requireKeyOrUser, requireUser, Router, serve, str, type KitEnv, type User } from './kit';
import { ApiError } from './market/api';
import { createToolContext, getTool, TOOL_GROUPS, TOOLS, type ToolDefinition } from './market/tools';
import {
  atomicToUsdc,
  b64decode,
  b64encode,
  chainFor,
  parse402,
  PAYWALL_NETWORK,
  paywallRequirement,
  payloadProblem,
  publicUrl,
  settlePayment,
  usdcToAtomic,
  verifyPayment,
  type Authorization,
  type PaymentPayload,
  type PaymentRequired,
  type Quote,
} from './x402';

const APP = 'Agenti Cloud';
const VERSION = '1.0.0';
const UA = { 'user-agent': 'agenti-cloud-demo (+https://agenti.ninabrekkerese.workers.dev)' };
const MARKET = createToolContext({ baseUrl: 'https://cryptocurrency.cv', timeoutMs: 10_000 });
const MAX_WALLETS = 50;
const MAX_PAYWALLS = 25;
const BODY_CLIP = 20_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS agent_wallets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, label TEXT NOT NULL, chain TEXT NOT NULL, address TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE (user_id, chain, address));
CREATE TABLE IF NOT EXISTS paywalls (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, upstream TEXT NOT NULL, price_atomic TEXT NOT NULL, pay_to TEXT NOT NULL, network TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS paywalls_user ON paywalls (user_id, created_at);
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, direction TEXT NOT NULL, paywall_id TEXT, resource TEXT NOT NULL, network TEXT, amount TEXT, payer TEXT, pay_to TEXT, tx TEXT, status TEXT NOT NULL, error TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS payments_user ON payments (user_id, created_at);
CREATE INDEX IF NOT EXISTS payments_paywall ON payments (paywall_id);
CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, fetched_at INTEGER NOT NULL)
`;

type Env = KitEnv;

/* ---------------------------------------------------------------- caching */

/** D1-backed cache (the Cache API is a no-op on workers.dev). Serves the last good value, flagged `stale`, when the upstream fails. */
async function cached<T extends object>(env: Env, ctx: ExecutionContext, key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T & { stale?: boolean }> {
  const row = await env.DB.prepare('SELECT value, fetched_at FROM cache WHERE key = ?').bind(key).first<{ fetched_at: number; value: string }>();
  if (row && Date.now() - row.fetched_at < ttlSeconds * 1000) return JSON.parse(row.value);
  try {
    const value = await load();
    ctx.waitUntil(
      env.DB.prepare('INSERT INTO cache (key, value, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at')
        .bind(key, JSON.stringify(value), Date.now())
        .run(),
    );
    return value;
  } catch (error) {
    if (row) return { ...(JSON.parse(row.value) as T), stale: true };
    throw new HttpError(502, `Upstream unavailable: ${(error as Error).message}`);
  }
}

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { accept: 'application/json', ...UA, ...init.headers }, signal: init.signal ?? AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`${new URL(url).host} returned ${r.status}`);
  return r.json() as Promise<T>;
}

/* ---------------------------------------------------------------- live market strip */

interface Coin {
  current_price: number;
  id: string;
  image: string;
  market_cap: number;
  name: string;
  price_change_percentage_24h: number | null;
  symbol: string;
}

async function loadLive() {
  const [coins, fg] = await Promise.all([
    getJson<{ coins: Coin[] }>('https://cryptocurrency.cv/api/market/coins?type=top&limit=8'),
    getJson<{ current?: { timestamp?: number | string; value: number; valueClassification: string } }>('https://cryptocurrency.cv/api/fear-greed?days=1').catch(() => null),
  ]);
  if (!coins.coins?.length) throw new Error('cryptocurrency.cv returned no coins');
  return {
    coins: coins.coins.map((c) => ({
      change24h: c.price_change_percentage_24h,
      id: c.id,
      image: c.image,
      marketCap: c.market_cap,
      name: c.name,
      price: c.current_price,
      symbol: c.symbol.toUpperCase(),
    })),
    fearGreed: fg?.current ? { label: fg.current.valueClassification, value: Number(fg.current.value) } : null,
    fetchedAt: Date.now(),
  };
}

/* ---------------------------------------------------------------- addresses and balances */

type WalletChain = 'evm' | 'sol';

function normalizeAddress(chain: WalletChain, raw: string): string {
  const a = raw.trim();
  if (chain === 'evm') {
    if (!isAddress(a, { strict: false })) throw new HttpError(400, 'Not a valid EVM address (0x + 40 hex characters)');
    return getAddress(a);
  }
  let bytes: Uint8Array;
  try {
    bytes = base58.decode(a);
  } catch {
    throw new HttpError(400, 'Not a valid Solana address (base58)');
  }
  if (bytes.length !== 32) throw new HttpError(400, 'Not a valid Solana address (must decode to 32 bytes)');
  return a;
}

const EVM_BALANCE_NETS = [
  { id: 'base', name: 'Base', rpc: 'https://mainnet.base.org', testnet: false, usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: 'base-sepolia', name: 'Base Sepolia', rpc: 'https://sepolia.base.org', testnet: true, usdc: PAYWALL_NETWORK.asset },
];
const SOL_BALANCE_NETS = [
  { id: 'solana', name: 'Solana', rpc: 'https://api.mainnet-beta.solana.com', testnet: false, usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { id: 'solana-devnet', name: 'Solana Devnet', rpc: 'https://api.devnet.solana.com', testnet: true, usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' },
];

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const r = await getJson<{ error?: { message: string }; result: T }>(url, {
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (r.error) throw new Error(`${method}: ${r.error.message}`);
  return r.result;
}

const formatUnits = (v: bigint, decimals: number) => {
  const base = 10n ** BigInt(decimals);
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${v / base}${frac ? `.${frac}` : ''}`;
};

interface BalanceRow {
  error: string | null;
  native: string | null;
  nativeSymbol: string;
  network: string;
  networkName: string;
  testnet: boolean;
  usdc: string | null;
}

async function evmBalances(address: string): Promise<BalanceRow[]> {
  const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`;
  return Promise.all(
    EVM_BALANCE_NETS.map(async (n) => {
      try {
        const [wei, usdc] = await Promise.all([
          rpc<string>(n.rpc, 'eth_getBalance', [address, 'latest']),
          rpc<string>(n.rpc, 'eth_call', [{ data, to: n.usdc }, 'latest']),
        ]);
        return { error: null, native: formatUnits(BigInt(wei), 18), nativeSymbol: 'ETH', network: n.id, networkName: n.name, testnet: n.testnet, usdc: formatUnits(BigInt(usdc === '0x' ? 0 : usdc), 6) };
      } catch (error) {
        return { error: (error as Error).message, native: null, nativeSymbol: 'ETH', network: n.id, networkName: n.name, testnet: n.testnet, usdc: null };
      }
    }),
  );
}

interface TokenAccounts {
  value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[];
}

async function solBalances(address: string): Promise<BalanceRow[]> {
  return Promise.all(
    SOL_BALANCE_NETS.map(async (n) => {
      try {
        const [lamports, accounts] = await Promise.all([
          rpc<{ value: number }>(n.rpc, 'getBalance', [address, { commitment: 'confirmed' }]),
          rpc<TokenAccounts>(n.rpc, 'getTokenAccountsByOwner', [address, { mint: n.usdc }, { commitment: 'confirmed', encoding: 'jsonParsed' }]),
        ]);
        const usdc = accounts.value.reduce((sum, a) => sum + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
        return { error: null, native: formatUnits(BigInt(lamports.value), 9), nativeSymbol: 'SOL', network: n.id, networkName: n.name, testnet: n.testnet, usdc: formatUnits(usdc, 6) };
      } catch (error) {
        return { error: (error as Error).message, native: null, nativeSymbol: 'SOL', network: n.id, networkName: n.name, testnet: n.testnet, usdc: null };
      }
    }),
  );
}

async function balances(env: Env, ctx: ExecutionContext, chain: WalletChain, rawAddress: string) {
  const address = normalizeAddress(chain, rawAddress);
  return cached(env, ctx, `bal:${chain}:${address}`, 20, async () => ({
    address,
    chain,
    fetchedAt: Date.now(),
    networks: chain === 'evm' ? await evmBalances(address) : await solBalances(address),
  }));
}

/* ---------------------------------------------------------------- paywalls */

interface PaywallRow {
  active: number;
  created_at: number;
  description: string;
  id: string;
  name: string;
  network: string;
  pay_to: string;
  price_atomic: string;
  upstream: string;
  user_id: string;
}

const paywallId = () => {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return base58.encode(b).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10).padEnd(10, '0');
};

function upstreamUrl(raw: unknown, ownHost: string): string {
  const u = publicUrl(str(raw, 'upstream', 500), { httpsOnly: true });
  if (u.hostname === ownHost) throw new HttpError(400, 'Upstream must be a different host than this paywall');
  return u.toString();
}

function paywallView(p: PaywallRow, origin: string, stats?: { calls: number; earned: string | null; settled: number }) {
  return {
    active: !!p.active,
    calls: stats?.calls ?? 0,
    createdAt: p.created_at,
    description: p.description,
    earnedUsdc: atomicToUsdc(stats?.earned ?? '0'),
    id: p.id,
    name: p.name,
    network: p.network,
    payTo: p.pay_to,
    priceAtomic: p.price_atomic,
    priceUsdc: atomicToUsdc(p.price_atomic),
    settled: stats?.settled ?? 0,
    upstream: p.upstream,
    url: `${origin}/x/${p.id}`,
  };
}

async function listPaywalls(env: Env, user: User, origin: string) {
  const { results } = await env.DB.prepare(
    `SELECT p.*, COALESCE(s.calls, 0) AS calls, COALESCE(s.settled, 0) AS settled, s.earned FROM paywalls p
     LEFT JOIN (SELECT paywall_id, COUNT(*) AS calls, SUM(status = 'settled') AS settled, CAST(SUM(CASE WHEN status = 'settled' THEN CAST(amount AS INTEGER) ELSE 0 END) AS TEXT) AS earned
                FROM payments WHERE direction = 'in' GROUP BY paywall_id) s ON s.paywall_id = p.id
     WHERE p.user_id = ? ORDER BY p.created_at DESC`,
  )
    .bind(user.id)
    .all<PaywallRow & { calls: number; earned: string | null; settled: number }>();
  return results.map((r) => paywallView(r, origin, r));
}

const CORS = {
  'access-control-allow-headers': 'content-type, accept, payment-signature, x-payment',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'payment-required, payment-response, x-payment-response',
};

function paymentRequired(p: PaywallRow, resourceUrl: string, error?: string): Response {
  const body: PaymentRequired = {
    accepts: [paywallRequirement(p.price_atomic, p.pay_to)],
    resource: { description: p.description || p.name, mimeType: 'application/json', url: resourceUrl },
    x402Version: 2,
    ...(error ? { error } : {}),
  };
  return json(
    { ...body, howToPay: `Sign an EIP-3009 USDC authorization on ${PAYWALL_NETWORK.name} and resend with the PAYMENT-SIGNATURE header. Try it in the Pay tab of ${APP}.` },
    { headers: { ...CORS, 'payment-required': b64encode(body) }, status: 402 },
  );
}

function recordPayment(
  env: Env,
  ctx: ExecutionContext,
  row: { amount?: string | null; direction: 'in' | 'out'; error?: string | null; network?: string | null; payTo?: string | null; payer?: string | null; paywallId?: string | null; resource: string; status: string; tx?: string | null; userId: string },
) {
  ctx.waitUntil(
    env.DB.prepare('INSERT INTO payments (user_id, direction, paywall_id, resource, network, amount, payer, pay_to, tx, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(row.userId, row.direction, row.paywallId ?? null, row.resource.slice(0, 500), row.network ?? null, row.amount ?? null, row.payer ?? null, row.payTo ?? null, row.tx ?? null, row.status, row.error?.slice(0, 500) ?? null, Date.now())
      .run(),
  );
}

/** The public, x402-protected endpoint: 402 → verify → proxy upstream → settle → content + PAYMENT-RESPONSE. */
async function servePaywall(req: Request, env: Env, ctx: ExecutionContext, id: string): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'access-control-max-age': '86400' }, status: 204 });
  const p = await env.DB.prepare('SELECT * FROM paywalls WHERE id = ?').bind(id).first<PaywallRow>();
  if (!p || !p.active) return json({ error: p ? 'This paywall is paused by its owner' : 'Unknown paywall' }, { headers: CORS, status: p ? 410 : 404 });
  const url = new URL(req.url);
  const resourceUrl = `${url.origin}${url.pathname}`;
  const header = req.headers.get('payment-signature') ?? req.headers.get('x-payment');
  if (!header) return paymentRequired(p, resourceUrl);

  const requirement = paywallRequirement(p.price_atomic, p.pay_to);
  let payload: PaymentPayload;
  try {
    payload = b64decode<PaymentPayload>(header);
  } catch (error) {
    return paymentRequired(p, resourceUrl, (error as Error).message);
  }
  const auth = payload.payload?.authorization;
  const log = (status: string, extra: { error?: string; tx?: string | null } = {}) =>
    recordPayment(env, ctx, { amount: p.price_atomic, direction: 'in', network: p.network, payTo: p.pay_to, payer: auth?.from ?? null, paywallId: p.id, resource: resourceUrl, status, userId: p.user_id, ...extra });

  const problem = payloadProblem(payload, requirement);
  if (problem) {
    log('rejected', { error: problem });
    return paymentRequired(p, resourceUrl, problem);
  }
  const verified = await verifyPayment(payload, requirement);
  if (!verified.isValid) {
    const reason = verified.invalidReason ?? 'Payment verification failed';
    log('rejected', { error: reason });
    return paymentRequired(p, resourceUrl, reason);
  }

  const upstream = new URL(p.upstream);
  url.searchParams.forEach((v, k) => upstream.searchParams.append(k, v));
  let up: Response;
  let upBody: ArrayBuffer;
  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    up = await fetch(upstream, {
      body: hasBody ? await req.arrayBuffer() : undefined,
      headers: { accept: req.headers.get('accept') ?? '*/*', ...UA, ...(hasBody && req.headers.get('content-type') ? { 'content-type': req.headers.get('content-type')! } : {}) },
      method: req.method,
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    upBody = await up.arrayBuffer();
  } catch (error) {
    log('failed', { error: `Upstream unreachable: ${(error as Error).message}` });
    return json({ error: 'Upstream unreachable; your payment was not settled' }, { headers: CORS, status: 502 });
  }
  if (up.status >= 400) {
    log('failed', { error: `Upstream returned HTTP ${up.status}` });
    return json({ error: `Upstream returned HTTP ${up.status}; your payment was not settled` }, { headers: CORS, status: 502 });
  }

  const settled = await settlePayment(payload, requirement);
  if (!settled.success) {
    const reason = settled.errorReason ?? 'Settlement failed';
    log('failed', { error: reason });
    return paymentRequired(p, resourceUrl, reason);
  }
  log('settled', { tx: settled.transaction ?? null });
  return new Response(upBody, {
    headers: {
      ...CORS,
      'cache-control': 'no-store',
      'content-type': up.headers.get('content-type') ?? 'application/octet-stream',
      'payment-response': b64encode({ network: settled.network ?? p.network, payer: settled.payer ?? auth?.from, success: true, transaction: settled.transaction }),
    },
    status: up.status,
  });
}

/* ---------------------------------------------------------------- paying any x402 endpoint */

/** Fetches a URL, dispatching same-origin requests in-process (a Worker cannot fetch its own workers.dev hostname). */
async function outbound(target: URL, init: RequestInit, req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const self = new URL(req.url);
  const signal = AbortSignal.timeout(30_000);
  if (target.host === self.host) {
    const inner = new Request(target, { ...init, signal });
    return (await router.handle(inner, env, ctx)) ?? env.ASSETS.fetch(inner);
  }
  return fetch(target, { ...init, headers: { ...UA, ...(init.headers as Record<string, string>) }, redirect: 'follow', signal });
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const method = (m: unknown) => {
  const v = typeof m === 'string' ? m.toUpperCase() : 'GET';
  if (!METHODS.includes(v)) throw new HttpError(400, `method must be one of ${METHODS.join(', ')}`);
  return v;
};

interface ProbeResult {
  contentType: string;
  paid: false;
  preview: string;
  quote: Quote | null;
  status: number;
  url: string;
}

async function probe(raw: unknown, m: string, body: string | undefined, req: Request, env: Env, ctx: ExecutionContext): Promise<ProbeResult> {
  const target = publicUrl(str(raw, 'url', 1000));
  let res: Response;
  try {
    res = await outbound(target, { body: m === 'GET' ? undefined : body, headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, method: m }, req, env, ctx);
  } catch (error) {
    throw new HttpError(502, `Could not reach ${target.host}: ${(error as Error).message}`);
  }
  const text = await res.text();
  return {
    contentType: res.headers.get('content-type') ?? '',
    paid: false,
    preview: text.slice(0, 2000),
    quote: res.status === 402 ? parse402(res, text, target.toString()) : null,
    status: res.status,
    url: target.toString(),
  };
}

/** Pulls amount / payer / payee / network out of a v1 or v2 payment header without trusting the client's description of it. */
function describePayment(headerName: string, value: string) {
  const p = b64decode<PaymentPayload>(value);
  const auth: Partial<Authorization> = p.payload?.authorization ?? {};
  if (headerName === 'PAYMENT-SIGNATURE' && p.x402Version !== 2) throw new HttpError(400, 'PAYMENT-SIGNATURE must carry an x402Version 2 payload');
  if (headerName === 'X-PAYMENT' && p.x402Version !== 1) throw new HttpError(400, 'X-PAYMENT must carry an x402Version 1 payload');
  if (!auth.from || !auth.to || !auth.value || typeof p.payload?.signature !== 'string') throw new HttpError(400, 'Payment header has no signed EIP-3009 authorization');
  return { amount: auth.value, network: p.accepted?.network ?? p.network ?? null, payTo: auth.to, payer: auth.from };
}

/* ---------------------------------------------------------------- market tools */

interface ToolInfo {
  description: string;
  endpoint: string;
  group: string;
  inputSchema: Record<string, unknown>;
  name: string;
  title: string;
}

const schemaOf = (t: ToolDefinition) => z.toJSONSchema(z.object(t.input), { io: 'input' }) as Record<string, unknown>;
const MARKET_TOOLS: ToolInfo[] = TOOLS.map((t) => ({ description: t.description, endpoint: t.endpoint, group: t.group, inputSchema: schemaOf(t), name: t.name, title: t.title }));

async function runMarketTool(name: string, args: unknown) {
  const tool = getTool(name);
  if (!tool) throw new HttpError(404, `Unknown tool ${name}`);
  const parsed = z.object(tool.input).safeParse(args ?? {});
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
  try {
    return await tool.run(parsed.data, MARKET);
  } catch (error) {
    if (error instanceof ApiError) throw new HttpError(502, error.message);
    throw error;
  }
}

/* ---------------------------------------------------------------- MCP (streamable HTTP, stateless JSON responses) */

const AGENT_TOOLS: ToolInfo[] = [
  {
    description: 'Native and USDC balances for an EVM address (Base, Base Sepolia) or a Solana address (mainnet, devnet).',
    endpoint: 'JSON-RPC eth_getBalance / eth_call / getBalance / getTokenAccountsByOwner',
    group: 'Agent wallet',
    inputSchema: { additionalProperties: false, properties: { address: { description: '0x… EVM address or base58 Solana address', type: 'string' }, chain: { enum: ['evm', 'sol'], type: 'string' } }, required: ['address'], type: 'object' },
    name: 'wallet_balances',
    title: 'Wallet balances',
  },
  {
    description: 'Probe any URL and decode its x402 payment requirements (v1 body or v2 PAYMENT-REQUIRED header) without paying.',
    endpoint: 'GET <url>',
    group: 'x402',
    inputSchema: { additionalProperties: false, properties: { method: { enum: METHODS, type: 'string' }, url: { format: 'uri', type: 'string' } }, required: ['url'], type: 'object' },
    name: 'x402_inspect',
    title: 'Inspect x402 endpoint',
  },
  {
    description: 'The paywalled endpoints this account sells, with price, payout address and settled revenue.',
    endpoint: 'D1',
    group: 'x402',
    inputSchema: { additionalProperties: false, properties: {}, type: 'object' },
    name: 'list_paywalls',
    title: 'List my paywalls',
  },
  {
    description: 'The agent wallets registered to this account.',
    endpoint: 'D1',
    group: 'Agent wallet',
    inputSchema: { additionalProperties: false, properties: {}, type: 'object' },
    name: 'list_agent_wallets',
    title: 'List agent wallets',
  },
];

const MCP_TOOLS = [...AGENT_TOOLS, ...MARKET_TOOLS];

interface RpcMessage {
  id?: number | string | null;
  jsonrpc?: string;
  method?: string;
  params?: { arguments?: Record<string, unknown>; name?: string; protocolVersion?: string };
}

const rpcError = (id: RpcMessage['id'], code: number, message: string) => ({ error: { code, message }, id: id ?? null, jsonrpc: '2.0' });

async function callAgentTool(name: string, args: Record<string, unknown>, user: User, req: Request, env: Env, ctx: ExecutionContext): Promise<unknown> {
  switch (name) {
    case 'wallet_balances': {
      const address = str(args.address, 'address', 64);
      const chain: WalletChain = args.chain === 'sol' || (args.chain !== 'evm' && !address.startsWith('0x')) ? 'sol' : 'evm';
      return balances(env, ctx, chain, address);
    }
    case 'x402_inspect':
      return probe(args.url, method(args.method), undefined, req, env, ctx);
    case 'list_paywalls':
      return { paywalls: await listPaywalls(env, user, new URL(req.url).origin) };
    case 'list_agent_wallets':
      return { wallets: (await env.DB.prepare('SELECT label, chain, address, created_at FROM agent_wallets WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all()).results };
    default:
      return runMarketTool(name, args);
  }
}

async function mcpMessage(m: RpcMessage, user: User, req: Request, env: Env, ctx: ExecutionContext) {
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string') return rpcError(m.id, -32600, 'Invalid JSON-RPC request');
  if (m.id === undefined) return null;
  switch (m.method) {
    case 'initialize':
      return {
        id: m.id,
        jsonrpc: '2.0',
        result: {
          capabilities: { tools: { listChanged: false } },
          instructions: `${APP}: crypto market data, agent wallet balances and x402 payment tooling. Market tools call cryptocurrency.cv.`,
          protocolVersion: m.params?.protocolVersion ?? '2025-06-18',
          serverInfo: { name: 'agenti-cloud', title: APP, version: VERSION },
        },
      };
    case 'ping':
      return { id: m.id, jsonrpc: '2.0', result: {} };
    case 'tools/list':
      return { id: m.id, jsonrpc: '2.0', result: { tools: MCP_TOOLS.map((t) => ({ description: t.description, inputSchema: t.inputSchema, name: t.name, title: t.title })) } };
    case 'tools/call': {
      const name = m.params?.name;
      if (typeof name !== 'string' || !MCP_TOOLS.some((t) => t.name === name)) return rpcError(m.id, -32602, `Unknown tool ${String(name)}`);
      const args = m.params?.arguments ?? {};
      try {
        const out = await metered(env, ctx, user, `mcp:${name}`, args, () => callAgentTool(name, args, user, req, env, ctx));
        const text = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
        return { id: m.id, jsonrpc: '2.0', result: { content: [{ text: text.slice(0, 60_000), type: 'text' }], isError: false } };
      } catch (error) {
        return { id: m.id, jsonrpc: '2.0', result: { content: [{ text: (error as Error).message, type: 'text' }], isError: true } };
      }
    }
    default:
      return rpcError(m.id, -32601, `Method not found: ${m.method}`);
  }
}

/* ---------------------------------------------------------------- routes */

const router: Router<Env> = kitRoutes(new Router<Env>(), { appName: APP, keySlug: 'agenti' })
  .get('/api/live', async (_req, env, ctx) => json(await cached(env, ctx, 'live', 60, loadLive)))
  .get('/api/market/tools', () => json({ groups: TOOL_GROUPS, tools: MARKET_TOOLS }))
  .post('/api/market/run/:name', async (req, env, ctx, p) => {
    const user = await requireKeyOrUser(req, env, ctx);
    const args = await readJson<Record<string, unknown>>(req);
    const t = Date.now();
    const result = await metered(env, ctx, user, `tool:${p.name}`, args, () => runMarketTool(p.name, args));
    return json({ ms: Date.now() - t, result, tool: p.name });
  })

  .get('/api/overview', async (req, env) => {
    const u = await requireUser(req, env);
    const since = Date.now() - 30 * 24 * 3600 * 1000;
    const [w, pw, inc, out, calls, recent] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS n FROM agent_wallets WHERE user_id = ?').bind(u.id),
      env.DB.prepare('SELECT COUNT(*) AS n, SUM(active) AS active FROM paywalls WHERE user_id = ?').bind(u.id),
      env.DB.prepare(`SELECT COUNT(*) AS n, CAST(COALESCE(SUM(CAST(amount AS INTEGER)), 0) AS TEXT) AS total FROM payments WHERE user_id = ? AND direction = 'in' AND status = 'settled'`).bind(u.id),
      env.DB.prepare(`SELECT COUNT(*) AS n, CAST(COALESCE(SUM(CAST(amount AS INTEGER)), 0) AS TEXT) AS total FROM payments WHERE user_id = ? AND direction = 'out' AND status = 'settled'`).bind(u.id),
      env.DB.prepare('SELECT COUNT(*) AS n FROM usage WHERE user_id = ? AND created_at > ?').bind(u.id, since),
      env.DB.prepare('SELECT direction, resource, amount, status, tx, network, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').bind(u.id),
    ]);
    const one = (r: D1Result) => (r.results[0] ?? {}) as Record<string, number | string | null>;
    return json({
      apiCalls30d: Number(one(calls).n ?? 0),
      earnedUsdc: atomicToUsdc(String(one(inc).total ?? '0')),
      paidUsdc: atomicToUsdc(String(one(out).total ?? '0')),
      paymentsIn: Number(one(inc).n ?? 0),
      paymentsOut: Number(one(out).n ?? 0),
      paywalls: Number(one(pw).n ?? 0),
      paywallsActive: Number(one(pw).active ?? 0),
      recent: recent.results,
      user: u,
      wallets: Number(one(w).n ?? 0),
    });
  })

  .get('/api/wallets', async (req, env) => {
    const u = await requireUser(req, env);
    const { results } = await env.DB.prepare('SELECT id, label, chain, address, created_at FROM agent_wallets WHERE user_id = ? ORDER BY created_at DESC').bind(u.id).all();
    return json({ wallets: results });
  })
  .post('/api/wallets', async (req, env) => {
    const u = await requireUser(req, env);
    const b = await readJson<{ address?: string; chain?: string; label?: string }>(req);
    if (b.chain !== 'evm' && b.chain !== 'sol') throw new HttpError(400, 'chain must be "evm" or "sol"');
    const address = normalizeAddress(b.chain, str(b.address, 'address', 64));
    const label = str(b.label, 'label', 60);
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM agent_wallets WHERE user_id = ?').bind(u.id).first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_WALLETS) throw new HttpError(400, `You can register up to ${MAX_WALLETS} agent wallets`);
    const row = await env.DB.prepare('INSERT INTO agent_wallets (user_id, label, chain, address, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id, label, chain, address, created_at')
      .bind(u.id, label, b.chain, address, Date.now())
      .first();
    if (!row) throw new HttpError(409, 'That wallet is already registered');
    return json({ wallet: row }, { status: 201 });
  })
  .delete('/api/wallets/:id', async (req, env, _ctx, p) => {
    const u = await requireUser(req, env);
    const r = await env.DB.prepare('DELETE FROM agent_wallets WHERE id = ? AND user_id = ?').bind(Number(p.id), u.id).run();
    if (!r.meta.changes) throw new HttpError(404, 'Wallet not found');
    return json({ ok: true });
  })
  .get('/api/wallets/:id/balances', async (req, env, ctx, p) => {
    const u = await requireUser(req, env);
    const w = await env.DB.prepare('SELECT chain, address FROM agent_wallets WHERE id = ? AND user_id = ?').bind(Number(p.id), u.id).first<{ address: string; chain: WalletChain }>();
    if (!w) throw new HttpError(404, 'Wallet not found');
    return json(await balances(env, ctx, w.chain, w.address));
  })
  .get('/api/balances', async (req, env, ctx) => {
    const u = await requireKeyOrUser(req, env, ctx);
    const q = new URL(req.url).searchParams;
    const address = q.get('address') ?? u.address;
    const chain: WalletChain = q.get('chain') === 'sol' || (!q.get('chain') && !address.startsWith('0x')) ? 'sol' : 'evm';
    return json(await balances(env, ctx, chain, address));
  })

  .get('/api/paywalls', async (req, env) => {
    const u = await requireUser(req, env);
    return json({ network: PAYWALL_NETWORK, paywalls: await listPaywalls(env, u, new URL(req.url).origin) });
  })
  .post('/api/paywalls', async (req, env) => {
    const u = await requireUser(req, env);
    const b = await readJson<{ description?: string; name?: string; payTo?: string; price?: string; upstream?: string }>(req);
    const name = str(b.name, 'name', 80);
    const upstream = upstreamUrl(b.upstream, new URL(req.url).hostname);
    const price = usdcToAtomic(str(b.price, 'price', 12));
    const payToRaw = b.payTo?.trim() || (u.chain === 'evm' ? u.address : '');
    if (!payToRaw) throw new HttpError(400, 'payTo is required: enter the Base Sepolia address that should receive USDC');
    const payTo = normalizeAddress('evm', payToRaw);
    const description = typeof b.description === 'string' ? b.description.trim().slice(0, 280) : '';
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM paywalls WHERE user_id = ?').bind(u.id).first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_PAYWALLS) throw new HttpError(400, `You can create up to ${MAX_PAYWALLS} paywalls`);
    const row = (await env.DB.prepare('INSERT INTO paywalls (id, user_id, name, upstream, price_atomic, pay_to, network, description, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?) RETURNING *')
      .bind(paywallId(), u.id, name, upstream, price, payTo, PAYWALL_NETWORK.caip, description, Date.now())
      .first<PaywallRow>())!;
    return json({ paywall: paywallView(row, new URL(req.url).origin) }, { status: 201 });
  })
  .put('/api/paywalls/:id', async (req, env, _ctx, p) => {
    const u = await requireUser(req, env);
    const cur = await env.DB.prepare('SELECT * FROM paywalls WHERE id = ? AND user_id = ?').bind(p.id, u.id).first<PaywallRow>();
    if (!cur) throw new HttpError(404, 'Paywall not found');
    const b = await readJson<{ active?: boolean; description?: string; name?: string; payTo?: string; price?: string; upstream?: string }>(req);
    const next = {
      active: typeof b.active === 'boolean' ? (b.active ? 1 : 0) : cur.active,
      description: typeof b.description === 'string' ? b.description.trim().slice(0, 280) : cur.description,
      name: b.name !== undefined ? str(b.name, 'name', 80) : cur.name,
      pay_to: b.payTo !== undefined ? normalizeAddress('evm', str(b.payTo, 'payTo', 64)) : cur.pay_to,
      price_atomic: b.price !== undefined ? usdcToAtomic(str(b.price, 'price', 12)) : cur.price_atomic,
      upstream: b.upstream !== undefined ? upstreamUrl(b.upstream, new URL(req.url).hostname) : cur.upstream,
    };
    const row = (await env.DB.prepare('UPDATE paywalls SET active = ?, description = ?, name = ?, pay_to = ?, price_atomic = ?, upstream = ? WHERE id = ? AND user_id = ? RETURNING *')
      .bind(next.active, next.description, next.name, next.pay_to, next.price_atomic, next.upstream, p.id, u.id)
      .first<PaywallRow>())!;
    return json({ paywall: paywallView(row, new URL(req.url).origin) });
  })
  .delete('/api/paywalls/:id', async (req, env, _ctx, p) => {
    const u = await requireUser(req, env);
    const r = await env.DB.prepare('DELETE FROM paywalls WHERE id = ? AND user_id = ?').bind(p.id, u.id).run();
    if (!r.meta.changes) throw new HttpError(404, 'Paywall not found');
    return json({ ok: true });
  })
  .all('/x/:id', (req, env, ctx, p) => servePaywall(req, env, ctx, p.id))

  .post('/api/pay/quote', async (req, env, ctx) => {
    const u = await requireKeyOrUser(req, env, ctx);
    const b = await readJson<{ body?: string; method?: string; url?: string }>(req);
    const m = method(b.method);
    const body = typeof b.body === 'string' && b.body ? b.body.slice(0, 10_000) : undefined;
    return json(await metered(env, ctx, u, 'x402:quote', { method: m, url: b.url }, () => probe(b.url, m, body, req, env, ctx)));
  })
  .post('/api/pay/submit', async (req, env, ctx) => {
    const u = await requireKeyOrUser(req, env, ctx);
    const b = await readJson<{ body?: string; header?: string; method?: string; url?: string; value?: string }>(req);
    const m = method(b.method);
    const target = publicUrl(str(b.url, 'url', 1000));
    const headerName = b.header === 'X-PAYMENT' ? 'X-PAYMENT' : b.header === 'PAYMENT-SIGNATURE' ? 'PAYMENT-SIGNATURE' : null;
    if (!headerName) throw new HttpError(400, 'header must be PAYMENT-SIGNATURE (x402 v2) or X-PAYMENT (x402 v1)');
    const value = str(b.value, 'value', 8000);
    const pay = describePayment(headerName, value);
    const body = typeof b.body === 'string' && b.body && m !== 'GET' ? b.body.slice(0, 10_000) : undefined;
    const t = Date.now();
    let res: Response;
    try {
      res = await outbound(target, { body, headers: { accept: 'application/json', [headerName]: value, ...(body ? { 'content-type': 'application/json' } : {}) }, method: m }, req, env, ctx);
    } catch (error) {
      recordPayment(env, ctx, { ...pay, direction: 'out', error: (error as Error).message, resource: target.toString(), status: 'failed', userId: u.id });
      throw new HttpError(502, `Could not reach ${target.host}: ${(error as Error).message}`);
    }
    const text = await res.text();
    const receiptHeader = res.headers.get('payment-response') ?? res.headers.get('x-payment-response');
    let settlement: Record<string, unknown> | null = null;
    if (receiptHeader) {
      try {
        settlement = b64decode<Record<string, unknown>>(receiptHeader);
      } catch {
        settlement = { raw: receiptHeader };
      }
    }
    const quote = res.status === 402 ? parse402(res, text, target.toString()) : null;
    const ok = res.status < 400;
    const tx = typeof settlement?.transaction === 'string' ? settlement.transaction : null;
    recordPayment(env, ctx, {
      ...pay,
      direction: 'out',
      error: ok ? null : (quote?.error ?? `HTTP ${res.status}`),
      network: (typeof settlement?.network === 'string' ? settlement.network : null) ?? pay.network,
      resource: target.toString(),
      status: ok ? (tx || settlement ? 'settled' : 'delivered') : 'failed',
      tx,
      userId: u.id,
    });
    const network = (typeof settlement?.network === 'string' && settlement.network) || pay.network || '';
    const chain = chainFor(network);
    return json({
      body: text.slice(0, BODY_CLIP),
      clipped: text.length > BODY_CLIP,
      contentType: res.headers.get('content-type') ?? '',
      error: ok ? null : (quote?.error ?? null),
      explorerTx: tx && chain ? `${chain.explorer}/tx/${tx}` : null,
      ms: Date.now() - t,
      settlement,
      status: res.status,
    });
  })
  .get('/api/payments', async (req, env) => {
    const u = await requireUser(req, env);
    const q = new URL(req.url).searchParams;
    const dir = q.get('direction');
    const where = dir === 'in' || dir === 'out' ? 'AND direction = ?' : '';
    const stmt = env.DB.prepare(`SELECT id, direction, paywall_id, resource, network, amount, payer, pay_to, tx, status, error, created_at FROM payments WHERE user_id = ? ${where} ORDER BY created_at DESC LIMIT 100`);
    const { results } = await (where ? stmt.bind(u.id, dir) : stmt.bind(u.id)).all<{ amount: string | null; network: string | null; tx: string | null }>();
    return json({
      payments: results.map((r) => {
        const chain = r.network ? chainFor(r.network) : null;
        return { ...r, amountUsdc: r.amount && /^\d+$/.test(r.amount) ? atomicToUsdc(r.amount) : null, explorerTx: r.tx && chain ? `${chain.explorer}/tx/${r.tx}` : null };
      }),
    });
  })

  .get('/mcp', () => json({ error: 'This MCP endpoint is stateless: POST JSON-RPC messages (no SSE stream).' }, { headers: { allow: 'POST' }, status: 405 }))
  .post('/mcp', async (req, env, ctx) => {
    const user = await requireKeyOrUser(req, env, ctx);
    let msg: RpcMessage | RpcMessage[];
    try {
      msg = await req.json();
    } catch {
      return json(rpcError(null, -32700, 'Parse error'), { status: 400 });
    }
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.slice(0, 20).map((m) => mcpMessage(m, user, req, env, ctx)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    const out = await mcpMessage(msg, user, req, env, ctx);
    return out ? json(out) : new Response(null, { status: 202 });
  });

export default { fetch: serve(router, SCHEMA) } satisfies ExportedHandler<Env>;

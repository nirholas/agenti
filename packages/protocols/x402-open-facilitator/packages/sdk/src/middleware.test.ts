import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaymentMiddleware, honoPaymentMiddleware } from './middleware.js';
import type { PaymentContext } from './middleware.js';
import type { OpenFacilitator } from './client.js';
import type { PaymentRequirements } from './types.js';

// ============ Helpers ============

function createMockFacilitator(overrides: {
  verify?: OpenFacilitator['verify'];
  settle?: OpenFacilitator['settle'];
} = {}) {
  return {
    url: 'https://test.facilitator.xyz',
    verify: overrides.verify ?? vi.fn().mockResolvedValue({ isValid: true }),
    settle: overrides.settle ?? vi.fn().mockResolvedValue({
      success: true,
      transaction: '0xtxhash',
      payer: '0xpayer',
      network: 'base',
    }),
  } as unknown as OpenFacilitator;
}

/** Build a v1 payment requirements object (uses maxAmountRequired). */
function v1Requirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000',
    asset: '0xUSDC',
    payTo: '0xRecipient',
    ...overrides,
  } as PaymentRequirements;
}

/** Build a v2 payment requirements object (uses amount). */
function v2Requirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: 'base',
    amount: '2000000',
    asset: '0xUSDC',
    payTo: '0xRecipient',
    maxTimeoutSeconds: 600,
    ...overrides,
  } as PaymentRequirements;
}

/** Create a base64-encoded x-payment header string from a v2 payload. */
function makePaymentHeader(network = 'base') {
  const payload = {
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network,
      asset: '0xUSDC',
      amount: '1000000',
      payTo: '0xRecipient',
      maxTimeoutSeconds: 300,
    },
    payload: { signature: '0xsig' },
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// ============ Express helpers ============

function createExpressReq(headers: Record<string, string | undefined> = {}) {
  return {
    headers: headers as Record<string, string | string[] | undefined>,
    url: '/test',
    paymentContext: undefined as PaymentContext | undefined,
  };
}

function createExpressRes() {
  const jsonFn = vi.fn();
  const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
  return {
    status: statusFn,
    locals: {} as Record<string, unknown>,
    _statusFn: statusFn,
    _jsonFn: jsonFn,
  };
}

// ============ Hono helpers ============

function createHonoContext(paymentHeader?: string) {
  const store = new Map<string, unknown>();
  const jsonFn = vi.fn().mockImplementation((body: unknown, status?: number) => ({
    _body: body,
    _status: status,
  }));

  return {
    req: {
      header: vi.fn().mockImplementation((name: string) => {
        if (name === 'x-payment') return paymentHeader;
        return undefined;
      }),
      url: 'https://example.com/test',
    },
    json: jsonFn,
    get: vi.fn().mockImplementation((key: string) => store.get(key)),
    set: vi.fn().mockImplementation((key: string, value: unknown) => store.set(key, value)),
    _jsonFn: jsonFn,
    _store: store,
  };
}

// ============ Express: createPaymentMiddleware ============

describe('createPaymentMiddleware (Express)', () => {
  let facilitator: OpenFacilitator;

  beforeEach(() => {
    facilitator = createMockFacilitator();
  });

  it('returns 402 with x402Version 2 and accepts when no X-PAYMENT header', async () => {
    const middleware = createPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements(),
    });

    const req = createExpressReq({});
    const res = createExpressRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res._statusFn).toHaveBeenCalledWith(402);
    const body = res._jsonFn.mock.calls[0][0];
    expect(body.x402Version).toBe(2);
    expect(body.accepts).toBeDefined();
    expect(Array.isArray(body.accepts)).toBe(true);
    expect(body.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: 'base',
      amount: '1000000',
      asset: '0xUSDC',
      payTo: '0xRecipient',
      maxTimeoutSeconds: 300,
    });
    expect(body.accepts[0]).not.toHaveProperty('maxAmountRequired');
    expect(next).not.toHaveBeenCalled();
  });

  it('normalizes v1 maxAmountRequired to v2 amount in accepts', async () => {
    const middleware = createPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements({ maxAmountRequired: '5000000' } as Record<string, unknown>),
    });

    const req = createExpressReq({});
    const res = createExpressRes();
    const next = vi.fn();

    await middleware(req, res, next);

    const body = res._jsonFn.mock.calls[0][0];
    expect(body.accepts[0].amount).toBe('5000000');
    expect(body.accepts[0]).not.toHaveProperty('maxAmountRequired');
    expect(body.accepts[0].maxTimeoutSeconds).toBe(300);
  });

  it('passes v2 requirements through correctly', async () => {
    const middleware = createPaymentMiddleware({
      facilitator,
      getRequirements: () => v2Requirements({ amount: '9999', maxTimeoutSeconds: 600 } as Record<string, unknown>),
    });

    const req = createExpressReq({});
    const res = createExpressRes();
    const next = vi.fn();

    await middleware(req, res, next);

    const body = res._jsonFn.mock.calls[0][0];
    expect(body.accepts[0].amount).toBe('9999');
    expect(body.accepts[0].maxTimeoutSeconds).toBe(600);
  });

  it('includes x402Version and accepts on verification failure', async () => {
    facilitator = createMockFacilitator({
      verify: vi.fn().mockResolvedValue({ isValid: false, invalidReason: 'bad sig' }),
    });

    const middleware = createPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements(),
    });

    const req = createExpressReq({ 'x-payment': makePaymentHeader() });
    const res = createExpressRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res._statusFn).toHaveBeenCalledWith(402);
    const body = res._jsonFn.mock.calls[0][0];
    expect(body.x402Version).toBe(2);
    expect(body.accepts).toBeDefined();
    expect(body.error).toBe('Payment verification failed');
    expect(body.reason).toBe('bad sig');
    expect(next).not.toHaveBeenCalled();
  });

  it('includes x402Version and accepts on settlement failure', async () => {
    facilitator = createMockFacilitator({
      verify: vi.fn().mockResolvedValue({ isValid: true }),
      settle: vi.fn().mockResolvedValue({ success: false, errorReason: 'insufficient funds', transaction: '', payer: '', network: 'base' }),
    });

    const middleware = createPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements(),
    });

    const req = createExpressReq({ 'x-payment': makePaymentHeader() });
    const res = createExpressRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res._statusFn).toHaveBeenCalledWith(402);
    const body = res._jsonFn.mock.calls[0][0];
    expect(body.x402Version).toBe(2);
    expect(body.accepts).toBeDefined();
    expect(body.error).toBe('Payment settlement failed');
    expect(body.reason).toBe('insufficient funds');
    expect(next).not.toHaveBeenCalled();
  });

  it('adds supportsRefunds to extra when refundProtection is enabled', async () => {
    const middleware = createPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements(),
      refundProtection: {
        apiKey: 'test-key',
      },
    });

    const req = createExpressReq({});
    const res = createExpressRes();
    const next = vi.fn();

    await middleware(req, res, next);

    const body = res._jsonFn.mock.calls[0][0];
    expect(body.accepts[0].extra).toBeDefined();
    expect(body.accepts[0].extra.supportsRefunds).toBe(true);
  });

  it('supports multi-network accepts array', async () => {
    const middleware = createPaymentMiddleware({
      facilitator,
      getRequirements: () => [
        v1Requirements({ network: 'base' }),
        v2Requirements({ network: 'solana', amount: '500000' } as Record<string, unknown>),
      ],
    });

    const req = createExpressReq({});
    const res = createExpressRes();
    const next = vi.fn();

    await middleware(req, res, next);

    const body = res._jsonFn.mock.calls[0][0];
    expect(body.accepts).toHaveLength(2);
    expect(body.accepts[0].network).toBe('base');
    expect(body.accepts[1].network).toBe('solana');
    expect(body.accepts[1].amount).toBe('500000');
  });
});

// ============ Hono: honoPaymentMiddleware ============

describe('honoPaymentMiddleware (Hono)', () => {
  let facilitator: OpenFacilitator;

  beforeEach(() => {
    facilitator = createMockFacilitator();
  });

  it('returns 402 with x402Version 2 and accepts when no X-PAYMENT header', async () => {
    const middleware = honoPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements(),
    });

    const c = createHonoContext(undefined);
    const next = vi.fn().mockResolvedValue(undefined);

    const result = await middleware(c as Parameters<typeof middleware>[0], next);

    expect(c._jsonFn).toHaveBeenCalled();
    const [body, status] = c._jsonFn.mock.calls[0];
    expect(status).toBe(402);
    expect(body.x402Version).toBe(2);
    expect(body.accepts).toBeDefined();
    expect(Array.isArray(body.accepts)).toBe(true);
    expect(body.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: 'base',
      amount: '1000000',
      asset: '0xUSDC',
      payTo: '0xRecipient',
      maxTimeoutSeconds: 300,
    });
    expect(body.accepts[0]).not.toHaveProperty('maxAmountRequired');
    expect(next).not.toHaveBeenCalled();
  });

  it('normalizes v1 maxAmountRequired to v2 amount in accepts', async () => {
    const middleware = honoPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements({ maxAmountRequired: '5000000' } as Record<string, unknown>),
    });

    const c = createHonoContext(undefined);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(c as Parameters<typeof middleware>[0], next);

    const [body] = c._jsonFn.mock.calls[0];
    expect(body.accepts[0].amount).toBe('5000000');
    expect(body.accepts[0]).not.toHaveProperty('maxAmountRequired');
    expect(body.accepts[0].maxTimeoutSeconds).toBe(300);
  });

  it('passes v2 requirements through correctly', async () => {
    const middleware = honoPaymentMiddleware({
      facilitator,
      getRequirements: () => v2Requirements({ amount: '9999', maxTimeoutSeconds: 600 } as Record<string, unknown>),
    });

    const c = createHonoContext(undefined);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(c as Parameters<typeof middleware>[0], next);

    const [body] = c._jsonFn.mock.calls[0];
    expect(body.accepts[0].amount).toBe('9999');
    expect(body.accepts[0].maxTimeoutSeconds).toBe(600);
  });

  it('includes x402Version and accepts on verification failure', async () => {
    facilitator = createMockFacilitator({
      verify: vi.fn().mockResolvedValue({ isValid: false, invalidReason: 'bad sig' }),
    });

    const middleware = honoPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements(),
    });

    const c = createHonoContext(makePaymentHeader());
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(c as Parameters<typeof middleware>[0], next);

    const [body, status] = c._jsonFn.mock.calls[0];
    expect(status).toBe(402);
    expect(body.x402Version).toBe(2);
    expect(body.accepts).toBeDefined();
    expect(body.error).toBe('Payment verification failed');
    expect(body.reason).toBe('bad sig');
    expect(next).not.toHaveBeenCalled();
  });

  it('includes x402Version and accepts on settlement failure', async () => {
    facilitator = createMockFacilitator({
      verify: vi.fn().mockResolvedValue({ isValid: true }),
      settle: vi.fn().mockResolvedValue({ success: false, errorReason: 'insufficient funds', transaction: '', payer: '', network: 'base' }),
    });

    const middleware = honoPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements(),
    });

    const c = createHonoContext(makePaymentHeader());
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(c as Parameters<typeof middleware>[0], next);

    const [body, status] = c._jsonFn.mock.calls[0];
    expect(status).toBe(402);
    expect(body.x402Version).toBe(2);
    expect(body.accepts).toBeDefined();
    expect(body.error).toBe('Payment settlement failed');
    expect(body.reason).toBe('insufficient funds');
    expect(next).not.toHaveBeenCalled();
  });

  it('adds supportsRefunds to extra when refundProtection is enabled', async () => {
    const middleware = honoPaymentMiddleware({
      facilitator,
      getRequirements: () => v1Requirements(),
      refundProtection: {
        apiKey: 'test-key',
      },
    });

    const c = createHonoContext(undefined);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(c as Parameters<typeof middleware>[0], next);

    const [body] = c._jsonFn.mock.calls[0];
    expect(body.accepts[0].extra).toBeDefined();
    expect(body.accepts[0].extra.supportsRefunds).toBe(true);
  });

  it('supports multi-network accepts array', async () => {
    const middleware = honoPaymentMiddleware({
      facilitator,
      getRequirements: () => [
        v1Requirements({ network: 'base' }),
        v2Requirements({ network: 'solana', amount: '500000' } as Record<string, unknown>),
      ],
    });

    const c = createHonoContext(undefined);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(c as Parameters<typeof middleware>[0], next);

    const [body] = c._jsonFn.mock.calls[0];
    expect(body.accepts).toHaveLength(2);
    expect(body.accepts[0].network).toBe('base');
    expect(body.accepts[1].network).toBe('solana');
    expect(body.accepts[1].amount).toBe('500000');
  });
});

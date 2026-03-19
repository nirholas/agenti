import { describe, it, expect, vi } from 'vitest';
import { settleRoute } from '../src/routes/settle';
import { RateLimiter } from '../src/middleware/rate-limit';

// A valid-looking 32-byte public key (64 hex chars) so extractPayerFromPayload works
const FAKE_PUBLIC_KEY = 'a'.repeat(64);

function createSettleApp(opts: { settleLimitExceeded?: boolean; walletLimitExceeded?: boolean } = {}) {
  const facilitator = {
    verify: vi.fn().mockResolvedValue({ isValid: true, payer: '0:1234' }),
    settle: vi.fn().mockResolvedValue({
      success: true,
      payer: '0:1234',
      transaction: 'abc',
      network: 'tvm:-239',
    }),
  };
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  const idempotencyStore = {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  };
  const txStateStore = {
    create: vi.fn(),
    update: vi.fn(),
    markSettled: vi.fn(),
  };

  // Rate limiters that can be pre-configured to reject
  const settleLimiter = new RateLimiter(1000, 60000);
  const walletLimiter = new RateLimiter(1000, 60000);

  if (opts.settleLimitExceeded) {
    vi.spyOn(settleLimiter, 'isAllowed').mockReturnValue(false);
  }
  if (opts.walletLimitExceeded) {
    vi.spyOn(walletLimiter, 'isAllowed').mockReturnValue(false);
  }

  return {
    app: settleRoute({
      facilitator,
      logger: logger as never,
      idempotencyStore: idempotencyStore as never,
      txStateStore: txStateStore as never,
      settleLimiter,
      walletLimiter,
      network: 'tvm:-239',
    }),
    facilitator,
    idempotencyStore,
    txStateStore,
    logger,
  };
}

function makeSettleRequest(
  app: ReturnType<typeof createSettleApp>['app'],
  overrides?: { headers?: Record<string, string>; body?: string },
) {
  return app.request('/settle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `test-${Date.now()}-${Math.random()}`,
      ...(overrides?.headers ?? {}),
    },
    body:
      overrides?.body ??
      JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: {
            signedBoc: 'dGVzdA==',
            walletPublicKey: FAKE_PUBLIC_KEY,
          },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'tvm:-239',
          amount: '1000000000',
          payTo: '0:' + '1'.repeat(64),
        },
      }),
  });
}

describe('POST /settle security', () => {
  it('rate-limits BEFORE calling facilitator.settle()', async () => {
    const { app, facilitator } = createSettleApp({ settleLimitExceeded: true });

    const res = await makeSettleRequest(app);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.errorReason).toBe('rate_limited');
    // The critical assertion: settle() was NEVER called
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('wallet rate-limit blocks before facilitator.settle()', async () => {
    const { app, facilitator } = createSettleApp({ walletLimitExceeded: true });

    const res = await makeSettleRequest(app);

    expect(res.status).toBe(429);
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('rejects payload without x402Version: 2', async () => {
    const { app, facilitator } = createSettleApp();

    const res = await app.request('/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `test-${Date.now()}`,
      },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 1,
          payload: {
            signedBoc: 'dGVzdA==',
            walletPublicKey: FAKE_PUBLIC_KEY,
          },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'tvm:-239',
          amount: '1000000000',
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorReason).toBe('invalid_payload');
    expect(body.errorMessage).toContain('x402Version must be 2');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  // --- Input validation edge cases ---

  it('returns 400 when amount is not a string', async () => {
    const { app, facilitator } = createSettleApp();

    const res = await app.request('/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `test-${Date.now()}`,
      },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: 'dGVzdA==', walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'tvm:-239',
          amount: 1000000000,
          payTo: '0:' + '1'.repeat(64),
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorReason).toBe('invalid_payload');
    expect(body.errorMessage).toContain('amount');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('returns 400 when amount is negative string', async () => {
    const { app, facilitator } = createSettleApp();

    const res = await app.request('/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `test-${Date.now()}`,
      },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: 'dGVzdA==', walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'tvm:-239',
          amount: '-100',
          payTo: '0:' + '1'.repeat(64),
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorReason).toBe('invalid_payload');
    expect(body.errorMessage).toContain('amount');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('returns 400 when amount is "0"', async () => {
    const { app, facilitator } = createSettleApp();

    const res = await app.request('/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `test-${Date.now()}`,
      },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: 'dGVzdA==', walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'tvm:-239',
          amount: '0',
          payTo: '0:' + '1'.repeat(64),
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorReason).toBe('invalid_payload');
    expect(body.errorMessage).toContain('amount');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('returns 400 when payTo is missing', async () => {
    const { app, facilitator } = createSettleApp();

    const res = await app.request('/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `test-${Date.now()}`,
      },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: 'dGVzdA==', walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'tvm:-239',
          amount: '1000000000',
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorReason).toBe('invalid_payload');
    expect(body.errorMessage).toContain('payTo');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('returns 400 on malformed JSON body', async () => {
    const { app, facilitator } = createSettleApp();

    const res = await makeSettleRequest(app, { body: 'not-valid-json{{{' });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorReason).toBe('invalid_payload');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('returns 400 when paymentPayload is missing', async () => {
    const { app, facilitator } = createSettleApp();

    const res = await makeSettleRequest(app, {
      body: JSON.stringify({
        paymentRequirements: {
          scheme: 'exact',
          network: 'tvm:-239',
          amount: '1000000000',
          payTo: '0:' + '1'.repeat(64),
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorReason).toBe('invalid_payload');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  // --- Idempotency and concurrency edge cases ---

  it('returns 400 when Idempotency-Key header is missing', async () => {
    const { app, facilitator } = createSettleApp();

    const res = await app.request('/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Idempotency-Key header
      },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: 'dGVzdA==', walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'tvm:-239',
          amount: '1000000000',
          payTo: '0:' + '1'.repeat(64),
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Idempotency-Key');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('returns 409 on concurrent settlement of same BOC', async () => {
    const { app, facilitator, txStateStore } = createSettleApp();

    // Simulate duplicate BOC: txStateStore.create throws (UNIQUE constraint violation)
    txStateStore.create.mockImplementation(() => {
      throw new Error('UNIQUE constraint failed');
    });

    const res = await makeSettleRequest(app);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errorReason).toBe('settlement_in_progress');
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it('returns 500 and marks tx FAILED when facilitator.settle throws', async () => {
    const { app, facilitator, txStateStore } = createSettleApp();

    facilitator.settle.mockRejectedValue(new Error('Network timeout'));

    const res = await makeSettleRequest(app);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errorReason).toBe('unexpected_settle_error');
    expect(body.errorMessage).toBe('Internal settlement error');
    // Verify txStateStore.update was called with 'FAILED'
    expect(txStateStore.update).toHaveBeenCalledWith(expect.any(String), 'FAILED');
  });
});

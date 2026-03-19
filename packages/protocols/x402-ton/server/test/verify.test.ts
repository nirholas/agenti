import { describe, it, expect, vi } from 'vitest';
import { verifyRoute } from '../src/routes/verify';
import { RateLimiter } from '../src/middleware/rate-limit';

const FAKE_PUBLIC_KEY = 'a'.repeat(64);

function createVerifyApp(
  verifyResult: { isValid: boolean; payer?: string; invalidReason?: string; invalidMessage?: string } = { isValid: true, payer: '0:1234' },
) {
  const facilitator = {
    verify: vi.fn().mockResolvedValue(verifyResult),
  };
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  const walletLimiter = new RateLimiter(1000, 60000);

  return {
    app: verifyRoute({ facilitator, logger: logger as never, walletLimiter }),
    facilitator,
    logger,
  };
}

describe('POST /verify', () => {
  it('returns 200 with valid result', async () => {
    const { app } = createVerifyApp({ isValid: true, payer: '0:abc' });

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: { x402Version: 2, payload: { signedBoc: 'dGVzdA==', walletPublicKey: 'ab' } },
        paymentRequirements: { scheme: 'exact', network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isValid).toBe(true);
  });

  it('returns 400 on malformed JSON', async () => {
    const { app } = createVerifyApp();

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalidReason).toBe('invalid_payload');
  });

  it('returns 400 when x402Version is missing', async () => {
    const { app, facilitator } = createVerifyApp();

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: { payload: { signedBoc: 'dGVzdA==', walletPublicKey: 'ab' } },
        paymentRequirements: { scheme: 'exact', network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalidReason).toBe('invalid_payload');
    expect(body.invalidMessage).toContain('x402Version must be 2');
    expect(facilitator.verify).not.toHaveBeenCalled();
  });

  it('returns 400 when x402Version is not 2', async () => {
    const { app, facilitator } = createVerifyApp();

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: { x402Version: 1, payload: { signedBoc: 'dGVzdA==', walletPublicKey: 'ab' } },
        paymentRequirements: { scheme: 'exact', network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalidReason).toBe('invalid_payload');
    expect(body.invalidMessage).toContain('x402Version must be 2');
    expect(facilitator.verify).not.toHaveBeenCalled();
  });

  it('returns 400 when missing paymentPayload', async () => {
    const { app } = createVerifyApp();

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentRequirements: {} }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalidReason).toBe('invalid_payload');
  });

  it('returns 400 when signedBoc is not a string', async () => {
    const { app, facilitator } = createVerifyApp();

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: 12345, walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: { scheme: 'exact', network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalidReason).toBe('invalid_payload');
    expect(body.invalidMessage).toContain('signedBoc');
    expect(facilitator.verify).not.toHaveBeenCalled();
  });

  it('returns 400 when signedBoc is empty string', async () => {
    const { app, facilitator } = createVerifyApp();

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: '', walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: { scheme: 'exact', network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalidReason).toBe('invalid_payload');
    expect(body.invalidMessage).toContain('signedBoc');
    expect(facilitator.verify).not.toHaveBeenCalled();
  });

  it('returns 400 when payload is not an object', async () => {
    const { app, facilitator } = createVerifyApp();

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: 'not-an-object',
        },
        paymentRequirements: { scheme: 'exact', network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalidReason).toBe('invalid_payload');
    expect(body.invalidMessage).toContain('payload');
    expect(facilitator.verify).not.toHaveBeenCalled();
  });

  it('returns 400 when paymentRequirements.scheme is not a string', async () => {
    const { app, facilitator } = createVerifyApp();

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: 'dGVzdA==', walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: { scheme: 123, network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalidReason).toBe('invalid_payload');
    expect(body.invalidMessage).toContain('scheme');
    expect(facilitator.verify).not.toHaveBeenCalled();
  });

  it('returns 500 when facilitator.verify throws unexpected error', async () => {
    const facilitator = {
      verify: vi.fn().mockRejectedValue(new Error('Unexpected boom')),
    };
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    const walletLimiter = new RateLimiter(1000, 60000);
    const app = verifyRoute({ facilitator, logger: logger as never, walletLimiter });

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: { signedBoc: 'dGVzdA==', walletPublicKey: FAKE_PUBLIC_KEY },
        },
        paymentRequirements: { scheme: 'exact', network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.isValid).toBe(false);
    expect(body.invalidReason).toBe('unexpected_error');
    expect(body.invalidMessage).toBe('Internal verification error');
  });
});

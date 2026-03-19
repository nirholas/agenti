import { describe, it, expect, vi } from 'vitest';
import { verifyRoute } from '../src/routes/verify';
import { RateLimiter } from '../src/middleware/rate-limit';

const FAKE_PUBLIC_KEY = 'a'.repeat(64);

describe('POST /verify security', () => {
  it('rate-limits BEFORE calling facilitator.verify()', async () => {
    const facilitator = {
      verify: vi.fn().mockResolvedValue({ isValid: true, payer: '0:1234' }),
    };
    const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
    const walletLimiter = new RateLimiter(1000, 60000);
    vi.spyOn(walletLimiter, 'isAllowed').mockReturnValue(false);

    const app = verifyRoute({ facilitator, logger: logger as never, walletLimiter });

    const res = await app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: {
          x402Version: 2,
          payload: {
            signedBoc: 'dGVzdA==',
            walletPublicKey: FAKE_PUBLIC_KEY,
          },
        },
        paymentRequirements: { scheme: 'exact', network: 'tvm:-239' },
      }),
    });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.invalidReason).toBe('rate_limited');
    // Critical: verify() was NEVER called
    expect(facilitator.verify).not.toHaveBeenCalled();
  });
});

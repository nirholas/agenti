import { Hono } from 'hono';
import type { Logger } from '../middleware/logging';
import { hashBoc, extractPayerFromPayload } from 'x402ton';
import { RateLimiter } from '../middleware/rate-limit';
import { validatePaymentPayload, validatePaymentRequirements } from './validation';
import { ServerErrorCode } from './error-codes';

interface VerifyDeps {
  facilitator: {
    verify(
      paymentPayload: unknown,
      paymentRequirements: unknown,
    ): Promise<{
      isValid: boolean;
      invalidReason?: string;
      invalidMessage?: string;
      payer?: string;
    }>;
  };
  logger: Logger;
  walletLimiter: RateLimiter;
}

export function verifyRoute(deps: VerifyDeps) {
  const app = new Hono();

  app.post('/verify', async (c) => {
    const startTime = Date.now();

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { isValid: false, invalidReason: 'invalid_payload', invalidMessage: 'Malformed JSON body' },
        400,
      );
    }

    const { paymentPayload, paymentRequirements } = body;
    if (!paymentPayload || !paymentRequirements) {
      return c.json(
        {
          isValid: false,
          invalidReason: 'invalid_payload',
          invalidMessage: 'Missing paymentPayload or paymentRequirements',
        },
        400,
      );
    }

    // x402Version MUST be 2 (PR #1455 section 6.1)
    const x402Version = (paymentPayload as Record<string, unknown>).x402Version;
    if (x402Version !== 2) {
      return c.json(
        {
          isValid: false,
          invalidReason: 'invalid_payload',
          invalidMessage: `x402Version must be 2, got ${x402Version}`,
        },
        400,
      );
    }

    // Validate inner field types before passing to facilitator
    const payloadErr = validatePaymentPayload(paymentPayload);
    if (payloadErr) {
      return c.json(
        { isValid: false, invalidReason: 'invalid_payload', invalidMessage: payloadErr },
        400,
      );
    }
    const requirementsErr = validatePaymentRequirements(paymentRequirements);
    if (requirementsErr) {
      return c.json(
        { isValid: false, invalidReason: 'invalid_payload', invalidMessage: requirementsErr },
        400,
      );
    }

    // Log BOC hash only, never the full BOC
    const payload = (paymentPayload as Record<string, unknown>).payload as
      | Record<string, unknown>
      | undefined;
    const signedBoc = payload?.signedBoc as string | undefined;
    const bocHash = signedBoc ? hashBoc(signedBoc) : 'unknown';

    deps.logger.info({ operation: 'verify', bocHash }, 'verify request received');

    // Pre-processing rate limit: extract payer before calling facilitator
    const walletPublicKey = payload?.walletPublicKey as string | undefined;
    const earlyPayer = extractPayerFromPayload(signedBoc, walletPublicKey);
    if (earlyPayer && !deps.walletLimiter.isAllowed(earlyPayer)) {
      return c.json(
        {
          isValid: false,
          invalidReason: ServerErrorCode.rate_limited,
          invalidMessage: 'Too many requests for this wallet',
        },
        429,
      );
    }

    try {
      const result = await deps.facilitator.verify(paymentPayload, paymentRequirements);

      const durationMs = Date.now() - startTime;
      deps.logger.info(
        {
          operation: 'verify',
          payer: result.payer,
          result: result.isValid ? 'valid' : 'invalid',
          reason: result.invalidReason,
          bocHash,
          durationMs,
        },
        'verify completed',
      );

      return c.json(result);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      deps.logger.error(
        { operation: 'verify', error: (err as Error).message, bocHash, durationMs },
        'verify error',
      );
      return c.json(
        {
          isValid: false,
          invalidReason: ServerErrorCode.unexpected_error,
          invalidMessage: 'Internal verification error',
        },
        500,
      );
    }
  });

  return app;
}

import { Hono } from 'hono';
import type { Logger } from '../middleware/logging';
import type { IdempotencyStore } from '../store/idempotency-store';
import type { TxStateStore } from '../store/tx-state';
import { hashBoc, extractPayerFromPayload } from 'x402ton';
import { idempotencyMiddleware } from '../middleware/idempotency';
import { RateLimiter } from '../middleware/rate-limit';
import { validatePaymentPayload, validatePaymentRequirements, validateSettleRequirements } from './validation';
import { ServerErrorCode } from './error-codes';

interface SettleDeps {
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
    settle(
      paymentPayload: unknown,
      paymentRequirements: unknown,
    ): Promise<{
      success: boolean;
      payer?: string;
      transaction?: string;
      network?: string;
      errorReason?: string;
      errorMessage?: string;
    }>;
  };
  logger: Logger;
  idempotencyStore: IdempotencyStore;
  txStateStore: TxStateStore;
  settleLimiter: RateLimiter;
  walletLimiter: RateLimiter;
  network: string;
}

type Env = {
  Variables: {
    idempotencyKey: string;
    payloadHash: string;
    requestBody: string;
  };
};

export function settleRoute(deps: SettleDeps) {
  const app = new Hono<Env>();

  app.post('/settle', idempotencyMiddleware(deps.idempotencyStore), async (c) => {
    const startTime = Date.now();
    const idempotencyKey = c.get('idempotencyKey') as string;
    const payloadHash = c.get('payloadHash') as string;
    const rawBody = c.get('requestBody') as string;

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return c.json(
        {
          success: false,
          errorReason: 'invalid_payload',
          errorMessage: 'Malformed JSON body',
          payer: '',
          transaction: '',
          network: deps.network,
        },
        400,
      );
    }

    const { paymentPayload, paymentRequirements } = body;
    if (!paymentPayload || !paymentRequirements) {
      return c.json(
        {
          success: false,
          errorReason: 'invalid_payload',
          errorMessage: 'Missing paymentPayload or paymentRequirements',
          payer: '',
          transaction: '',
          network: deps.network,
        },
        400,
      );
    }

    // x402Version MUST be 2 (PR #1455 section 6.1)
    const x402Version = (paymentPayload as Record<string, unknown>).x402Version;
    if (x402Version !== 2) {
      return c.json(
        {
          success: false,
          errorReason: 'invalid_payload',
          errorMessage: `x402Version must be 2, got ${x402Version}`,
          payer: '',
          transaction: '',
          network: deps.network,
        },
        400,
      );
    }

    // Validate inner field types before passing to facilitator
    const payloadErr = validatePaymentPayload(paymentPayload);
    if (payloadErr) {
      return c.json(
        {
          success: false,
          errorReason: 'invalid_payload',
          errorMessage: payloadErr,
          payer: '',
          transaction: '',
          network: deps.network,
        },
        400,
      );
    }
    const requirementsErr = validatePaymentRequirements(paymentRequirements);
    if (requirementsErr) {
      return c.json(
        {
          success: false,
          errorReason: 'invalid_payload',
          errorMessage: requirementsErr,
          payer: '',
          transaction: '',
          network: deps.network,
        },
        400,
      );
    }
    const settleRequirementsErr = validateSettleRequirements(paymentRequirements);
    if (settleRequirementsErr) {
      return c.json(
        {
          success: false,
          errorReason: 'invalid_payload',
          errorMessage: settleRequirementsErr,
          payer: '',
          transaction: '',
          network: deps.network,
        },
        400,
      );
    }

    const payload = (paymentPayload as Record<string, unknown>).payload as
      | Record<string, unknown>
      | undefined;
    const signedBoc = payload?.signedBoc as string | undefined;
    const bocHash = signedBoc ? hashBoc(signedBoc) : 'unknown';

    deps.logger.info({ operation: 'settle', idempotencyKey, bocHash }, 'settle request received');

    // Pre-processing rate limit: extract payer before calling facilitator
    const walletPublicKey = payload?.walletPublicKey as string | undefined;
    const earlyPayer = extractPayerFromPayload(signedBoc, walletPublicKey);
    if (earlyPayer) {
      if (!deps.settleLimiter.isAllowed(earlyPayer)) {
        return c.json(
          {
            success: false,
            payer: earlyPayer,
            transaction: '',
            network: deps.network,
            errorReason: ServerErrorCode.rate_limited,
            errorMessage: 'Too many settlement requests for this wallet',
          },
          429,
        );
      }
      if (!deps.walletLimiter.isAllowed(earlyPayer)) {
        return c.json(
          {
            success: false,
            payer: earlyPayer,
            transaction: '',
            network: deps.network,
            errorReason: ServerErrorCode.rate_limited,
            errorMessage: 'Too many requests for this wallet',
          },
          429,
        );
      }
    }

    try {
      // Mark as SETTLING before calling facilitator
      try {
        deps.txStateStore.create(bocHash, 'SETTLING', {
          idempotencyKey,
          payer: undefined,
          network: deps.network,
        });
      } catch {
        // Another concurrent settle is already processing this BOC
        return c.json(
          {
            success: false,
            payer: '',
            transaction: '',
            network: deps.network,
            errorReason: ServerErrorCode.settlement_in_progress,
            errorMessage: 'This transaction is already being settled',
          },
          409,
        );
      }

      const result = await deps.facilitator.settle(paymentPayload, paymentRequirements);

      const response = {
        success: result.success,
        payer: result.payer || '',
        transaction: result.transaction || '',
        network: result.network || deps.network,
        ...(result.success
          ? {}
          : { errorReason: result.errorReason, errorMessage: result.errorMessage }),
      };

      // Update tx state
      if (result.success) {
        deps.txStateStore.update(bocHash, 'CONFIRMED');
        if (result.transaction) {
          deps.txStateStore.markSettled(
            result.transaction,
            idempotencyKey,
            result.payer || '',
            ((paymentRequirements as Record<string, unknown>).amount as string) || '',
          );
        }
      } else {
        deps.txStateStore.update(bocHash, 'FAILED');
      }

      // Cache response for idempotency
      deps.idempotencyStore.set(idempotencyKey, payloadHash, JSON.stringify(response));

      const durationMs = Date.now() - startTime;
      deps.logger.info(
        {
          operation: 'settle',
          idempotencyKey,
          payer: result.payer,
          txHash: result.transaction,
          result: result.success ? 'settled' : 'failed',
          reason: result.errorReason,
          bocHash,
          durationMs,
        },
        'settle completed',
      );

      return c.json(response);
    } catch (err) {
      // Mark as FAILED on unexpected error
      try {
        deps.txStateStore.update(bocHash, 'FAILED');
      } catch {
        // Ignore DB errors during error handling
      }

      const durationMs = Date.now() - startTime;
      deps.logger.error(
        { operation: 'settle', error: (err as Error).message, idempotencyKey, bocHash, durationMs },
        'settle error',
      );

      const errorResponse = {
        success: false,
        payer: '',
        transaction: '',
        network: deps.network,
        errorReason: ServerErrorCode.unexpected_settle_error,
        errorMessage: 'Internal settlement error',
      };

      // Cache error response too for idempotency
      deps.idempotencyStore.set(idempotencyKey, payloadHash, JSON.stringify(errorResponse));

      return c.json(errorResponse, 500);
    }
  });

  return app;
}

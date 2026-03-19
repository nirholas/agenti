/**
 * Payment and refund protection middleware
 */

import { OpenFacilitator } from './client.js';
import type { PaymentPayload, PaymentRequirements, SettleResponse } from './types.js';
import { reportFailure } from './claims.js';
import { isPaymentPayload } from './utils.js';

// ============ Types ============

export interface RefundProtectionConfig {
  /** The API key from server registration */
  apiKey: string;
  /** The facilitator URL (required for standalone usage) */
  facilitatorUrl: string;
  /** Optional: Custom error filter - return false to skip reporting */
  shouldReport?: (error: Error) => boolean;
  /** Optional: Called when a failure is reported */
  onReport?: (claimId: string | undefined, error: Error) => void;
  /** Optional: Called when reporting fails */
  onReportError?: (reportError: Error, originalError: Error) => void;
}

/**
 * Refund protection config for use with payment middleware.
 * The facilitatorUrl is optional and defaults to the middleware's facilitator URL.
 */
export interface MiddlewareRefundConfig {
  /** The API key from server registration */
  apiKey: string;
  /** The facilitator URL (optional - defaults to the middleware's facilitator URL) */
  facilitatorUrl?: string;
  /** Optional: Custom error filter - return false to skip reporting */
  shouldReport?: (error: Error) => boolean;
  /** Optional: Called when a failure is reported */
  onReport?: (claimId: string | undefined, error: Error) => void;
  /** Optional: Called when reporting fails */
  onReportError?: (reportError: Error, originalError: Error) => void;
}

export interface PaymentContext {
  /** Transaction hash from settlement */
  transactionHash: string;
  /** User's wallet address (payer) */
  userWallet: string;
  /** Payment amount in atomic units */
  amount: string;
  /** Asset/token address */
  asset: string;
  /** Network identifier (e.g., "base", "solana") */
  network: string;
}

// ============ Core Wrapper ============

/**
 * Wrap an async function with refund protection.
 * If the function throws, a failure is automatically reported.
 *
 * @example
 * ```typescript
 * import { withRefundProtection } from '@openfacilitator/sdk';
 *
 * const protectedHandler = withRefundProtection(
 *   {
 *     apiKey: process.env.REFUND_API_KEY!,
 *     facilitatorUrl: 'https://free.openfacilitator.xyz',
 *   },
 *   async (paymentContext) => {
 *     // Your logic here - if this throws, failure is auto-reported
 *     const result = await doExpensiveOperation();
 *     return result;
 *   }
 * );
 *
 * // Call with payment context from settle response
 * const result = await protectedHandler({
 *   transactionHash: settleResponse.transaction,
 *   userWallet: settleResponse.payer,
 *   amount: paymentPayload.payload.authorization.amount,
 *   asset: paymentPayload.payload.authorization.asset,
 *   network: settleResponse.network,
 * });
 * ```
 */
export function withRefundProtection<T>(
  config: RefundProtectionConfig,
  handler: (context: PaymentContext) => Promise<T>
): (context: PaymentContext) => Promise<T> {
  return async (context: PaymentContext): Promise<T> => {
    try {
      return await handler(context);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if we should report this error
      if (config.shouldReport && !config.shouldReport(err)) {
        throw error;
      }

      // Report the failure
      try {
        const result = await reportFailure({
          facilitatorUrl: config.facilitatorUrl,
          apiKey: config.apiKey,
          originalTxHash: context.transactionHash,
          userWallet: context.userWallet,
          amount: context.amount,
          asset: context.asset,
          network: context.network,
          reason: err.message,
        });

        if (config.onReport) {
          config.onReport(result.claimId, err);
        }
      } catch (reportError) {
        if (config.onReportError) {
          config.onReportError(
            reportError instanceof Error ? reportError : new Error(String(reportError)),
            err
          );
        }
        // Don't swallow the original error
      }

      // Re-throw the original error
      throw error;
    }
  };
}

// ============ Express Middleware ============

/**
 * Express request with payment context attached
 */
export interface PaymentRequest {
  paymentContext?: PaymentContext;
}

/**
 * Create Express middleware that attaches payment context and reports failures.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createRefundMiddleware } from '@openfacilitator/sdk';
 *
 * const app = express();
 *
 * const refundMiddleware = createRefundMiddleware({
 *   apiKey: process.env.REFUND_API_KEY!,
 *   facilitatorUrl: 'https://free.openfacilitator.xyz',
 * });
 *
 * // Apply after your x402 payment verification
 * app.post('/api/resource', paymentMiddleware, refundMiddleware, async (req, res) => {
 *   // If this throws, failure is auto-reported
 *   const result = await doExpensiveOperation();
 *   res.json(result);
 * });
 * ```
 */
export function createRefundMiddleware(config: RefundProtectionConfig) {
  return async (
    req: PaymentRequest & { body?: unknown },
    res: { locals?: { paymentContext?: PaymentContext } },
    next: (error?: unknown) => void
  ) => {
    // Store original next to wrap errors
    const originalNext = next;

    // Check for payment context in res.locals or req
    const paymentContext = res.locals?.paymentContext || req.paymentContext;

    if (!paymentContext) {
      // No payment context, skip refund protection
      return originalNext();
    }

    // Wrap next to catch async errors
    const wrappedNext = async (error?: unknown) => {
      if (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Check if we should report
        if (!config.shouldReport || config.shouldReport(err)) {
          try {
            const result = await reportFailure({
              facilitatorUrl: config.facilitatorUrl,
              apiKey: config.apiKey,
              originalTxHash: paymentContext.transactionHash,
              userWallet: paymentContext.userWallet,
              amount: paymentContext.amount,
              asset: paymentContext.asset,
              network: paymentContext.network,
              reason: err.message,
            });

            if (config.onReport) {
              config.onReport(result.claimId, err);
            }
          } catch (reportError) {
            if (config.onReportError) {
              config.onReportError(
                reportError instanceof Error ? reportError : new Error(String(reportError)),
                err
              );
            }
          }
        }
      }

      originalNext(error);
    };

    next = wrappedNext;
    originalNext();
  };
}

// ============ Hono Middleware ============

/**
 * Create Hono middleware for refund protection.
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { honoRefundMiddleware } from '@openfacilitator/sdk';
 *
 * const app = new Hono();
 *
 * // Apply after your x402 payment verification
 * app.post('/api/resource', paymentMiddleware, honoRefundMiddleware({
 *   apiKey: process.env.REFUND_API_KEY!,
 *   facilitatorUrl: 'https://free.openfacilitator.xyz',
 *   getPaymentContext: (c) => c.get('paymentContext'),
 * }), async (c) => {
 *   const result = await doExpensiveOperation();
 *   return c.json(result);
 * });
 * ```
 */
export interface HonoRefundConfig extends RefundProtectionConfig {
  /** Function to extract payment context from Hono context */
  getPaymentContext: (c: HonoContext) => PaymentContext | undefined;
}

interface HonoContext {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

export function honoRefundMiddleware(config: HonoRefundConfig) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const paymentContext = config.getPaymentContext(c);

    if (!paymentContext) {
      return next();
    }

    try {
      await next();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if we should report
      if (!config.shouldReport || config.shouldReport(err)) {
        try {
          const result = await reportFailure({
            facilitatorUrl: config.facilitatorUrl,
            apiKey: config.apiKey,
            originalTxHash: paymentContext.transactionHash,
            userWallet: paymentContext.userWallet,
            amount: paymentContext.amount,
            asset: paymentContext.asset,
            network: paymentContext.network,
            reason: err.message,
          });

          if (config.onReport) {
            config.onReport(result.claimId, err);
          }
        } catch (reportError) {
          if (config.onReportError) {
            config.onReportError(
              reportError instanceof Error ? reportError : new Error(String(reportError)),
              err
            );
          }
        }
      }

      // Re-throw the original error
      throw error;
    }
  };
}

// ============ Helper: Extract Payment Context ============

/**
 * Helper to create PaymentContext from settle response and payment payload.
 *
 * @example
 * ```typescript
 * import { OpenFacilitator, createPaymentContext } from '@openfacilitator/sdk';
 *
 * const facilitator = new OpenFacilitator({ url: '...' });
 * const settleResult = await facilitator.settle(paymentPayload, requirements);
 *
 * const paymentContext = createPaymentContext(settleResult, paymentPayload);
 * // Use with withRefundProtection or attach to request
 * ```
 */
export function createPaymentContext(
  settleResponse: { transaction: string; payer: string; network: string },
  paymentPayload: Record<string, unknown>,
  requirements?: { maxAmountRequired?: string; amount?: string; asset?: string }
): PaymentContext {
  // Try to extract amount from various payload structures
  const payload = paymentPayload.payload as Record<string, unknown> | undefined;
  const authorization = payload?.authorization as Record<string, unknown> | undefined;

  // Amount: try payload.authorization.amount, then fall back to requirements
  // Support both v1 (maxAmountRequired) and v2 (amount) requirement formats
  const amount = (authorization?.amount as string) ||
                 (payload?.amount as string) ||
                 requirements?.amount ||
                 requirements?.maxAmountRequired ||
                 '0';

  // Asset: try payload.authorization.asset, then fall back to requirements
  const asset = (authorization?.asset as string) ||
                (payload?.asset as string) ||
                requirements?.asset ||
                '';

  return {
    transactionHash: settleResponse.transaction,
    userWallet: settleResponse.payer,
    amount,
    asset,
    network: settleResponse.network,
  };
}

// ============ x402 Payment Middleware ============

export interface PaymentMiddlewareConfig {
  /** Facilitator instance or URL */
  facilitator: OpenFacilitator | string;
  /** Function to get payment requirements for the request (single or multiple for multi-network) */
  getRequirements: (req: unknown) => PaymentRequirements | PaymentRequirements[] | Promise<PaymentRequirements | PaymentRequirements[]>;
  /** Optional: Refund protection config (enables auto failure reporting) */
  refundProtection?: MiddlewareRefundConfig;
  /** Optional: Custom 402 response handler */
  on402?: (req: unknown, res: unknown, requirements: PaymentRequirements[]) => void | Promise<void>;
}

/**
 * Create x402 payment middleware that handles verification, settlement, and optional refund protection.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createPaymentMiddleware, OpenFacilitator } from '@openfacilitator/sdk';
 *
 * const app = express();
 *
 * const paymentMiddleware = createPaymentMiddleware({
 *   facilitator: new OpenFacilitator({ url: 'https://free.openfacilitator.xyz' }),
 *   getRequirements: (req) => ({
 *     scheme: 'exact',
 *     network: 'base',
 *     maxAmountRequired: '1000000', // $1 USDC
 *     asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
 *     payTo: '0xYourAddress',
 *     resource: req.url,
 *   }),
 *   refundProtection: {
 *     apiKey: process.env.REFUND_API_KEY!,
 *     facilitatorUrl: 'https://free.openfacilitator.xyz',
 *   },
 * });
 *
 * app.post('/api/resource', paymentMiddleware, async (req, res) => {
 *   // Payment verified & settled, refund protection active
 *   const result = await doExpensiveOperation();
 *   res.json(result);
 * });
 * ```
 */
export function createPaymentMiddleware(config: PaymentMiddlewareConfig) {
  const facilitator = typeof config.facilitator === 'string'
    ? new OpenFacilitator({ url: config.facilitator })
    : config.facilitator;

  return async (
    req: { headers: Record<string, string | string[] | undefined>; url?: string; paymentContext?: PaymentContext },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      locals?: Record<string, unknown>;
    },
    next: (error?: unknown) => void
  ) => {
    try {
      // Get requirements for this request (may be single or array)
      const rawRequirements = await config.getRequirements(req);
      const requirementsArray = Array.isArray(rawRequirements) ? rawRequirements : [rawRequirements];

      // Build x402 v2 accepts array once for all 402 responses (normalizes v1 → v2)
      const accepts = requirementsArray.map((requirements) => {
        const extra: Record<string, unknown> = {
          ...requirements.extra,
        };
        if (config.refundProtection) {
          extra.supportsRefunds = true;
        }

        return {
          scheme: requirements.scheme,
          network: requirements.network,
          // Normalize v1 maxAmountRequired → v2 amount
          amount: 'maxAmountRequired' in requirements ? requirements.maxAmountRequired : requirements.amount,
          asset: requirements.asset,
          payTo: requirements.payTo,
          maxTimeoutSeconds: requirements.maxTimeoutSeconds || 300,
          ...(Object.keys(extra).length > 0 ? { extra } : {}),
        };
      });

      // Check for X-PAYMENT header
      const paymentHeader = req.headers['x-payment'];
      const paymentString = Array.isArray(paymentHeader) ? paymentHeader[0] : paymentHeader;

      if (!paymentString) {
        // No payment - return 402
        if (config.on402) {
          await config.on402(req, res, requirementsArray);
        } else {
          res.status(402).json({
            x402Version: 2,
            error: 'Payment Required',
            accepts,
          });
        }
        return;
      }

      // Parse payment payload (base64 encoded JSON)
      let paymentPayload: PaymentPayload;
      try {
        const decoded = Buffer.from(paymentString, 'base64').toString('utf-8');
        paymentPayload = JSON.parse(decoded);
        if (!isPaymentPayload(paymentPayload)) {
          throw new Error('Invalid payment payload structure');
        }
      } catch {
        res.status(400).json({ error: 'Invalid X-PAYMENT header' });
        return;
      }

      // Find matching requirements based on payment network
      // v1 has network at top level, v2 has it in accepted.network
      const paymentNetwork = paymentPayload.x402Version === 2
        ? (paymentPayload as { accepted?: { network?: string } }).accepted?.network
        : (paymentPayload as { network?: string }).network;
      const requirements = requirementsArray.find((r) => r.network === paymentNetwork) || requirementsArray[0];

      // Verify payment
      const verifyResult = await facilitator.verify(paymentPayload, requirements);
      if (!verifyResult.isValid) {
        res.status(402).json({
          x402Version: 2,
          error: 'Payment verification failed',
          reason: verifyResult.invalidReason,
          accepts,
        });
        return;
      }

      // Settle payment
      const settleResult = await facilitator.settle(paymentPayload, requirements);
      if (!settleResult.success) {
        res.status(402).json({
          x402Version: 2,
          error: 'Payment settlement failed',
          reason: settleResult.errorReason,
          accepts,
        });
        return;
      }

      // Create payment context
      const paymentContext = createPaymentContext(settleResult, paymentPayload as unknown as Record<string, unknown>, requirements);

      // Attach to request and res.locals
      req.paymentContext = paymentContext;
      if (res.locals) {
        res.locals.paymentContext = paymentContext;
      }

      // If refund protection is enabled, wrap the next handler
      if (config.refundProtection) {
        const originalNext = next;
        const refundConfig = config.refundProtection;
        const refundFacilitatorUrl = refundConfig.facilitatorUrl || facilitator.url;

        next = async (error?: unknown) => {
          if (error) {
            const err = error instanceof Error ? error : new Error(String(error));

            if (!refundConfig.shouldReport || refundConfig.shouldReport(err)) {
              try {
                const result = await reportFailure({
                  facilitatorUrl: refundFacilitatorUrl,
                  apiKey: refundConfig.apiKey,
                  originalTxHash: paymentContext.transactionHash,
                  userWallet: paymentContext.userWallet,
                  amount: paymentContext.amount,
                  asset: paymentContext.asset,
                  network: paymentContext.network,
                  reason: err.message,
                });

                if (refundConfig.onReport) {
                  refundConfig.onReport(result.claimId, err);
                }
              } catch (reportError) {
                if (refundConfig.onReportError) {
                  refundConfig.onReportError(
                    reportError instanceof Error ? reportError : new Error(String(reportError)),
                    err
                  );
                }
              }
            }
          }

          originalNext(error);
        };
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ============ Hono x402 Payment Middleware ============

export interface HonoPaymentConfig {
  /** Facilitator instance or URL */
  facilitator: OpenFacilitator | string;
  /** Function to get payment requirements for the request (single or multiple for multi-network) */
  getRequirements: (c: HonoContext) => PaymentRequirements | PaymentRequirements[] | Promise<PaymentRequirements | PaymentRequirements[]>;
  /** Optional: Refund protection config */
  refundProtection?: MiddlewareRefundConfig;
}

/**
 * Create Hono x402 payment middleware.
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { honoPaymentMiddleware, OpenFacilitator } from '@openfacilitator/sdk';
 *
 * const app = new Hono();
 *
 * app.post('/api/resource', honoPaymentMiddleware({
 *   facilitator: new OpenFacilitator({ url: 'https://free.openfacilitator.xyz' }),
 *   getRequirements: (c) => ({
 *     scheme: 'exact',
 *     network: 'base',
 *     maxAmountRequired: '1000000',
 *     asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
 *     payTo: '0xYourAddress',
 *   }),
 *   refundProtection: {
 *     apiKey: process.env.REFUND_API_KEY!,
 *     facilitatorUrl: 'https://free.openfacilitator.xyz',
 *   },
 * }), async (c) => {
 *   const paymentContext = c.get('paymentContext');
 *   const result = await doExpensiveOperation();
 *   return c.json(result);
 * });
 * ```
 */
export function honoPaymentMiddleware(config: HonoPaymentConfig) {
  const facilitator = typeof config.facilitator === 'string'
    ? new OpenFacilitator({ url: config.facilitator })
    : config.facilitator;

  return async (
    c: HonoContext & {
      req: { header: (name: string) => string | undefined; url: string };
      json: (body: unknown, status?: number) => Response;
    },
    next: () => Promise<void>
  ) => {
    // Get requirements (may be single or array)
    const rawRequirements = await config.getRequirements(c);
    const requirementsArray = Array.isArray(rawRequirements) ? rawRequirements : [rawRequirements];

    // Build x402 v2 accepts array once for all 402 responses (normalizes v1 → v2)
    const accepts = requirementsArray.map((requirements) => {
      const extra: Record<string, unknown> = {
        ...requirements.extra,
      };
      if (config.refundProtection) {
        extra.supportsRefunds = true;
      }

      return {
        scheme: requirements.scheme,
        network: requirements.network,
        // Normalize v1 maxAmountRequired → v2 amount
        amount: 'maxAmountRequired' in requirements ? requirements.maxAmountRequired : requirements.amount,
        asset: requirements.asset,
        payTo: requirements.payTo,
        maxTimeoutSeconds: requirements.maxTimeoutSeconds || 300,
        ...(Object.keys(extra).length > 0 ? { extra } : {}),
      };
    });

    // Check for X-PAYMENT header
    const paymentString = c.req.header('x-payment');

    if (!paymentString) {
      return c.json({
        x402Version: 2,
        error: 'Payment Required',
        accepts,
      }, 402);
    }

    // Parse payment payload (base64 encoded JSON)
    let paymentPayload: PaymentPayload;
    try {
      const decoded = atob(paymentString);
      paymentPayload = JSON.parse(decoded);
      if (!isPaymentPayload(paymentPayload)) {
        throw new Error('Invalid payment payload structure');
      }
    } catch {
      return c.json({ error: 'Invalid X-PAYMENT header' }, 400);
    }

    // Find matching requirements based on payment network
    // v1 has network at top level, v2 has it in accepted.network
    const paymentNetwork = paymentPayload.x402Version === 2
      ? (paymentPayload as { accepted?: { network?: string } }).accepted?.network
      : (paymentPayload as { network?: string }).network;
    const requirements = requirementsArray.find((r) => r.network === paymentNetwork) || requirementsArray[0];

    // Verify payment
    const verifyResult = await facilitator.verify(paymentPayload, requirements);
    if (!verifyResult.isValid) {
      return c.json({
        x402Version: 2,
        error: 'Payment verification failed',
        reason: verifyResult.invalidReason,
        accepts,
      }, 402);
    }

    // Settle payment
    const settleResult = await facilitator.settle(paymentPayload, requirements);
    if (!settleResult.success) {
      return c.json({
        x402Version: 2,
        error: 'Payment settlement failed',
        reason: settleResult.errorReason,
        accepts,
      }, 402);
    }

    // Create and attach payment context
    const paymentContext = createPaymentContext(settleResult, paymentPayload as unknown as Record<string, unknown>, requirements);
    c.set('paymentContext', paymentContext);

    // Handle with optional refund protection
    if (config.refundProtection) {
      const refundConfig = config.refundProtection;
      const refundFacilitatorUrl = refundConfig.facilitatorUrl || facilitator.url;

      try {
        await next();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (!refundConfig.shouldReport || refundConfig.shouldReport(err)) {
          try {
            const result = await reportFailure({
              facilitatorUrl: refundFacilitatorUrl,
              apiKey: refundConfig.apiKey,
              originalTxHash: paymentContext.transactionHash,
              userWallet: paymentContext.userWallet,
              amount: paymentContext.amount,
              asset: paymentContext.asset,
              network: paymentContext.network,
              reason: err.message,
            });

            if (refundConfig.onReport) {
              refundConfig.onReport(result.claimId, err);
            }
          } catch (reportError) {
            if (refundConfig.onReportError) {
              refundConfig.onReportError(
                reportError instanceof Error ? reportError : new Error(String(reportError)),
                err
              );
            }
          }
        }

        throw error;
      }
    } else {
      await next();
    }
  };
}

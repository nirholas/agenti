/**
 * Gasless Settlement Route
 * 
 * POST /settle - Execute EIP-3009 gasless settlements for USDs
 */

import { Router, type Request, type Response } from 'express';
import type { Address } from 'viem';
import type { USdsService } from '../services/usds.js';
import type { PaymentCache } from '../services/cache.js';
import type { SettleRequest, SettleResponse, ErrorResponse, EIP3009Authorization } from '../types.js';
import { logger } from '../middleware/logger.js';
import { createSettlementRateLimiter } from '../middleware/rateLimit.js';

/**
 * Required fields for EIP-3009 authorization
 */
const REQUIRED_AUTH_FIELDS = [
  'from',
  'to',
  'value',
  'validAfter',
  'validBefore',
  'nonce',
  'v',
  'r',
  's',
] as const;

/**
 * Create settlement router
 */
export function createSettleRouter(
  usdsService: USdsService,
  paymentCache: PaymentCache
): Router {
  const router = Router();

  // Apply stricter rate limiting for settlements
  router.use(createSettlementRateLimiter());

  /**
   * POST /settle - Execute gasless settlement
   */
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as Partial<SettleRequest>;

    // Validate required fields
    if (!body.authorization) {
      return res.status(400).json({
        error: 'Missing required field: authorization',
        code: 'MISSING_AUTHORIZATION',
      } satisfies ErrorResponse);
    }

    if (!body.paymentRequest) {
      return res.status(400).json({
        error: 'Missing required field: paymentRequest',
        code: 'MISSING_PAYMENT_REQUEST',
      } satisfies ErrorResponse);
    }

    const { authorization, paymentRequest } = body;

    // Validate authorization structure
    const missingFields = REQUIRED_AUTH_FIELDS.filter(
      (field) => authorization[field] === undefined
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Invalid authorization structure',
        code: 'INVALID_AUTHORIZATION',
        details: { missingFields },
      } satisfies ErrorResponse);
    }

    // Validate token is USDs (only supported for gasless)
    if (paymentRequest.token !== 'USDs') {
      return res.status(400).json({
        error: 'Gasless settlements only support USDs token',
        code: 'UNSUPPORTED_TOKEN',
      } satisfies ErrorResponse);
    }

    // Validate deadline
    const now = Math.floor(Date.now() / 1000);
    if (now > authorization.validBefore) {
      return res.status(400).json({
        error: 'Authorization expired',
        code: 'AUTHORIZATION_EXPIRED',
        details: {
          validBefore: authorization.validBefore,
          currentTime: now,
        },
      } satisfies ErrorResponse);
    }

    if (now < authorization.validAfter) {
      return res.status(400).json({
        error: 'Authorization not yet valid',
        code: 'AUTHORIZATION_NOT_VALID_YET',
        details: {
          validAfter: authorization.validAfter,
          currentTime: now,
        },
      } satisfies ErrorResponse);
    }

    logger.info('Processing gasless settlement', {
      from: authorization.from,
      to: authorization.to,
      value: authorization.value,
      token: paymentRequest.token,
      nonce: authorization.nonce,
    });

    try {
      // Execute the settlement
      const result = await usdsService.executeTransferWithAuthorization(
        authorization as EIP3009Authorization
      );

      if (result.success && result.txHash) {
        // Cache the settled payment
        paymentCache.set(result.txHash, {
          txHash: result.txHash,
          verified: true,
          settled: true,
          amount: paymentRequest.price,
          token: paymentRequest.token,
          from: authorization.from as Address,
          to: authorization.to as Address,
          timestamp: Date.now(),
        });

        logger.info('Gasless settlement successful', {
          txHash: result.txHash,
          gasUsed: result.gasUsed,
        });

        return res.json({
          success: true,
          txHash: result.txHash,
          timestamp: Date.now(),
          gasUsed: result.gasUsed,
          effectiveGasPrice: result.effectiveGasPrice,
        } satisfies SettleResponse);
      }

      // Settlement failed
      logger.warn('Gasless settlement failed', {
        error: result.error,
        from: authorization.from,
        to: authorization.to,
      });

      return res.status(400).json({
        success: false,
        txHash: '',
        timestamp: Date.now(),
        error: result.error || 'Settlement failed',
      } satisfies SettleResponse);
    } catch (error) {
      logger.error('Error during settlement', { error });
      return res.status(500).json({
        error: 'Internal server error during settlement',
        code: 'SETTLEMENT_ERROR',
        details: String(error),
      } satisfies ErrorResponse);
    }
  });

  return router;
}

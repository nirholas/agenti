/**
 * Payment Status Route
 * 
 * GET /payments/:txHash - Get payment status
 */

import { Router, type Request, type Response } from 'express';
import type { PaymentCache } from '../services/cache.js';
import type { ArbitrumClient } from '../services/arbitrum.js';
import type { PaymentStatus, ErrorResponse } from '../types.js';
import { logger } from '../middleware/logger.js';

/**
 * Create payments router
 */
export function createPaymentsRouter(
  arbitrumClient: ArbitrumClient,
  paymentCache: PaymentCache
): Router {
  const router = Router();

  /**
   * GET /payments/:txHash - Get payment status
   */
  router.get('/:txHash', async (req: Request, res: Response) => {
    const { txHash } = req.params;

    // Validate txHash format
    if (!txHash || !txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return res.status(400).json({
        error: 'Invalid transaction hash format',
        code: 'INVALID_TX_HASH',
      } satisfies ErrorResponse);
    }

    logger.info('Querying payment status', { txHash });

    try {
      // Check cache first
      const cached = paymentCache.get(txHash);
      if (cached) {
        const status = paymentCache.toStatus(cached);
        logger.debug('Payment status (cached)', { txHash, verified: status.verified });
        return res.json({
          ...status,
          age: Date.now() - status.timestamp,
          cached: true,
        });
      }

      // Check on-chain
      const receipt = await arbitrumClient.getTransactionReceipt(txHash as `0x${string}`);

      if (!receipt) {
        return res.status(404).json({
          error: 'Payment not found',
          code: 'PAYMENT_NOT_FOUND',
          txHash,
        } satisfies ErrorResponse);
      }

      // Build status from on-chain data
      const status: PaymentStatus & { age: number; cached: boolean } = {
        txHash,
        verified: receipt.status === 'success',
        settled: receipt.status === 'success',
        amount: '0', // Would need to parse logs to get amount
        token: 'USDs', // Assume USDs
        from: receipt.from,
        to: receipt.to || undefined,
        timestamp: Date.now(),
        blockNumber: Number(receipt.blockNumber),
        age: 0,
        cached: false,
      };

      logger.info('Payment status (on-chain)', {
        txHash,
        verified: status.verified,
        blockNumber: status.blockNumber,
      });

      return res.json(status);
    } catch (error) {
      logger.error('Error querying payment status', { error, txHash });
      return res.status(500).json({
        error: 'Internal server error',
        code: 'STATUS_QUERY_ERROR',
        details: String(error),
      } satisfies ErrorResponse);
    }
  });

  /**
   * GET /payments - List recent payments (from cache)
   */
  router.get('/', (_req: Request, res: Response) => {
    const stats = paymentCache.getStats();
    const payments = paymentCache.getAll();

    res.json({
      count: payments.length,
      cacheStats: stats,
      payments: payments.slice(0, 100).map((p) => ({
        txHash: p.txHash,
        verified: p.verified,
        settled: p.settled,
        amount: p.amount,
        token: p.token,
        timestamp: p.timestamp,
        age: Date.now() - p.timestamp,
      })),
    });
  });

  return router;
}

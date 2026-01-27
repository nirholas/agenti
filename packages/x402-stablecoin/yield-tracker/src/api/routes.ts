/**
 * REST API Routes
 * 
 * Express routes for the USDs Yield Tracker API.
 * 
 * Endpoints:
 * - GET /yield/:address - Get current yield info for address
 * - GET /yield/:address/history - Historical yield data
 * - GET /apy - Current USDs APY
 * - GET /rebase/latest - Latest rebase event info
 * - POST /track - Start tracking a payment
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { YieldTracker } from '../tracker.js';
import type { ApiResponse } from '../types.js';

/**
 * Validation schemas
 */
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

const trackPaymentSchema = z.object({
  address: addressSchema,
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  amount: z.string().regex(/^\d+\.?\d*$/, 'Invalid amount'),
  description: z.string().optional(),
});

const historyQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const estimateQuerySchema = z.object({
  balance: z.string().regex(/^\d+\.?\d*$/),
  days: z.string().regex(/^\d+$/).transform(Number),
});

/**
 * Create API response wrapper
 */
function createResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Create error response
 */
function createErrorResponse(error: string): ApiResponse<never> {
  return {
    success: false,
    error,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Create API router
 */
export function createApiRouter(tracker: YieldTracker): Router {
  const router = Router();

  /**
   * GET /health - Health check
   */
  router.get('/health', (req: Request, res: Response) => {
    const status = tracker.getStatus();
    res.json(createResponse({
      status: status.isRunning ? 'healthy' : 'degraded',
      ...status,
    }));
  });

  /**
   * GET /yield/:address - Get current yield info for address
   */
  router.get('/yield/:address', async (req: Request, res: Response) => {
    try {
      const address = addressSchema.parse(req.params.address);
      const yieldInfo = await tracker.getYieldInfo(address as `0x${string}`);
      res.json(createResponse(yieldInfo));
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(createErrorResponse(error.errors[0].message));
      } else {
        console.error('Error getting yield info:', error);
        res.status(500).json(createErrorResponse('Failed to get yield info'));
      }
    }
  });

  /**
   * GET /yield/:address/history - Historical yield data
   */
  router.get('/yield/:address/history', async (req: Request, res: Response) => {
    try {
      const address = addressSchema.parse(req.params.address);
      const query = historyQuerySchema.parse(req.query);
      const limit = query.limit || 100;
      
      const history = await tracker.getYieldHistory(address as `0x${string}`, limit);
      res.json(createResponse(history));
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(createErrorResponse(error.errors[0].message));
      } else {
        console.error('Error getting yield history:', error);
        res.status(500).json(createErrorResponse('Failed to get yield history'));
      }
    }
  });

  /**
   * GET /yield/:address/payments - Get all payments for an address
   */
  router.get('/yield/:address/payments', async (req: Request, res: Response) => {
    try {
      const address = addressSchema.parse(req.params.address);
      const payments = tracker.getPayments(address as `0x${string}`);
      res.json(createResponse({
        address,
        payments,
        count: payments.length,
      }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(createErrorResponse(error.errors[0].message));
      } else {
        console.error('Error getting payments:', error);
        res.status(500).json(createErrorResponse('Failed to get payments'));
      }
    }
  });

  /**
   * GET /apy - Current USDs APY
   */
  router.get('/apy', async (req: Request, res: Response) => {
    try {
      const apyInfo = await tracker.getAPYInfo();
      res.json(createResponse(apyInfo));
    } catch (error) {
      console.error('Error getting APY:', error);
      res.status(500).json(createErrorResponse('Failed to get APY info'));
    }
  });

  /**
   * GET /rebase/latest - Latest rebase event info
   */
  router.get('/rebase/latest', (req: Request, res: Response) => {
    try {
      const latestRebase = tracker.getLatestRebase();
      if (!latestRebase) {
        res.status(404).json(createErrorResponse('No rebase events tracked yet'));
        return;
      }
      res.json(createResponse(latestRebase));
    } catch (error) {
      console.error('Error getting latest rebase:', error);
      res.status(500).json(createErrorResponse('Failed to get latest rebase'));
    }
  });

  /**
   * GET /rebase/history - Rebase event history
   */
  router.get('/rebase/history', (req: Request, res: Response) => {
    try {
      const fromTimestamp = req.query.from 
        ? parseInt(req.query.from as string) 
        : Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // Last 30 days
      const toTimestamp = req.query.to 
        ? parseInt(req.query.to as string) 
        : undefined;
      
      const events = tracker.getRebaseEvents(fromTimestamp, toTimestamp);
      res.json(createResponse({
        events,
        count: events.length,
        fromTimestamp,
        toTimestamp: toTimestamp || Math.floor(Date.now() / 1000),
      }));
    } catch (error) {
      console.error('Error getting rebase history:', error);
      res.status(500).json(createErrorResponse('Failed to get rebase history'));
    }
  });

  /**
   * POST /track - Start tracking a payment
   */
  router.post('/track', async (req: Request, res: Response) => {
    try {
      const data = trackPaymentSchema.parse(req.body);
      
      const payment = await tracker.trackPayment({
        address: data.address as `0x${string}`,
        txHash: data.txHash,
        amount: data.amount,
        description: data.description,
      });
      
      res.status(201).json(createResponse(payment));
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(createErrorResponse(error.errors[0].message));
      } else {
        console.error('Error tracking payment:', error);
        res.status(500).json(createErrorResponse('Failed to track payment'));
      }
    }
  });

  /**
   * GET /estimate - Estimate future yield
   */
  router.get('/estimate', async (req: Request, res: Response) => {
    try {
      const query = estimateQuerySchema.parse(req.query);
      const estimate = await tracker.estimateFutureYield(query.balance, query.days);
      res.json(createResponse(estimate));
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(createErrorResponse(error.errors[0].message));
      } else {
        console.error('Error estimating yield:', error);
        res.status(500).json(createErrorResponse('Failed to estimate yield'));
      }
    }
  });

  /**
   * GET /contract/state - Get USDs contract state
   */
  router.get('/contract/state', async (req: Request, res: Response) => {
    try {
      const state = await tracker.getContractState();
      res.json(createResponse(state));
    } catch (error) {
      console.error('Error getting contract state:', error);
      res.status(500).json(createErrorResponse('Failed to get contract state'));
    }
  });

  /**
   * GET /payment/:id - Get payment by ID
   */
  router.get('/payment/:id', (req: Request, res: Response) => {
    try {
      const payment = tracker.getPayment(req.params.id);
      if (!payment) {
        res.status(404).json(createErrorResponse('Payment not found'));
        return;
      }
      res.json(createResponse(payment));
    } catch (error) {
      console.error('Error getting payment:', error);
      res.status(500).json(createErrorResponse('Failed to get payment'));
    }
  });

  return router;
}

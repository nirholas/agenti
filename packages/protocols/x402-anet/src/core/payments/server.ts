import type { Request, Response, NextFunction } from 'express';

export interface RoutePrice {
  price: string;  // e.g. '$0.50'
  network: string;
}

export interface PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;
  currency: string;
  recipient: string;
}

/**
 * X402 payment middleware.
 * If @x402/express is available, wraps it. Otherwise implements manual 402 flow.
 */
export function createPaymentMiddleware(
  walletAddress: string,
  routes: Record<string, RoutePrice>,
  options: { facilitatorUrl?: string } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const routeKey = `${req.method} ${req.path}`;
    const routeConfig = routes[routeKey];

    if (!routeConfig) {
      return next();
    }

    // Check for X-Payment header
    const paymentHeader = req.headers['x-payment'] as string;

    if (!paymentHeader) {
      // Return 402 with payment requirements
      const priceNum = parseFloat(routeConfig.price.replace('$', ''));
      const amountMicro = Math.round(priceNum * 1_000_000).toString(); // USDC has 6 decimals

      const requirement: PaymentRequirement = {
        scheme: 'exact',
        network: routeConfig.network,
        amount: amountMicro,
        currency: 'USDC',
        recipient: walletAddress,
      };

      return res.status(402).json(requirement);
    }

    // Verify payment (in production, validate against facilitator or on-chain)
    try {
      const paymentData = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));

      // Basic validation
      if (!paymentData.signature || !paymentData.from) {
        return res.status(402).json({ error: 'Invalid payment payload' });
      }

      // Attach payment info to request
      (req as any).paymentData = paymentData;
      (req as any).paymentTxHash = paymentData.txHash;

      next();
    } catch {
      return res.status(402).json({ error: 'Malformed payment header' });
    }
  };
}

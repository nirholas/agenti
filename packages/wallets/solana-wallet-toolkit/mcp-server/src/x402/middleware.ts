/**
 * x402 Payment Integration for Solana Wallet MCP
 * 
 * This module provides x402 payment protocol integration for monetizing
 * MCP tools with HTTP 402 Payment Required responses.
 */

export interface X402Config {
  price: string;
  token: string;
  chain: string;
  recipient?: string;
  description?: string;
  freeTier?: {
    calls: number;
    period: number;
  };
}

export interface PaymentProof {
  signature: string;
  timestamp: number;
  amount: string;
  token: string;
  payer: string;
}

const DEFAULT_CONFIG: X402Config = {
  price: '0.001',
  token: 'USDC',
  chain: 'solana',
  recipient: process.env.X402_RECIPIENT || 'YOUR_SOLANA_ADDRESS',
  freeTier: {
    calls: 10,
    period: 3600,
  },
};

const usageCache = new Map<string, { count: number; periodStart: number }>();

function checkFreeTier(clientId: string, config: X402Config): boolean {
  const now = Date.now() / 1000;
  const freeTier = config.freeTier || DEFAULT_CONFIG.freeTier!;
  
  let usage = usageCache.get(clientId);
  
  if (!usage || now - usage.periodStart > freeTier.period) {
    usage = { count: 0, periodStart: now };
    usageCache.set(clientId, usage);
  }
  
  if (usage.count < freeTier.calls) {
    usage.count++;
    return true;
  }
  
  return false;
}

function verifyPayment(proof: PaymentProof | undefined, config: X402Config): boolean {
  if (!proof) return false;
  
  // Check timestamp (within 5 minutes)
  const now = Date.now() / 1000;
  if (Math.abs(now - proof.timestamp) > 300) return false;
  
  // Check token
  if (proof.token !== config.token) return false;
  
  // Check amount
  if (parseFloat(proof.amount) < parseFloat(config.price)) return false;
  
  // In production, verify cryptographic signature
  return true;
}

export function createPaymentRequired(config: X402Config = DEFAULT_CONFIG) {
  return {
    error: {
      code: 402,
      message: 'Payment Required',
      x402: {
        version: '1.0',
        price: config.price,
        token: config.token,
        chain: config.chain,
        recipient: config.recipient,
        description: config.description,
        accepts: ['x402-payment'],
      },
    },
  };
}

export function withX402<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  config: Partial<X402Config> = {}
): T {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const wrapped = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Extract context
    const context = args[0]?._context || {};
    const clientId = context.clientId || 'anonymous';
    const paymentProof = context.x402Payment;
    
    // Check free tier
    if (checkFreeTier(clientId, finalConfig)) {
      return handler(...args);
    }
    
    // Verify payment
    if (verifyPayment(paymentProof, finalConfig)) {
      return handler(...args);
    }
    
    // Return 402
    return createPaymentRequired(finalConfig) as ReturnType<T>;
  };
  
  // Attach pricing info
  (wrapped as any)._x402Config = finalConfig;
  
  return wrapped as T;
}

export function pricingInfo(config: X402Config = DEFAULT_CONFIG): string {
  return `💰 ${config.price} ${config.token} per call (${config.chain})`;
}

export { DEFAULT_CONFIG };

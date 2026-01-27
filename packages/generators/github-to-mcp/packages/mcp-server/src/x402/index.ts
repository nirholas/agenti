/**
 * x402 Payment Integration for GitHub-to-MCP
 */

export interface X402Config {
  price: string;
  token: string;
  chain: string;
  recipient?: string;
  description?: string;
  freeTier?: { calls: number; period: number };
}

const DEFAULT_CONFIG: X402Config = {
  price: '0.005',
  token: 'USDC',
  chain: 'base',
  recipient: process.env.X402_RECIPIENT || '0x1234567890123456789012345678901234567890',
  freeTier: { calls: 5, period: 3600 },
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

function verifyPayment(proof: any, config: X402Config): boolean {
  if (!proof) return false;
  try {
    const now = Date.now() / 1000;
    if (Math.abs(now - proof.timestamp) > 300) return false;
    if (proof.token !== config.token) return false;
    if (parseFloat(proof.amount) < parseFloat(config.price)) return false;
    return true;
  } catch {
    return false;
  }
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
    const context = args[0]?._context || {};
    const clientId = context.clientId || 'anonymous';
    const paymentProof = context.x402Payment;
    
    if (checkFreeTier(clientId, finalConfig)) {
      return handler(...args);
    }
    
    if (verifyPayment(paymentProof, finalConfig)) {
      return handler(...args);
    }
    
    return createPaymentRequired(finalConfig) as ReturnType<T>;
  };
  
  (wrapped as any)._x402Config = finalConfig;
  return wrapped as T;
}

export function pricingInfo(config: X402Config = DEFAULT_CONFIG): string {
  return `💰 ${config.price} ${config.token} per call (${config.chain})`;
}

export { DEFAULT_CONFIG };

/**
 * x402 Payment Middleware for Openbare Registry
 * 
 * Provides payment gating for registry operations using x402 protocol.
 */

const DEFAULT_CONFIG = {
  price: '0.001',
  token: 'USDC',
  chain: 'base',
  recipient: process.env.X402_RECIPIENT || '0x1234567890123456789012345678901234567890',
  freeTier: {
    calls: 100,  // Registry lookups are cheap
    period: 3600,
  },
};

const usageCache = new Map();

function checkFreeTier(clientId, config = DEFAULT_CONFIG) {
  const now = Date.now() / 1000;
  const freeTier = config.freeTier || DEFAULT_CONFIG.freeTier;
  
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

function verifyPayment(proof, config = DEFAULT_CONFIG) {
  if (!proof) return false;
  
  try {
    const data = typeof proof === 'string' ? JSON.parse(proof) : proof;
    const now = Date.now() / 1000;
    
    if (Math.abs(now - data.timestamp) > 300) return false;
    if (data.token !== config.token) return false;
    if (parseFloat(data.amount) < parseFloat(config.price)) return false;
    
    return true;
  } catch {
    return false;
  }
}

function createPaymentRequired(config = DEFAULT_CONFIG) {
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

function withX402(handler, config = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  return async (req, res, next) => {
    const clientId = req.headers['x-client-id'] || req.ip || 'anonymous';
    const paymentHeader = req.headers['x-payment'];
    
    if (checkFreeTier(clientId, finalConfig)) {
      return handler(req, res, next);
    }
    
    if (verifyPayment(paymentHeader, finalConfig)) {
      return handler(req, res, next);
    }
    
    return res.status(402).json(createPaymentRequired(finalConfig));
  };
}

function x402Middleware(config = DEFAULT_CONFIG) {
  return (req, res, next) => {
    const clientId = req.headers['x-client-id'] || req.ip || 'anonymous';
    const paymentHeader = req.headers['x-payment'];
    
    if (checkFreeTier(clientId, config)) {
      return next();
    }
    
    if (verifyPayment(paymentHeader, config)) {
      return next();
    }
    
    return res.status(402).json(createPaymentRequired(config));
  };
}

function pricingInfo(config = DEFAULT_CONFIG) {
  return `💰 ${config.price} ${config.token} per call (${config.chain})`;
}

module.exports = {
  DEFAULT_CONFIG,
  checkFreeTier,
  verifyPayment,
  createPaymentRequired,
  withX402,
  x402Middleware,
  pricingInfo,
};

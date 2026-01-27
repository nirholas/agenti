/**
 * Mock Facilitator Server for X402 Testing
 * 
 * Simulates payment verification and settlement endpoints
 * for local development and testing
 */

import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// In-memory storage for payments (reset on restart)
const paymentStore = new Map<string, {
  txHash: string;
  verified: boolean;
  amount: string;
  token: string;
  timestamp: number;
}>();

// CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Payment');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * Payment Verification Endpoint
 * 
 * Validates that a payment transaction was executed on-chain
 * POST /verify
 */
app.post('/verify', (req: Request, res: Response) => {
  const { txHash, paymentRequest, signature } = req.body;

  console.log('📋 Verify Payment Request:', {
    txHash,
    amount: paymentRequest?.price,
    token: paymentRequest?.token,
    recipient: paymentRequest?.recipient,
  });

  // Validate required fields
  if (!txHash || !paymentRequest) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['txHash', 'paymentRequest'],
    });
  }

  // Simulate blockchain verification delay (500-1500ms)
  const delay = Math.random() * 1000 + 500;
  
  setTimeout(() => {
    // Store verified payment
    paymentStore.set(txHash, {
      txHash,
      verified: true,
      amount: paymentRequest.price,
      token: paymentRequest.token,
      timestamp: Date.now(),
    });

    console.log('✅ Payment Verified:', txHash);

    res.json({
      verified: true,
      txHash,
      timestamp: Date.now(),
      blockNumber: Math.floor(Math.random() * 1000000) + 12000000,
      confirmations: Math.floor(Math.random() * 10) + 1,
    });
  }, delay);
});

/**
 * Gasless Payment Settlement Endpoint
 * 
 * Executes EIP-3009 transferWithAuthorization on behalf of user
 * POST /settle
 */
app.post('/settle', (req: Request, res: Response) => {
  const { authorization, paymentRequest } = req.body;

  console.log('💸 Settle Gasless Payment:', {
    from: authorization?.from,
    to: authorization?.to,
    value: authorization?.value,
    token: paymentRequest?.token,
    nonce: authorization?.nonce,
  });

  // Validate required fields
  if (!authorization || !paymentRequest) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['authorization', 'paymentRequest'],
    });
  }

  // Validate authorization structure
  const requiredAuthFields = ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce', 'v', 'r', 's'];
  const missingFields = requiredAuthFields.filter(field => !(field in authorization));
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Invalid authorization structure',
      missingFields,
    });
  }

  // Check deadline hasn't expired
  const now = Math.floor(Date.now() / 1000);
  if (now > authorization.validBefore) {
    return res.status(400).json({
      error: 'Authorization expired',
      validBefore: authorization.validBefore,
      currentTime: now,
    });
  }

  // Simulate on-chain settlement delay (1-3 seconds)
  const delay = Math.random() * 2000 + 1000;
  
  setTimeout(() => {
    // Generate mock transaction hash
    const mockTxHash = `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`;
    
    // Store settlement
    paymentStore.set(mockTxHash, {
      txHash: mockTxHash,
      verified: true,
      amount: paymentRequest.price,
      token: paymentRequest.token,
      timestamp: Date.now(),
    });

    console.log('✅ Gasless Payment Settled:', mockTxHash);

    res.json({
      success: true,
      txHash: mockTxHash,
      timestamp: Date.now(),
      gasUsed: '50000',
      effectiveGasPrice: '1000000000',
    });
  }, delay);
});

/**
 * Payment Status Query Endpoint
 * 
 * Check if a payment has been verified
 * GET /payment/:txHash
 */
app.get('/payment/:txHash', (req: Request, res: Response) => {
  const { txHash } = req.params;

  console.log('🔍 Query Payment Status:', txHash);

  const payment = paymentStore.get(txHash);

  if (!payment) {
    return res.status(404).json({
      error: 'Payment not found',
      txHash,
    });
  }

  res.json({
    ...payment,
    age: Date.now() - payment.timestamp,
  });
});

/**
 * Quote Generation Endpoint (for HTTP 402 flow)
 * 
 * Returns payment requirement for AI service
 * POST /quote
 */
app.post('/quote', (req: Request, res: Response) => {
  const { service, params } = req.body;

  console.log('💰 Generate Quote:', { service, params });

  // Calculate price based on service
  let price = '0.0001'; // Default price in USD
  
  if (service === 'gpt-4') {
    price = '0.001';
  } else if (service === 'claude-3') {
    price = '0.0005';
  } else if (service === 'dall-e-3') {
    price = '0.002';
  }

  const quote = {
    price,
    token: 'USDs',
    chain: 'arbitrum',
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    description: `${service} API call`,
  };

  console.log('📊 Quote Generated:', quote);

  res.json(quote);
});

/**
 * Health Check Endpoint
 * GET /health
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    paymentsProcessed: paymentStore.size,
    timestamp: Date.now(),
  });
});

/**
 * Statistics Endpoint
 * GET /stats
 */
app.get('/stats', (req: Request, res: Response) => {
  const payments = Array.from(paymentStore.values());
  
  const stats = {
    totalPayments: payments.length,
    totalVolume: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
    byToken: payments.reduce((acc, p) => {
      acc[p.token] = (acc[p.token] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    lastPayment: payments.length > 0 ? payments[payments.length - 1] : null,
  };

  res.json(stats);
});

/**
 * Reset Storage (for testing)
 * POST /reset
 */
app.post('/reset', (req: Request, res: Response) => {
  const count = paymentStore.size;
  paymentStore.clear();
  
  console.log(`🔄 Storage Reset: ${count} payments cleared`);
  
  res.json({
    success: true,
    paymentsCleared: count,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('❌ Error:', err.message);
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Start server
const PORT = parseInt(process.env.FACILITATOR_PORT || '3002');
const HOST = process.env.FACILITATOR_HOST || 'localhost';

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 Mock X402 Facilitator Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 URL: http://${HOST}:${PORT}`);
  console.log('');
  console.log('📌 Available Endpoints:');
  console.log(`   POST   /verify      - Verify payment transaction`);
  console.log(`   POST   /settle      - Settle gasless payment`);
  console.log(`   POST   /quote       - Generate payment quote`);
  console.log(`   GET    /payment/:tx - Query payment status`);
  console.log(`   GET    /health      - Health check`);
  console.log(`   GET    /stats       - Payment statistics`);
  console.log(`   POST   /reset       - Clear storage`);
  console.log('');
  console.log('💡 Usage:');
  console.log(`   export FACILITATOR_URL=http://${HOST}:${PORT}`);
  console.log(`   pnpm test src/x402/tests/integration.test.ts`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️  SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⏹️  SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;

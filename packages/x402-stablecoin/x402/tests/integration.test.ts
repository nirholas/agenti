/**
 * Arbitrum X402 Integration Tests
 * 
 * End-to-end tests for complete payment flows
 * Requires: Arbitrum Sepolia testnet, test tokens, mock facilitator
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createArbitrumAdapter, ArbitrumX402Adapter } from '../arbitrum-adapter';
import { Address, parseUnits } from 'viem';
import express, { Express } from 'express';
import { Server } from 'http';

// Test configuration
const TEST_CONFIG = {
  network: 'sepolia' as const,
  rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
  privateKey: process.env.TEST_PRIVATE_KEY as `0x${string}`,
  recipient: process.env.TEST_RECIPIENT as Address,
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3002',
};

describe('Arbitrum X402 Integration Tests', () => {
  let adapter: ArbitrumX402Adapter;
  let mockFacilitatorServer: Server;
  let facilitatorApp: Express;
  
  // Track payment verifications for testing
  const verifiedPayments = new Map<string, boolean>();

  beforeAll(async () => {
    // Skip integration tests if no private key configured
    if (!TEST_CONFIG.privateKey) {
      console.log('⚠️  Skipping integration tests - TEST_PRIVATE_KEY not set');
      return;
    }

    // Create adapter
    adapter = createArbitrumAdapter({
      network: TEST_CONFIG.network,
      rpcUrl: TEST_CONFIG.rpcUrl,
      privateKey: TEST_CONFIG.privateKey,
      facilitatorUrl: TEST_CONFIG.facilitatorUrl,
    });

    // Start mock facilitator server
    facilitatorApp = express();
    facilitatorApp.use(express.json());

    // Mock /verify endpoint
    facilitatorApp.post('/verify', (req, res) => {
      const { txHash, paymentRequest, signature } = req.body;

      if (!txHash || !paymentRequest) {
        return res.status(400).json({
          error: 'Missing required fields',
        });
      }

      // Mark payment as verified
      verifiedPayments.set(txHash, true);

      res.json({
        verified: true,
        txHash,
        timestamp: Date.now(),
      });
    });

    // Mock /settle endpoint for gasless payments
    facilitatorApp.post('/settle', async (req, res) => {
      const { authorization, paymentRequest } = req.body;

      if (!authorization || !paymentRequest) {
        return res.status(400).json({
          error: 'Missing required fields',
        });
      }

      // In real scenario, facilitator would:
      // 1. Verify signature is valid
      // 2. Call transferWithAuthorization on USDs contract
      // 3. Return transaction hash

      // Mock successful settlement
      const mockTxHash = `0x${Math.random().toString(16).slice(2)}`;
      verifiedPayments.set(mockTxHash, true);

      res.json({
        success: true,
        txHash: mockTxHash,
        timestamp: Date.now(),
      });
    });

    mockFacilitatorServer = facilitatorApp.listen(3002);
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (mockFacilitatorServer) {
      await new Promise<void>((resolve) => {
        mockFacilitatorServer.close(() => resolve());
      });
    }
  });

  describe('Standard Payment Flow', () => {
    it('should execute standard USDs payment', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: TEST_CONFIG.recipient,
        token: 'USDs',
      });

      // Execute payment
      const result = await adapter.executeStandardPayment(paymentRequest);

      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Verify payment with facilitator
      const verification = await adapter.verifyPayment(result.txHash, paymentRequest);
      
      expect(verification.verified).toBe(true);
      expect(verifiedPayments.get(result.txHash)).toBe(true);
    }, 30000); // 30s timeout for blockchain interaction

    it('should execute USDC payment', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: TEST_CONFIG.recipient,
        token: 'USDC',
      });

      const result = await adapter.executeStandardPayment(paymentRequest);

      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();
    }, 30000);
  });

  describe('Gasless Payment Flow (EIP-3009)', () => {
    it('should create and verify payment authorization', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: TEST_CONFIG.recipient,
        token: 'USDs',
      });

      // Get user address from adapter
      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

      // Create authorization
      const authorization = await adapter.createPaymentAuthorization(
        paymentRequest,
        userAddress,
        TEST_CONFIG.privateKey,
      );

      expect(authorization).toBeDefined();
      expect(authorization.from).toBe(userAddress);
      expect(authorization.to).toBe(TEST_CONFIG.recipient);
      expect(authorization.v).toBeDefined();
      expect(authorization.r).toBeDefined();
      expect(authorization.s).toBeDefined();
    });

    it('should execute gasless payment through facilitator', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: TEST_CONFIG.recipient,
        token: 'USDs',
      });

      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

      const authorization = await adapter.createPaymentAuthorization(
        paymentRequest,
        userAddress,
        TEST_CONFIG.privateKey,
      );

      // Execute gasless payment
      const result = await adapter.executeGaslessPayment(authorization, paymentRequest);

      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(verifiedPayments.get(result.txHash)).toBe(true);
    }, 30000);
  });

  describe('HTTP 402 Flow', () => {
    it('should handle complete 402 payment cycle', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      // Step 1: AI service returns 402 with payment request
      const paymentRequest = adapter.createPaymentRequest({
        price: '0.001',
        recipient: TEST_CONFIG.recipient,
        token: 'USDs',
      });

      // Step 2: User creates payment authorization
      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
      const authorization = await adapter.createPaymentAuthorization(
        paymentRequest,
        userAddress,
        TEST_CONFIG.privateKey,
      );

      // Step 3: Facilitator settles payment
      const settlementResult = await adapter.executeGaslessPayment(authorization, paymentRequest);
      
      expect(settlementResult.success).toBe(true);

      // Step 4: User retries request with payment proof
      const proofHeader = `Bearer ${settlementResult.txHash}`;
      
      // Mock AI service validates proof
      const isVerified = verifiedPayments.get(settlementResult.txHash);
      expect(isVerified).toBe(true);
      
      // Service would now return 200 with AI response
    }, 30000);
  });

  describe('Balance Queries', () => {
    it('should query USDs balance', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
      
      const balance = await adapter.getUSdsBalance(userAddress);
      
      expect(balance).toBeDefined();
      expect(typeof balance).toBe('bigint');
      expect(balance).toBeGreaterThanOrEqual(0n);
    }, 10000);

    it('should track balance changes after payment', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
      
      // Get balance before
      const balanceBefore = await adapter.getUSdsBalance(userAddress);
      
      // Execute payment
      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: TEST_CONFIG.recipient,
        token: 'USDs',
      });

      await adapter.executeStandardPayment(paymentRequest);

      // Wait for block confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get balance after
      const balanceAfter = await adapter.getUSdsBalance(userAddress);
      
      // Balance should decrease by payment amount
      const paymentAmount = parseUnits('0.0001', 18);
      expect(balanceAfter).toBeLessThan(balanceBefore);
      expect(balanceBefore - balanceAfter).toBeGreaterThanOrEqual(paymentAmount);
    }, 30000);
  });

  describe('Error Scenarios', () => {
    it('should handle insufficient balance', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      // Try to pay huge amount
      const paymentRequest = adapter.createPaymentRequest({
        price: '1000000',
        recipient: TEST_CONFIG.recipient,
        token: 'USDs',
      });

      await expect(
        adapter.executeStandardPayment(paymentRequest)
      ).rejects.toThrow();
    }, 30000);

    it('should handle expired deadline', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: TEST_CONFIG.recipient,
        token: 'USDs',
      });

      // Set deadline in the past
      paymentRequest.deadline = Math.floor(Date.now() / 1000) - 100;

      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

      await expect(
        adapter.createPaymentAuthorization(
          paymentRequest,
          userAddress,
          TEST_CONFIG.privateKey,
        )
      ).rejects.toThrow();
    });

    it('should handle invalid recipient address', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: '0xinvalid' as Address,
        token: 'USDs',
      });

      await expect(
        adapter.executeStandardPayment(paymentRequest)
      ).rejects.toThrow();
    }, 30000);
  });

  describe('Multi-Token Support', () => {
    it('should execute payments with different tokens', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const tokens = ['USDs', 'USDC', 'USDT'] as const;
      
      for (const token of tokens) {
        const paymentRequest = adapter.createPaymentRequest({
          price: '0.0001',
          recipient: TEST_CONFIG.recipient,
          token,
        });

        const result = await adapter.executeStandardPayment(paymentRequest);
        
        expect(result.success).toBe(true);
        expect(result.txHash).toBeDefined();
      }
    }, 90000); // 90s for 3 transactions
  });

  describe('Batch Settlements', () => {
    it('should handle multiple payments in sequence', async () => {
      if (!TEST_CONFIG.privateKey) {
        return;
      }

      const paymentCount = 3;
      const results = [];

      for (let i = 0; i < paymentCount; i++) {
        const paymentRequest = adapter.createPaymentRequest({
          price: '0.0001',
          recipient: TEST_CONFIG.recipient,
          token: 'USDs',
        });

        const result = await adapter.executeStandardPayment(paymentRequest);
        results.push(result);

        // Wait between transactions
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Verify all payments succeeded
      expect(results).toHaveLength(paymentCount);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.txHash).toBeDefined();
      });
    }, 60000);
  });
});

describe('Mock Facilitator Tests', () => {
  let facilitatorApp: Express;
  let server: Server;

  beforeAll(() => {
    facilitatorApp = express();
    facilitatorApp.use(express.json());

    facilitatorApp.post('/verify', (req, res) => {
      const { txHash, paymentRequest } = req.body;

      if (!txHash) {
        return res.status(400).json({ error: 'Missing txHash' });
      }

      res.json({
        verified: true,
        txHash,
        amount: paymentRequest?.price,
        timestamp: Date.now(),
      });
    });

    facilitatorApp.post('/settle', (req, res) => {
      const { authorization, paymentRequest } = req.body;

      if (!authorization) {
        return res.status(400).json({ error: 'Missing authorization' });
      }

      res.json({
        success: true,
        txHash: `0x${Math.random().toString(16).slice(2)}`,
        timestamp: Date.now(),
      });
    });

    server = facilitatorApp.listen(3003);
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should verify payment through mock facilitator', async () => {
    const response = await fetch('http://localhost:3003/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash: '0x123abc',
        paymentRequest: { price: '0.0001' },
      }),
    });

    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.verified).toBe(true);
    expect(data.txHash).toBe('0x123abc');
  });

  it('should settle gasless payment through mock facilitator', async () => {
    const response = await fetch('http://localhost:3003/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorization: {
          from: '0xUser',
          to: '0xRecipient',
          value: '100000000000000',
          v: 27,
          r: '0xabc',
          s: '0xdef',
        },
        paymentRequest: { price: '0.0001' },
      }),
    });

    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.txHash).toBeDefined();
  });
});

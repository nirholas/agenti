import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { config as dotenvConfig } from 'dotenv';
import { parseUnits } from 'viem';
import path from 'path';
import {
  type VerifyRequest,
  type VerifyResponse,
  type SettleRequest,
  type SettleResponse,
  type ErrorResponse,
  type BridgeConfig,
  VerifyRequestSchema,
  SettleRequestSchema,
} from "./types";
import { verifyPaymentManaged, settlePaymentManaged } from './managed/settlement';
import { calculateFee } from './managed/fees';
import { computeFeeBreakdown } from './managed/amounts';
import { tryServeCachedResponse, storeResponseForIdempotency } from './middleware/idempotency';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { linkAgentIdentity } from './chaoschain/identity';
import { checkHealth } from './monitoring/health';
import { startConfirmer } from './jobs/confirmer';

// Load environment variables
dotenvConfig();

// Helper to parse payment header
function parsePaymentHeader(header: string | { sender: string; nonce: string; validAfter?: string; validBefore?: string; signature?: string }) {
  if (typeof header === 'string') {
    return JSON.parse(Buffer.from(header, 'base64').toString());
  }
  return header;
}

/**
 * ChaosChain x402 HTTP Bridge
 * 
 * This service provides a REST API for the decentralized x402 facilitator.
 * It acts as a bridge between clients and the CRE workflow.
 * 
 * Current Mode: SIMULATE
 * - Returns mock verification and settlement responses
 * - Does not call real CRE workflows
 * 
 * Production Mode (TODO):
 * - Forward requests to deployed CRE workflow endpoints
 * - Return real consensus-verified responses
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const config: BridgeConfig = {
  port: Number(process.env.PORT || 8402),
  mode: (process.env.FACILITATOR_MODE as 'managed' | 'decentralized') || 'managed',
  creMode: (process.env.CRE_MODE as "simulate" | "remote") || "simulate",
  creWorkflowUrl: process.env.CRE_WORKFLOW_URL,
  logLevel: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",
  defaultChain: process.env.DEFAULT_CHAIN || 'base-sepolia',
  chaoschainEnabled: process.env.CHAOSCHAIN_ENABLED === 'true',
};

// ============================================================================
// FASTIFY SERVER SETUP
// ============================================================================

const server = Fastify({
  logger: {
    level: config.logLevel,
  },
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Mock verification logic for simulate mode
 * Returns a consensus-verified response
 */
function simulateVerify(request: VerifyRequest): VerifyResponse {
  server.log.info(`[VERIFY] Network: ${request.paymentRequirements.network}`);
  server.log.info(`[VERIFY] Scheme: ${request.paymentRequirements.scheme}`);
  server.log.info(`[VERIFY] PayTo: ${request.paymentRequirements.payTo}`);

  // Generate realistic-looking consensus proof hash
  const timestamp = Date.now();
  const proofData = `${request.paymentRequirements.payTo}${timestamp}`;
  const proofHash = `0x${Buffer.from(proofData).toString('hex').slice(0, 64)}`;
  
  return {
    isValid: true,
    invalidReason: null,
    consensusProof: proofHash,
    reportId: `rep_${timestamp}`,
    timestamp: timestamp,
  };
}

/**
 * Mock settlement logic for simulate mode
 * Returns a consensus-verified transaction
 */
function simulateSettle(request: SettleRequest): SettleResponse {
  server.log.info(`[SETTLE] Network: ${request.paymentRequirements.network}`);
  server.log.info(`[SETTLE] Asset: ${request.paymentRequirements.asset}`);
  server.log.info(`[SETTLE] PayTo: ${request.paymentRequirements.payTo}`);

  // Map network names to chain IDs
  const chainIdMap: Record<string, number> = {
    "base-sepolia": 84532,
    "ethereum-sepolia": 11155111,
    "base-mainnet": 8453,
    "ethereum-mainnet": 1,
  };

  const chainId = chainIdMap[request.paymentRequirements.network] || 84532;

  // Generate realistic-looking transaction hash
  const timestamp = Date.now();
  const txData = `${request.paymentRequirements.payTo}${request.paymentRequirements.asset}${timestamp}`;
  const txHash = `0x${Buffer.from(txData).toString('hex').slice(0, 64)}`;
  const proofData = `${txData}consensus`;
  const proofHash = `0x${Buffer.from(proofData).toString('hex').slice(0, 64)}`;
  
  return {
    success: true,
    error: null,
    txHash: txHash,
    networkId: request.paymentRequirements.network,
    consensusProof: proofHash,
    timestamp: timestamp,
  };
}

/**
 * Forward verify request to real CRE workflow
 * TODO: Implement when CRE is deployed
 */
async function forwardVerifyToCRE(request: VerifyRequest): Promise<VerifyResponse> {
  if (!config.creWorkflowUrl) {
    throw new Error("CRE_WORKFLOW_URL not configured for remote mode");
  }

  // TODO: Make HTTP request to CRE workflow endpoint
  // const response = await fetch(`${config.creWorkflowUrl}/verify`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(request)
  // });
  // return await response.json();

  throw new Error("Remote CRE mode not yet implemented");
}

/**
 * Forward settle request to real CRE workflow
 * TODO: Implement when CRE is deployed
 */
async function forwardSettleToCRE(request: SettleRequest): Promise<SettleResponse> {
  if (!config.creWorkflowUrl) {
    throw new Error("CRE_WORKFLOW_URL not configured for remote mode");
  }

  // TODO: Make HTTP request to CRE workflow endpoint
  // const response = await fetch(`${config.creWorkflowUrl}/settle`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(request)
  // });
  // return await response.json();

  throw new Error("Remote CRE mode not yet implemented");
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/info
 * Service information API endpoint (moved from root to avoid conflict with static serving)
 */
server.get("/api/info", async () => {
  const info: any = {
    service: "ChaosChain x402 Facilitator",
    version: "0.1.0",
    mode: config.mode,
    endpoints: {
      verify: "POST /verify",
      settle: "POST /settle",
      supported: "GET /supported",
      health: "GET /health",
    },
    docs: "https://github.com/ChaosChain/chaoschain-x402",
  };
  
  // Only show CRE mode if we're in decentralized mode
  if (config.mode === 'decentralized') {
    info.creMode = config.creMode;
  }
  
  // Show what we're actually doing
  if (config.mode === 'managed') {
    info.settlement = 'Production-ready on-chain settlement';
    info.network = config.defaultChain;
  }
  
  return info;
});

/**
 * GET /health
 * Health check with detailed status
 */
server.get("/health", async (request, reply) => {
  const health = await checkHealth();
  return reply.code(health.healthy ? 200 : 503).send(health);
});

/**
 * GET /supported
 * Returns supported payment schemes and networks
 * Per x402 facilitator spec
 */
server.get("/supported", async () => {
  return {
    kinds: [
      {
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
      },
      {
        x402Version: 1,
        scheme: "exact",
        network: "ethereum-sepolia",
      },
      {
        x402Version: 1,
        scheme: "exact",
        network: "base-mainnet",
      },
      {
        x402Version: 1,
        scheme: "exact",
        network: "ethereum-mainnet",
      },
      {
        x402Version: 1,
        scheme: "exact",
        network: "0g-mainnet",
      },
      {
        x402Version: 1,
        scheme: "exact",
        network: "skale-base-sepolia",
      },
    ],
  };
});

/**
 * POST /verify
 * Verify an x402 payment via decentralized consensus or managed facilitator
 * 
 * Request Body:
 * {
 *   x402Version: number,
 *   paymentHeader: { sender, nonce, validAfter?, validBefore? },
 *   paymentRequirements: PaymentRequirements
 * }
 * 
 * Response:
 * {
 *   isValid: boolean,
 *   invalidReason: string | null,
 *   consensusProof: string,
 *   reportId: string,
 *   timestamp: number,
 *   feeAmount?: string,
 *   netAmount?: string,
 *   feeBps?: number
 * }
 */
server.post<{ Body: VerifyRequest; Reply: VerifyResponse | ErrorResponse }>(
  "/verify",
  {
    preHandler: [rateLimitMiddleware],
  },
  async (request, reply) => {
    try {
      // Try to serve cached response first (idempotency)
      if (await tryServeCachedResponse(request, reply)) return;

      // Validate request body
      const validatedRequest = VerifyRequestSchema.parse(request.body);

      // Create stable timestamp for this request (for idempotency consistency)
      const stableTimestamp = Date.now();
      const requestId = `req_${stableTimestamp}_${Math.random().toString(36).slice(2, 9)}`;
      
      server.log.info(`[VERIFY] Processing verification request`);
      server.log.info(`[VERIFY] Mode: ${config.mode}`);

      // ALWAYS compute fee breakdown for transparency (even for invalid payments)
      const feeBreakdown = await computeFeeBreakdown(
        validatedRequest.paymentRequirements.maxAmountRequired
      );

      let response: VerifyResponse;

      if (config.mode === 'managed') {
        // MANAGED MODE: Real on-chain verification
        const verification = await verifyPaymentManaged(validatedRequest);
        
        response = {
          isValid: verification.isValid,
          invalidReason: verification.invalidReason,
          consensusProof: verification.isValid 
            ? `0x${Buffer.from(requestId).toString('hex').padEnd(64, '0')}`
            : null,
          reportId: requestId,
          timestamp: stableTimestamp,
          // Fee transparency: always present, even for invalid payments
          amount: feeBreakdown.amount,
          fee: feeBreakdown.fee,
          net: feeBreakdown.net,
        };
      } else {
        // DECENTRALIZED MODE: Use CRE workflow
        const baseResponse = config.creMode === "simulate"
          ? simulateVerify(validatedRequest)
          : await forwardVerifyToCRE(validatedRequest);
        
        // Add fee breakdown to CRE response
        response = {
          ...baseResponse,
          timestamp: stableTimestamp,
          amount: feeBreakdown.amount,
          fee: feeBreakdown.fee,
          net: feeBreakdown.net,
        };
      }

      server.log.info(`[VERIFY] Result: ${response.isValid ? "VALID" : "INVALID"}`);

      // Store response for idempotency BEFORE sending
      await storeResponseForIdempotency(request, response);

      return reply.code(200).send(response);
    } catch (error) {
      server.log.error(`[VERIFY] Error: ${error}`);

      if (error instanceof Error) {
        return reply.status(400).send({
          error: error.message,
          code: "VERIFICATION_ERROR",
          details: error,
        });
      }

      return reply.status(500).send({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  }
);

/**
 * POST /settle
 * Settle an x402 payment via managed facilitator or decentralized consensus
 * 
 * Request Body:
 * {
 *   x402Version: number,
 *   paymentHeader: { sender, nonce },
 *   paymentRequirements: PaymentRequirements,
 *   agentId?: string (ERC-8004 token ID for Proof-of-Agency)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   error: string | null,
 *   txHash: string | null,
 *   txHashFee?: string,
 *   networkId: string | null,
 *   consensusProof: string,
 *   timestamp: number,
 *   feeAmount?: string,
 *   netAmount?: string,
 *   evidenceHash?: string,
 *   proofOfAgency?: string
 * }
 */
server.post<{ Body: SettleRequest; Reply: SettleResponse | ErrorResponse }>(
  "/settle",
  {
    preHandler: [rateLimitMiddleware],
  },
  async (request, reply) => {
    try {
      // Try to serve cached response first (idempotency)
      if (await tryServeCachedResponse(request, reply)) return;

      // Validate request body
      const validatedRequest = SettleRequestSchema.parse(request.body);

      // Create stable timestamp for this request (for idempotency consistency)
      const stableTimestamp = Date.now();
      const requestId = `req_${stableTimestamp}_${Math.random().toString(36).slice(2, 9)}`;

      server.log.info(`[SETTLE] Processing settlement request`);
      server.log.info(`[SETTLE] Mode: ${config.mode}`);

      // ALWAYS compute fee breakdown for transparency (even for failed settlements)
      const feeBreakdown = await computeFeeBreakdown(
        validatedRequest.paymentRequirements.maxAmountRequired
      );

      let response: SettleResponse;

      if (config.mode === 'managed') {
        // MANAGED MODE: Real on-chain settlement with EIP-3009 transferWithAuthorization
        
        // First verify
        const verification = await verifyPaymentManaged(validatedRequest);
        if (!verification.isValid) {
          response = {
            success: false,
            error: verification.invalidReason,
            txHash: null,
            networkId: validatedRequest.paymentRequirements.network,
            consensusProof: '',
            timestamp: stableTimestamp,
            // Fee transparency: always present, even for failed settlements
            amount: feeBreakdown.amount,
            fee: feeBreakdown.fee,
            net: feeBreakdown.net,
          };
        } else {
          // maxAmountRequired is already in base units per x402 spec
          const amount = BigInt(validatedRequest.paymentRequirements.maxAmountRequired);
          const feeCalc = await calculateFee(amount);

          // Execute atomic dual-transfer settlement
          const settlement = await settlePaymentManaged(
            validatedRequest,
            feeCalc.feeAmount,
            feeCalc.netAmount
          );

          // Link to ChaosChain identity if agentId provided
          let evidenceHash: string | undefined;
          let proofOfAgency: string | undefined;
          
          const agentId = (validatedRequest as any).agentId;
          if (agentId && config.chaoschainEnabled) {
            const identity = await linkAgentIdentity({
              agentId,
              txHash: settlement.txHash,
              chain: validatedRequest.paymentRequirements.network,
              amount,
              paymentData: validatedRequest,
            });
            
            if (identity) {
              evidenceHash = identity.evidenceHash;
              proofOfAgency = identity.proofOfAgency;
              server.log.info(`[ChaosChain] Agent ${agentId} linked to tx ${settlement.txHash}`);
            }
          }

          response = {
            success: settlement.status === 'confirmed' || settlement.status === 'pending',
            error: null,
            txHash: settlement.txHash,
            txHashFee: settlement.txHashFee,
            networkId: validatedRequest.paymentRequirements.network,
            consensusProof: `0x${Buffer.from(settlement.txHash).toString('hex').slice(0, 64)}`,
            timestamp: stableTimestamp,
            // Fee transparency with both human and base units
            amount: feeBreakdown.amount,
            fee: feeBreakdown.fee,
            net: feeBreakdown.net,
            status: settlement.status,
            evidenceHash,
            proofOfAgency,
          };
        }
      } else {
        // DECENTRALIZED MODE: Use CRE workflow
        const baseResponse = config.creMode === "simulate"
          ? simulateSettle(validatedRequest)
          : await forwardSettleToCRE(validatedRequest);
        
        // Add fee breakdown and stable timestamp to CRE response
        response = {
          ...baseResponse,
          timestamp: stableTimestamp,
          amount: feeBreakdown.amount,
          fee: feeBreakdown.fee,
          net: feeBreakdown.net,
        };
      }

      server.log.info(`[SETTLE] Result: ${response.success ? "SUCCESS" : "FAILED"}`);

      // Store response for idempotency BEFORE sending
      await storeResponseForIdempotency(request, response);

      return reply.code(200).send(response);
    } catch (error) {
      server.log.error(`[SETTLE] Error: ${error}`);

      if (error instanceof Error) {
        return reply.status(400).send({
          error: error.message,
          code: "SETTLEMENT_ERROR",
          details: error,
        });
      }

      return reply.status(500).send({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  }
);

// ============================================================================
// SERVER START
// ============================================================================

const start = async () => {
  try {
    // Register CORS plugin
    await server.register(cors, {
      origin: true, // Allow all origins in development
      methods: ["GET", "POST", "OPTIONS"],
    });
    
    // Register static file serving for the public directory
    // Use path relative to current working directory for simplicity
    const publicPath = path.join(process.cwd(), 'dist', 'public');
    
    server.log.info(`Serving static files from: ${publicPath}`);
    
    await server.register(fastifyStatic, {
      root: publicPath,
      prefix: '/', // Serve from root
    });
    
    await server.listen({ port: config.port, host: "0.0.0.0" });
    
    // Start background finality confirmer if in managed mode
    if (config.mode === 'managed') {
      startConfirmer();
      server.log.info('Background finality confirmer started');
    }
    
    console.log("");
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║   ChaosChain x402 Payment Facilitator                    ║");
    console.log("╚═══════════════════════════════════════════════════════════╝");
    console.log("");
    console.log(`🚀 Server listening on http://localhost:${config.port}`);
    console.log(`📋 Mode: ${config.mode.toUpperCase()} ${config.mode === 'decentralized' ? `(${config.creMode})` : ''}`);
    console.log(`⛓️  Default Chain: ${config.defaultChain}`);
    console.log(`📊 Log Level: ${config.logLevel}`);
    console.log(`🔐 ChaosChain Integration: ${config.chaoschainEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log("");
    console.log("Endpoints:");
    console.log(`  POST http://localhost:${config.port}/verify`);
    console.log(`  POST http://localhost:${config.port}/settle`);
    console.log(`  GET  http://localhost:${config.port}/health`);
    console.log(`  GET  http://localhost:${config.port}/supported`);
    console.log("");
    if (config.mode === 'managed') {
      console.log("Features:");
      console.log(`  ✓ EIP-3009 gasless settlement (transferWithAuthorization)`);
      console.log(`  ✓ Non-custodial, no approvals needed`);
      console.log(`  ✓ Finality tracking (${config.defaultChain.includes('base') ? '2' : '3'} blocks)`);
      console.log(`  ✓ Replay protection`);
      console.log(`  ✓ Rate limiting & idempotency`);
      console.log("");
    }
    console.log("Press Ctrl+C to stop");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


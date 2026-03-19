import { cre, Runner, type Runtime } from "@chainlink/cre-sdk";

/**
 * ChaosChain-x402 Decentralized Facilitator Workflow
 * 
 * This CRE workflow provides decentralized verification and settlement
 * for x402 payments. It replaces the centralized facilitator with a
 * Byzantine Fault Tolerant (BFT) consensus mechanism across a DON.
 * 
 * Architecture:
 * - Multiple independent nodes execute this workflow
 * - Each node verifies payment signatures and settlement conditions
 * - BFT consensus aggregates results into a single verified output
 * - Cryptographic proofs are generated for transparency
 * 
 * Current Mode: SIMULATION
 * This workflow runs in simulate mode and returns mock responses.
 * When deploying to production CRE, enable real blockchain interactions.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Workflow configuration loaded from config.json
 */
type Config = {
  schedule: string;
  mode: "simulate" | "production";
  supportedNetworks: string[];
  supportedSchemes: string[];
};

/**
 * x402 Payment Payload (from x402 protocol spec)
 * Sent in the X-PAYMENT header as base64 encoded JSON
 */
type X402PaymentPayload = {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    // EIP-712 signature components
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
    v: number;
    r: string;
    s: string;
  };
};

/**
 * Verification request structure
 */
type VerifyRequest = {
  paymentHeader: string; // base64 encoded X402PaymentPayload
  paymentRequirements: {
    scheme: string;
    network: string;
    maxAmountRequired: string;
    payTo: string;
    asset: string;
    resource: string;
  };
};

/**
 * Verification response (returned to client)
 */
type VerifyResponse = {
  isValid: boolean;
  invalidReason: string | null;
  consensusProof: string;
  reportId: string;
  timestamp: number;
};

/**
 * Settlement request structure
 */
type SettleRequest = {
  paymentHeader: string;
  paymentRequirements: {
    scheme: string;
    network: string;
    payTo: string;
    asset: string;
    amount: string;
  };
};

/**
 * Settlement response (returned to client)
 */
type SettleResponse = {
  success: boolean;
  error: string | null;
  txHash: string | null;
  networkId: string | null;
  consensusProof: string;
  timestamp: number;
};

// ============================================================================
// WORKFLOW HANDLERS
// ============================================================================

/**
 * VERIFY HANDLER
 * 
 * Verifies an x402 payment payload using decentralized consensus.
 * 
 * In simulate mode:
 * - Returns mock verification results
 * - Demonstrates the verification flow
 * 
 * In production mode (TODO - enable when deploying to real CRE):
 * - Use EVMClient to read on-chain state (nonces, balances)
 * - Verify EIP-712 signature cryptographically
 * - Check allowances for ERC-20 transfers
 * - Return consensus-verified result
 * 
 * @param runtime - CRE runtime providing access to capabilities
 * @param request - Verification request with payment payload
 * @returns Verification response with consensus proof
 */
const handleVerify = (
  runtime: Runtime<Config>,
  request: VerifyRequest
): VerifyResponse => {
  runtime.log("[VERIFY] Starting decentralized payment verification");
  runtime.log(`[VERIFY] Network: ${request.paymentRequirements.network}`);
  runtime.log(`[VERIFY] Scheme: ${request.paymentRequirements.scheme}`);
  runtime.log(`[VERIFY] PayTo: ${request.paymentRequirements.payTo}`);

  // TODO: When deploying to production CRE, enable real verification:
  //
  // const evm = new EVMClient(runtime);
  // const http = new HTTPClient(runtime);
  //
  // 1. Decode the payment payload from base64
  // const payloadJson = Buffer.from(request.paymentHeader, 'base64').toString();
  // const payload: X402PaymentPayload = JSON.parse(payloadJson);
  //
  // 2. Verify EIP-712 signature
  // const isSignatureValid = await evm.verifyTypedSignature({
  //   domain: { name: 'USDC', version: '2', chainId: 84532 },
  //   types: { ... },
  //   message: payload.payload,
  //   signature: { v: payload.payload.v, r: payload.payload.r, s: payload.payload.s }
  // });
  //
  // 3. Check on-chain nonce hasn't been used
  // const currentNonce = await evm.read({
  //   chain: request.paymentRequirements.network,
  //   to: request.paymentRequirements.asset,
  //   method: 'authorizationState',
  //   args: [payload.payload.from, payload.payload.nonce]
  // });
  //
  // 4. Verify amount and recipient match requirements
  // const isAmountValid = BigInt(payload.payload.value) <= BigInt(request.paymentRequirements.maxAmountRequired);
  // const isRecipientValid = payload.payload.to === request.paymentRequirements.payTo;

  // SIMULATION MODE: Return mock consensus result
  const isValid = true;
  const consensusProof = `0xCRE-MOCK-${Date.now()}`;
  const reportId = `rep_${Date.now()}`;

  runtime.log(`[VERIFY] Consensus reached: ${isValid ? "VALID" : "INVALID"}`);
  runtime.log(`[VERIFY] Consensus proof: ${consensusProof}`);

  return {
    isValid,
    invalidReason: isValid ? null : "Simulation always returns valid",
    consensusProof,
    reportId,
    timestamp: Date.now(),
  };
};

/**
 * SETTLE HANDLER
 * 
 * Settles an x402 payment by executing the on-chain transaction.
 * 
 * In simulate mode:
 * - Returns mock settlement results
 * - Demonstrates the settlement flow
 * 
 * In production mode (TODO - enable when deploying to real CRE):
 * - Use EVMClient to execute ERC-20 receiveWithAuthorization
 * - Submit transaction via BFT consensus (one node submits, others monitor)
 * - Wait for on-chain confirmation
 * - Emit Proof-of-Agency to ValidationRegistry (ERC-8004)
 * - Return consensus-verified transaction hash
 * 
 * @param runtime - CRE runtime providing access to capabilities
 * @param request - Settlement request with payment details
 * @returns Settlement response with transaction hash
 */
const handleSettle = (
  runtime: Runtime<Config>,
  request: SettleRequest
): SettleResponse => {
  runtime.log("[SETTLE] Starting decentralized payment settlement");
  runtime.log(`[SETTLE] Network: ${request.paymentRequirements.network}`);
  runtime.log(`[SETTLE] Asset: ${request.paymentRequirements.asset}`);
  runtime.log(`[SETTLE] Amount: ${request.paymentRequirements.amount}`);

  // TODO: When deploying to production CRE, enable real settlement:
  //
  // const evm = new EVMClient(runtime);
  //
  // 1. Decode payment payload
  // const payloadJson = Buffer.from(request.paymentHeader, 'base64').toString();
  // const payload: X402PaymentPayload = JSON.parse(payloadJson);
  //
  // 2. Execute ERC-20 receiveWithAuthorization (EIP-3009)
  // const tx = await evm.write({
  //   chain: request.paymentRequirements.network,
  //   to: request.paymentRequirements.asset,
  //   method: 'receiveWithAuthorization',
  //   args: [
  //     payload.payload.from,
  //     payload.payload.to,
  //     payload.payload.value,
  //     payload.payload.validAfter,
  //     payload.payload.validBefore,
  //     payload.payload.nonce,
  //     payload.payload.v,
  //     payload.payload.r,
  //     payload.payload.s
  //   ]
  // });
  //
  // 3. Wait for transaction confirmation
  // await tx.wait();
  //
  // 4. Emit Proof-of-Agency to ValidationRegistry
  // const proofTx = await evm.write({
  //   chain: request.paymentRequirements.network,
  //   to: VALIDATION_REGISTRY_ADDRESS,
  //   method: 'recordPaymentEvidence',
  //   args: [payload.payload.from, tx.hash, request.paymentRequirements.resource]
  // });

  // SIMULATION MODE: Return mock settlement result
  const chainIdMap: Record<string, number> = {
    "base-sepolia": 84532,
    "ethereum-sepolia": 11155111,
  };

  const networkId =
    request.paymentRequirements.network in chainIdMap
      ? request.paymentRequirements.network
      : "base-sepolia";

  // Generate realistic transaction hash
  const txData = `${Date.now()}`;
  const txHash = `0x${Buffer.from(txData).toString('hex').padEnd(64, '0').slice(0, 64)}`;
  const consensusProof = `0xCRE-MOCK-${Date.now()}`;

  runtime.log(`[SETTLE] Consensus reached on settlement`);
  runtime.log(`[SETTLE] Mock txHash: ${txHash}`);
  runtime.log(`[SETTLE] Consensus proof: ${consensusProof}`);

  return {
    success: true,
    error: null,
    txHash,
    networkId,
    consensusProof,
    timestamp: Date.now(),
  };
};

/**
 * CRON TRIGGER CALLBACK
 * 
 * This callback runs periodically to demonstrate the workflow is operational.
 * In simulate mode, it runs a self-test of verification and settlement.
 * 
 * In production, you would replace this with HTTP triggers:
 * - cre.httpTrigger("/verify") for verification requests
 * - cre.httpTrigger("/settle") for settlement requests
 * 
 * @param runtime - CRE runtime
 * @returns Status message
 */
const onCronTrigger = (runtime: Runtime<Config>): string => {
  runtime.log("=================================================");
  runtime.log("ChaosChain-x402 Facilitator Workflow: Health Check");
  runtime.log("=================================================");

  const config = runtime.config;
  runtime.log(`Mode: ${config.mode}`);
  runtime.log(`Supported Networks: ${config.supportedNetworks.join(", ")}`);
  runtime.log(`Supported Schemes: ${config.supportedSchemes.join(", ")}`);

  // Run a self-test verification
  const mockVerifyRequest: VerifyRequest = {
    paymentHeader: "mock_base64_payload",
    paymentRequirements: {
      scheme: "exact",
      network: "base-sepolia",
      maxAmountRequired: "1000000", // 1 USDC (6 decimals)
      payTo: "0x0000000000000000000000000000000000000000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
      resource: "/api/test",
    },
  };

  const verifyResult = handleVerify(runtime, mockVerifyRequest);
  runtime.log(`✅ Self-test verification: ${verifyResult.isValid ? "PASSED" : "FAILED"}`);

  // Run a self-test settlement
  const mockSettleRequest: SettleRequest = {
    paymentHeader: "mock_base64_payload",
    paymentRequirements: {
      scheme: "exact",
      network: "base-sepolia",
      payTo: "0x0000000000000000000000000000000000000000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "1000000",
    },
  };

  const settleResult = handleSettle(runtime, mockSettleRequest);
  runtime.log(`✅ Self-test settlement: ${settleResult.success ? "PASSED" : "FAILED"}`);

  runtime.log("=================================================");

  return "ChaosChain-x402 Facilitator: Operational";
};

/**
 * WORKFLOW INITIALIZATION
 * 
 * Registers all trigger-callback handlers for this workflow.
 * 
 * Current configuration:
 * - Cron trigger for periodic health checks (simulate mode)
 * 
 * TODO: When deploying to production CRE, add HTTP triggers:
 * 
 * const httpCapability = new cre.capabilities.HTTPCapability();
 * return [
 *   cre.handler(httpCapability.trigger({ path: "/verify", method: "POST" }), onVerifyHTTP),
 *   cre.handler(httpCapability.trigger({ path: "/settle", method: "POST" }), onSettleHTTP),
 * ];
 * 
 * @param config - Workflow configuration from config.json
 * @returns Array of registered handlers
 */
const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();

  return [
    cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
  ];
};

/**
 * MAIN ENTRY POINT
 * 
 * Creates the CRE Runner and starts the workflow.
 * This function is called by the CRE runtime when the workflow is deployed.
 */
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

// Start the workflow
main();


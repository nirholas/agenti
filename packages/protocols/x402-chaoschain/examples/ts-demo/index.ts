import { X402Client } from "@chaoschain/x402-client";

/**
 * ChaosChain x402 TypeScript Demo
 * 
 * This demo shows how to use the x402 client to verify and settle payments
 * via the decentralized facilitator powered by Chainlink CRE.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || "http://localhost:8402";

// Mock payment requirements (as would come from a resource server)
const PAYMENT_REQUIREMENTS = {
  scheme: "exact",
  network: "base-sepolia",
  maxAmountRequired: "1000000", // 1 USDC (6 decimals)
  resource: "/api/weather",
  description: "Weather data access",
  payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", // Example address
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
  maxTimeoutSeconds: 30,
};

// Mock payment header (in production, this would be a real EIP-712 signature)
const MOCK_PAYMENT_HEADER = btoa(
  JSON.stringify({
    x402Version: 1,
    scheme: "exact",
    network: "base-sepolia",
    payload: {
      from: "0x1234567890123456789012345678901234567890",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      value: "1000000",
      validAfter: "0",
      validBefore: String(Math.floor(Date.now() / 1000) + 3600),
      nonce: "0x" + Math.random().toString(16).slice(2),
      v: 27,
      r: "0x" + "0".repeat(64),
      s: "0x" + "0".repeat(64),
    },
  })
);

// ============================================================================
// DEMO
// ============================================================================

async function main() {
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ChaosChain x402 Decentralized Facilitator Demo (TypeScript)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");

  // Initialize client
  console.log(`📡 Connecting to facilitator: ${FACILITATOR_URL}`);
  const client = new X402Client({
    facilitatorUrl: FACILITATOR_URL,
  });

  try {
    // Health check
    console.log("");
    console.log("🏥 Health Check...");
    const health = await client.healthCheck();
    console.log(`   ✅ Service: ${health.service}`);
    console.log(`   ✅ Version: ${health.version}`);
    console.log(`   ✅ Mode: ${health.mode}`);

    // Get supported schemes
    console.log("");
    console.log("🔍 Checking supported schemes...");
    const supported = await client.getSupportedSchemes();
    console.log(`   ✅ Supported schemes:`);
    supported.kinds.forEach((kind) => {
      console.log(`      - ${kind.scheme} on ${kind.network}`);
    });

    // Verify payment
    console.log("");
    console.log("🔐 Verifying payment...");
    console.log(`   Network: ${PAYMENT_REQUIREMENTS.network}`);
    console.log(`   Amount: ${PAYMENT_REQUIREMENTS.maxAmountRequired} (1 USDC)`);
    console.log(`   Resource: ${PAYMENT_REQUIREMENTS.resource}`);
    
    const verifyResult = await client.verifyPayment(
      MOCK_PAYMENT_HEADER,
      PAYMENT_REQUIREMENTS
    );

    console.log("");
    if (verifyResult.isValid) {
      console.log("   ✅ Payment verification PASSED");
      console.log(`   ✅ Consensus reached by CRE DON`);
      console.log(`   ✅ Consensus proof: ${verifyResult.consensusProof}`);
      console.log(`   ✅ Report ID: ${verifyResult.reportId}`);
    } else {
      console.log(`   ❌ Payment verification FAILED: ${verifyResult.invalidReason}`);
      process.exit(1);
    }

    // Settle payment
    console.log("");
    console.log("💰 Settling payment on-chain...");
    
    const settleResult = await client.settlePayment(
      MOCK_PAYMENT_HEADER,
      PAYMENT_REQUIREMENTS
    );

    console.log("");
    if (settleResult.success) {
      console.log("   ✅ Payment settlement SUCCESS");
      console.log(`   ✅ Transaction hash: ${settleResult.txHash}`);
      console.log(`   ✅ Network: ${settleResult.networkId}`);
      console.log(`   ✅ Consensus proof: ${settleResult.consensusProof}`);
    } else {
      console.log(`   ❌ Payment settlement FAILED: ${settleResult.error}`);
      process.exit(1);
    }

    // Summary
    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  ✅ Demo Complete!");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
    console.log("What happened:");
    console.log("1. Payment verified via decentralized CRE DON");
    console.log("2. BFT consensus reached across multiple nodes");
    console.log("3. Settlement executed with cryptographic proof");
    console.log("4. Proof-of-Agency recorded (in production mode)");
    console.log("");
    console.log("Key Benefits:");
    console.log("• No single point of failure");
    console.log("• Trustless verification via BFT consensus");
    console.log("• Cryptographic proofs for transparency");
    console.log("• Censorship resistant");
    console.log("");
    console.log("Next Steps:");
    console.log("• Deploy CRE workflow to production");
    console.log("• Integrate with your resource server");
    console.log("• Enable real EVM reads/writes in the workflow");
    console.log("");

  } catch (error) {
    console.error("");
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    console.error("");
    console.error("Troubleshooting:");
    console.error("1. Make sure the HTTP bridge is running:");
    console.error("   cd http-bridge && bun run dev");
    console.error("");
    console.error("2. Check the facilitator URL:");
    console.error(`   Current: ${FACILITATOR_URL}`);
    console.error("");
    process.exit(1);
  }
}

// Run the demo
main();


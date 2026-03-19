"""
ChaosChain x402 Python Demo

This demo shows how to use the x402 client to verify and settle payments
via the decentralized facilitator powered by Chainlink CRE.
"""

import os
import sys
import json
import base64
import time
import random

# Add parent directory to path to import the client
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../clients/py"))

from chaoschain_x402_client import X402Client

# ============================================================================
# CONFIGURATION
# ============================================================================

FACILITATOR_URL = os.getenv("X402_FACILITATOR_URL", "http://localhost:8402")

# Mock payment requirements (as would come from a resource server)
PAYMENT_REQUIREMENTS = {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1000000",  # 1 USDC (6 decimals)
    "resource": "/api/weather",
    "description": "Weather data access",
    "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",  # Example address
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # USDC on Base Sepolia
    "maxTimeoutSeconds": 30,
}

# Mock payment header (in production, this would be a real EIP-712 signature)
mock_payload = {
    "x402Version": 1,
    "scheme": "exact",
    "network": "base-sepolia",
    "payload": {
        "from": "0x1234567890123456789012345678901234567890",
        "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        "value": "1000000",
        "validAfter": "0",
        "validBefore": str(int(time.time()) + 3600),
        "nonce": "0x" + hex(random.randint(0, 2**256))[2:],
        "v": 27,
        "r": "0x" + "0" * 64,
        "s": "0x" + "0" * 64,
    },
}

MOCK_PAYMENT_HEADER = base64.b64encode(
    json.dumps(mock_payload).encode()
).decode()

# ============================================================================
# DEMO
# ============================================================================


def main():
    print("")
    print("═══════════════════════════════════════════════════════════")
    print("  ChaosChain x402 Decentralized Facilitator Demo (Python)")
    print("═══════════════════════════════════════════════════════════")
    print("")

    # Initialize client
    print(f"📡 Connecting to facilitator: {FACILITATOR_URL}")
    
    with X402Client(facilitator_url=FACILITATOR_URL) as client:
        try:
            # Health check
            print("")
            print("🏥 Health Check...")
            health = client.health_check()
            print(f"   ✅ Service: {health.service}")
            print(f"   ✅ Version: {health.version}")
            print(f"   ✅ Mode: {health.mode}")

            # Get supported schemes
            print("")
            print("🔍 Checking supported schemes...")
            supported = client.get_supported_schemes()
            print("   ✅ Supported schemes:")
            for kind in supported.kinds:
                print(f"      - {kind.scheme} on {kind.network}")

            # Verify payment
            print("")
            print("🔐 Verifying payment...")
            print(f"   Network: {PAYMENT_REQUIREMENTS['network']}")
            print(f"   Amount: {PAYMENT_REQUIREMENTS['maxAmountRequired']} (1 USDC)")
            print(f"   Resource: {PAYMENT_REQUIREMENTS['resource']}")

            verify_result = client.verify_payment(
                payment_header=MOCK_PAYMENT_HEADER,
                payment_requirements=PAYMENT_REQUIREMENTS,
            )

            print("")
            if verify_result.isValid:
                print("   ✅ Payment verification PASSED")
                print("   ✅ Consensus reached by CRE DON")
                print(f"   ✅ Consensus proof: {verify_result.consensusProof}")
                print(f"   ✅ Report ID: {verify_result.reportId}")
            else:
                print(f"   ❌ Payment verification FAILED: {verify_result.invalidReason}")
                sys.exit(1)

            # Settle payment
            print("")
            print("💰 Settling payment on-chain...")

            settle_result = client.settle_payment(
                payment_header=MOCK_PAYMENT_HEADER,
                payment_requirements=PAYMENT_REQUIREMENTS,
            )

            print("")
            if settle_result.success:
                print("   ✅ Payment settlement SUCCESS")
                print(f"   ✅ Transaction hash: {settle_result.txHash}")
                print(f"   ✅ Network: {settle_result.networkId}")
                print(f"   ✅ Consensus proof: {settle_result.consensusProof}")
            else:
                print(f"   ❌ Payment settlement FAILED: {settle_result.error}")
                sys.exit(1)

            # Summary
            print("")
            print("═══════════════════════════════════════════════════════════")
            print("  ✅ Demo Complete!")
            print("═══════════════════════════════════════════════════════════")
            print("")
            print("What happened:")
            print("1. Payment verified via decentralized CRE DON")
            print("2. BFT consensus reached across multiple nodes")
            print("3. Settlement executed with cryptographic proof")
            print("4. Proof-of-Agency recorded (in production mode)")
            print("")
            print("Key Benefits:")
            print("• No single point of failure")
            print("• Trustless verification via BFT consensus")
            print("• Cryptographic proofs for transparency")
            print("• Censorship resistant")
            print("")
            print("Next Steps:")
            print("• Deploy CRE workflow to production")
            print("• Integrate with your resource server")
            print("• Enable real EVM reads/writes in the workflow")
            print("")

        except (TimeoutError, RuntimeError) as error:
            print("")
            print(f"❌ Error: {error}")
            print("")
            print("Troubleshooting:")
            print("1. Make sure the HTTP bridge is running:")
            print("   cd http-bridge && bun run dev")
            print("")
            print("2. Check the facilitator URL:")
            print(f"   Current: {FACILITATOR_URL}")
            print("")
            sys.exit(1)


if __name__ == "__main__":
    main()


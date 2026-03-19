/**
 * x402a Facilitator - Registry Initialization Check
 *
 * This endpoint checks if a user's nonce registry is initialized
 * and returns instructions for initialization if needed.
 */

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { type NextRequest, NextResponse } from "next/server";

// Initialize Aptos client
const config = new AptosConfig({
  network: (process.env.NEXT_PUBLIC_APTOS_NETWORK as Network) || Network.TESTNET,
});
const aptos = new Aptos(config);

interface InitCheckRequest {
  userAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: InitCheckRequest = await request.json();
    const { userAddress } = body;

    console.log("[Facilitator Init] Checking registry for address:", userAddress);

    // Check if the NonceRegistry resource exists for this address
    try {
      const resource = await aptos.getAccountResource({
        accountAddress: userAddress,
        resourceType: `${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}::x402_transfer::NonceRegistry`,
      });

      console.log("[Facilitator Init] Registry already initialized for:", userAddress);

      return NextResponse.json({
        initialized: true,
        requiresTransaction: false,
        message: "Registry already initialized",
      });
    } catch (error: any) {
      // Resource not found means registry needs initialization
      if (error.status === 404 || error.message?.includes("Resource not found")) {
        console.log("[Facilitator Init] Registry not initialized for:", userAddress);

        return NextResponse.json({
          initialized: false,
          requiresTransaction: true,
          message: "Registry needs initialization",
          transaction: {
            function: `${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}::x402_transfer::initialize_registry`,
            functionArguments: [],
          },
        });
      }

      // Other error
      throw error;
    }
  } catch (error) {
    console.error("[Facilitator Init] Error checking registry:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "online",
    network: process.env.NEXT_PUBLIC_APTOS_NETWORK || "testnet",
    contract: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
  });
}

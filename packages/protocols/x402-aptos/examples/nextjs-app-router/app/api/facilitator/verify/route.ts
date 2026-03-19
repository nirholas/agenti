/**
 * x402a Facilitator - Transaction Verification & Submission
 *
 * This API endpoint acts as a payment facilitator:
 * 1. Receives signed transaction from client
 * 2. Verifies payment matches requirements
 * 3. Submits transaction to Aptos blockchain as fee payer
 * 4. Returns transaction hash for verification
 *
 * Fee Payer Model:
 * - User's funds are transferred (user signs transaction)
 * - Facilitator pays gas only (signs as fee payer)
 *
 * PRODUCTION READY - Deploys to Vercel serverless
 */

import { type NextRequest, NextResponse } from "next/server";
import { X402Facilitator } from "x402a/server";

// Initialize X402 Facilitator
function getFacilitator(): X402Facilitator {
  const privateKey = process.env.FACILITATOR_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("FACILITATOR_PRIVATE_KEY not configured");
  }

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS not configured");
  }

  const network = (process.env.NEXT_PUBLIC_APTOS_NETWORK || "testnet") as
    | "testnet"
    | "mainnet"
    | "devnet";

  return new X402Facilitator({
    privateKey,
    contractAddress,
    network,
  });
}

interface VerifyPaymentRequest {
  payment: {
    x402Version: number;
    scheme: string;
    network: string;
    payload: {
      from: string;
      to: string | string[];
      amount: string | string[];
      nonce: string;
      authenticator: string;
      validUntil: number;
      chainId: number;
      transactionHex?: string; // The transaction hex from build endpoint
    };
  };
  requirements: {
    x402Version: number;
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    payTo: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyPaymentRequest = await request.json();
    const { payment, requirements } = body;

    console.log("[Facilitator] ========================================");
    console.log("[Facilitator] RECEIVED PAYMENT VERIFICATION REQUEST");
    console.log("[Facilitator] ========================================");
    console.log("[Facilitator] Payment payload:");
    console.log(JSON.stringify(payment, null, 2));
    console.log("[Facilitator] Requirements:");
    console.log(JSON.stringify(requirements, null, 2));

    // Validate required fields
    if (!payment.payload.authenticator || !payment.payload.validUntil || !payment.payload.chainId) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payment payload: missing authenticator, validUntil, or chainId",
        },
        { status: 400 }
      );
    }

    // 1. Basic validation
    const recipientToCheck = Array.isArray(payment.payload.to)
      ? payment.payload.to[0]
      : payment.payload.to;
    if (recipientToCheck !== requirements.payTo) {
      return NextResponse.json(
        {
          success: false,
          error: `Recipient mismatch: expected ${requirements.payTo}, got ${recipientToCheck}`,
        },
        { status: 400 }
      );
    }

    const amountStr = Array.isArray(payment.payload.amount)
      ? payment.payload.amount[0]
      : payment.payload.amount;
    const amount = BigInt(amountStr);
    const required = BigInt(requirements.maxAmountRequired);

    if (amount < required) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient amount: expected ${required}, got ${amount}`,
        },
        { status: 400 }
      );
    }

    // 2. Initialize facilitator
    const facilitator = getFacilitator();
    console.log("[Facilitator] Facilitator address:", facilitator.getAddress());

    // 3. Submit payment using X402Facilitator
    console.log("[Facilitator] Submitting payment to blockchain...");
    const startTime = Date.now();

    const result = await facilitator.submitPayment({
      from: payment.payload.from,
      to: payment.payload.to,
      amount: payment.payload.amount,
      nonce: payment.payload.nonce,
      authenticator: payment.payload.authenticator,
      validUntil: payment.payload.validUntil,
      chainId: payment.payload.chainId,
      transactionHex: payment.payload.transactionHex, // Pass the transaction hex if available
    });

    const totalTime = Date.now() - startTime;
    console.log("[Facilitator] Payment processed in", totalTime, "ms");

    if (!result.success) {
      console.error("[Facilitator] Payment failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Payment submission failed",
        },
        { status: 400 }
      );
    }

    console.log("[Facilitator] Payment successful!", {
      txHash: result.txHash,
    });

    // 4. Return success
    return NextResponse.json({
      success: true,
      payer: payment.payload.from,
      txHash: result.txHash,
      explorer: `https://explorer.aptoslabs.com/txn/${result.txHash}?network=${process.env.NEXT_PUBLIC_APTOS_NETWORK}`,
    });
  } catch (error: any) {
    console.error("[Facilitator] Error processing payment:", error);

    // Check if error is due to registry not being initialized
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRegistryError =
      errorMessage.includes("E_REGISTRY_NOT_INITIALIZED") || errorMessage.includes("0x7");

    if (isRegistryError) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment registry not initialized",
          code: "REGISTRY_NOT_INITIALIZED",
          requiresInitialization: true,
          initTransaction: {
            function: `${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}::x402_transfer::initialize_registry`,
            functionArguments: [],
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const hasPrivateKey = !!process.env.FACILITATOR_PRIVATE_KEY;

  return NextResponse.json({
    status: "online",
    network: process.env.NEXT_PUBLIC_APTOS_NETWORK || "testnet",
    contract: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    configured: hasPrivateKey,
  });
}

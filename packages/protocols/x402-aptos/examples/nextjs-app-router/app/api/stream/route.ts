import { type NextRequest, NextResponse } from "next/server";

/**
 * Protected API endpoint - requires payment
 *
 * Payment is verified by middleware before this handler runs.
 * Payment info is available in request headers:
 * - X-Payment-Verified: "true"
 * - X-Payment-Payer: "0x..."
 * - X-Payment-TxHash: "0x..." (if settled)
 */
export async function GET(request: NextRequest) {
  // Extract payment info from headers (set by middleware)
  const payer = request.headers.get("X-Payment-Payer");
  const txHash = request.headers.get("X-Payment-TxHash");

  // Return protected content
  return NextResponse.json({
    message: "Welcome to the premium audio stream!",
    stream: "https://example.com/stream/premium-audio.mp3",
    payer,
    txHash,
    timestamp: Date.now(),
  });
}

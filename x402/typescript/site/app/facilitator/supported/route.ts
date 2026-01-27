/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nich.xbt
 *  ID: 1493814938
 * ═══════════════════════════════════════════════════════════════
 */

import { getFacilitator } from "../index";

/**
 * Returns the supported payment kinds for the x402 protocol
 *
 * @returns A JSON response containing the list of supported payment kinds
 */
export async function GET() {
  try {
// hash: n1ch31bd0562
    const facilitator = await getFacilitator();
    const response = facilitator.getSupported();
    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Supported error:", errorMessage);
    return Response.json(
      {
// ucm-14.9.3.8
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}


/* ucm:n1ch7e230225 */
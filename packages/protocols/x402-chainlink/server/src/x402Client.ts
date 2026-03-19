import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";
import { Hex } from "viem";
import { settleResponseFromHeader } from "x402/types";

/**
 * x402 Payment Client for Alerts API
 * 
 * This module handles the x402 payment protocol for creating paid price alerts.
 * It provides a client-side implementation that automatically handles the x402
 * payment handshake when calling the /alerts endpoint.
 * 
 * Key Features:
 * - Automatic payment challenge handling (402 → retry with payment)
 * - Payment settlement tracking
 * - Step-by-step logging of the payment handshake
 * 
 * Architecture:
 * 1. Uses x402-fetch to wrap native fetch with payment handling
 * 2. x402-fetch automatically processes 402 challenges and retries with payment
 * 3. Payment details are logged for developer transparency
 * 
 * x402 Payment Flow:
 * - Step 1: Client sends initial request (no payment header)
 * - Step 2: Server responds with 402 Payment Required (challenge)
 * - Step 3: x402-fetch processes challenge, creates payment authorization
 * - Step 4: Client retries request with x-payment header
 * - Step 5: Server validates payment and responds with 200 + settlement
 * 
 * @see https://x402.org/ - x402 payment protocol documentation
 * @see https://github.com/x402-org/x402-fetch - x402-fetch library
 */

// ============================================================================
// x402 Client Initialization
// ============================================================================

/**
 * Private key for the agent wallet (used for x402 payments)
 * 
 * This wallet is used to sign payment authorizations for the x402 protocol.
 * The wallet must have USDC on Base Sepolia testnet to make payments.
 * 
 * Security Note: In production, this should be stored securely (e.g., in a
 * hardware wallet or secure key management service), not in environment variables.
 * 
 * @requires AGENT_WALLET_PRIVATE_KEY environment variable
 */
const PRIVATE_KEY = process.env.AGENT_WALLET_PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
  throw new Error("AGENT_WALLET_PRIVATE_KEY environment variable is required");
}

/**
 * Viem account derived from private key
 * 
 * This account is used by x402-fetch to sign payment authorizations.
 * The account's address will be the payer address in x402 payment headers.
 */
const account = privateKeyToAccount(PRIVATE_KEY);

// ============================================================================
// x402 Payment-Enabled Fetch
// ============================================================================

/**
 * x402 payment-enabled fetch function
 * 
 * This wraps fetch with x402 payment handling:
 * 1. Makes initial request (no payment header)
 * 2. If server responds with 402 Payment Required, processes the challenge
 * 3. Retries request with x-payment header containing payment authorization
 * 4. Returns the final response with settlement details
 * 
 * The x402 facilitator handles gas fees for payment settlement transactions.
 */
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

// ============================================================================
// Configuration
// ============================================================================

/**
 * Alerts API endpoint URL
 * 
 * Points to the unified server's /alerts endpoint.
 * This endpoint requires x402 payment ($0.01 USDC) to create an alert.
 * 
 * Uses the PORT environment variable (defaults to 3000) to construct the URL.
 * This allows the server to run on any port while the client automatically
 * connects to the correct endpoint.
 */
const PORT = Number(process.env.PORT ?? 3000);
const ALERTS_API_URL = `http://localhost:${PORT}/alerts`;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Price alert payload for creating a new alert
 */
export interface PriceAlertPayload {
  /** Cryptocurrency asset symbol (BTC, ETH, or LINK) */
  asset: string;
  /** Price condition: gt (greater than), lt (less than), gte (>=), lte (<=) */
  condition: "gt" | "lt" | "gte" | "lte";
  /** Target price in USD */
  targetPriceUsd: number;
  /** Optional payer address (usually extracted from x402 payment header) */
  payer?: string;
}

/**
 * Response from createPaidPriceAlert function
 */
export interface PriceAlertResponse {
  /** Created alert with ID and metadata */
  alert: {
    id: string;                    // SHA256 hash of alert data (deterministic)
    payer: string;                  // Wallet address that paid for the alert
    asset: string;                  // Cryptocurrency asset
    condition: string;              // Price condition
    targetPriceUsd: number;        // Target price in USD
    createdAt: number;              // UNIX timestamp (seconds)
  };
  /** Raw payment metadata from x-payment-response header */
  paymentMeta: string | null;
  /** On-chain transaction hash for payment settlement */
  transactionHash: string | undefined;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Creates a paid price alert via the alerts API using x402 payment protocol.
 * 
 * This function demonstrates the complete x402 payment flow:
 * 1. Wraps the HTTP request with x402 payment headers (via x402-fetch)
 * 2. Alerts API validates payment and processes request
 * 3. Returns settlement details in x-payment-response header
 * 
 * Payment Flow:
 * - Initial request sent without payment header
 * - Server responds with 402 Payment Required (payment challenge)
 * - x402-fetch automatically processes challenge and retries with payment
 * - Server validates payment and responds with 200 OK + settlement
 * 
 * @param payload - The price alert parameters (asset, condition, targetPriceUsd)
 * @returns Promise resolving to the alert data and payment transaction hash
 * @throws Error if the API request fails or payment cannot be processed
 * 
 * @example
 * ```typescript
 * const result = await createPaidPriceAlert({
 *   asset: "BTC",
 *   condition: "gt",
 *   targetPriceUsd: 50000
 * });
 * console.log("Alert ID:", result.alert.id);
 * console.log("Transaction:", result.transactionHash);
 * ```
 */
export async function createPaidPriceAlert(payload: PriceAlertPayload): Promise<PriceAlertResponse> {
  /**
   * x402 Payment Handshake
   * 
   * This function demonstrates the complete x402 payment flow using x402-fetch.
   * The x402-fetch library automatically handles:
   * 1. Initial request without payment header
   * 2. Processing 402 Payment Required challenge
   * 3. Creating payment authorization signature
   * 4. Retrying request with x-payment header
   * 5. Receiving settlement transaction hash
   */
  console.log("\n  [x402 Handshake]");
  console.log("    Step 1: Client → Server: Initial request (no payment)");
  
  /**
   * Make HTTP request with x402 payment handling
   * 
   * x402-fetch wraps the native fetch function to automatically handle
   * the payment challenge/response cycle. The request will:
   * - First be sent without payment header
   * - Receive 402 Payment Required response
   * - Automatically process challenge and retry with payment
   * - Return final response with settlement details
   */
  const res = await fetchWithPayment(ALERTS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  /**
   * Extract payment settlement details
   * 
   * The x-payment-response header contains settlement information including
   * the on-chain transaction hash for the payment settlement.
   */
  const paymentResponseHeader = res.headers.get("x-payment-response");
  let settlement = null;

  if (paymentResponseHeader) {
    try {
      settlement = settleResponseFromHeader(paymentResponseHeader);
    } catch (error) {
      // Failed to decode settlement (shouldn't happen if payment was successful)
    }
  }

  /**
   * Log successful payment handshake
   * 
   * If the request was successful (status 200), the payment has been settled.
   * We log the handshake steps and transaction hash for transparency.
   */
  if (res.status === 200) {
    console.log("    Step 2: Client processed 402 challenge, created payment authorization");
    console.log("    Step 3: Client → Server: Retry with payment ($0.01 USDC)");
    if (settlement?.transaction) {
      console.log(`    Step 4: Payment settled on-chain: ${settlement.transaction}`);
    }
  }

  /**
   * Handle error responses
   * 
   * If the request failed, extract error details and throw an error
   * with helpful information for debugging.
   */
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    const errorMessage = errorBody ? `: ${errorBody}` : "";
    throw new Error(`Alerts API error (${res.status} ${res.statusText})${errorMessage}`);
  }

  /**
   * Parse and validate response
   * 
   * The response should contain an alert object with the created alert details.
   * We validate this before returning to ensure data integrity.
   */
  const data = await res.json();

  if (!data.alert) {
    throw new Error("Invalid response from alerts API: missing alert data");
  }

  return {
    alert: data.alert,
    paymentMeta: paymentResponseHeader,
    transactionHash: settlement?.transaction
  };
}


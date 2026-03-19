/**
 * Claims module for reporting failures and managing refunds
 */

export interface ReportFailureParams {
  /** The facilitator URL (e.g., https://api.openfacilitator.io) */
  facilitatorUrl: string;
  /** The API key from server registration */
  apiKey: string;
  /** The original transaction hash that failed */
  originalTxHash: string;
  /** The user's wallet address to receive the refund */
  userWallet: string;
  /** The amount to refund (in atomic units, e.g., "1000000" for $1 USDC) */
  amount: string;
  /** The asset address (token contract) */
  asset: string;
  /** The network (e.g., "base", "solana") */
  network: string;
  /** Optional reason for the failure */
  reason?: string;
}

export interface ReportFailureResponse {
  success: boolean;
  claimId?: string;
  error?: string;
}

/**
 * Report a failure to the facilitator to create a refund claim
 *
 * @example
 * ```typescript
 * import { reportFailure } from '@openfacilitator/sdk/claims';
 *
 * const result = await reportFailure({
 *   facilitatorUrl: 'https://my-facilitator.openfacilitator.io',
 *   apiKey: 'sk_...',
 *   originalTxHash: '0x123...',
 *   userWallet: '0xabc...',
 *   amount: '1000000', // 1 USDC
 *   asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
 *   network: 'base',
 *   reason: 'Service unavailable',
 * });
 *
 * if (result.success) {
 *   console.log('Claim created:', result.claimId);
 * } else {
 *   console.error('Failed to create claim:', result.error);
 * }
 * ```
 */
export async function reportFailure(params: ReportFailureParams): Promise<ReportFailureResponse> {
  const {
    facilitatorUrl,
    apiKey,
    originalTxHash,
    userWallet,
    amount,
    asset,
    network,
    reason,
  } = params;

  // Normalize URL
  const baseUrl = facilitatorUrl.replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/claims/report-failure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-Api-Key': apiKey,
      },
      body: JSON.stringify({
        originalTxHash,
        userWallet,
        amount,
        asset,
        network,
        reason,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export interface GetClaimableParams {
  /** The facilitator URL */
  facilitatorUrl: string;
  /** The user's wallet address */
  wallet: string;
  /** Optional facilitator subdomain filter */
  facilitator?: string;
}

export interface ClaimableItem {
  id: string;
  originalTxHash: string;
  amount: string;
  asset: string;
  network: string;
  reason?: string;
  status: 'pending' | 'approved';
  reportedAt: string;
  expiresAt?: string;
}

export interface GetClaimableResponse {
  claims: ClaimableItem[];
}

/**
 * Get claimable refunds for a wallet
 */
export async function getClaimable(params: GetClaimableParams): Promise<GetClaimableResponse> {
  const { facilitatorUrl, wallet, facilitator } = params;
  const baseUrl = facilitatorUrl.replace(/\/$/, '');

  const queryParams = new URLSearchParams({ wallet });
  if (facilitator) {
    queryParams.set('facilitator', facilitator);
  }

  const response = await fetch(`${baseUrl}/api/claims?${queryParams.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

export interface ClaimHistoryItem {
  id: string;
  originalTxHash: string;
  amount: string;
  asset: string;
  network: string;
  reason?: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | 'expired';
  reportedAt: string;
  expiresAt?: string;
  payoutTxHash?: string;
  paidAt?: string;
}

export interface GetClaimHistoryResponse {
  claims: ClaimHistoryItem[];
}

/**
 * Get claim history for a wallet
 */
export async function getClaimHistory(params: GetClaimableParams): Promise<GetClaimHistoryResponse> {
  const { facilitatorUrl, wallet, facilitator } = params;
  const baseUrl = facilitatorUrl.replace(/\/$/, '');

  const queryParams = new URLSearchParams({ wallet });
  if (facilitator) {
    queryParams.set('facilitator', facilitator);
  }

  const response = await fetch(`${baseUrl}/api/claims/history?${queryParams.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

export interface ExecuteClaimParams {
  /** The facilitator URL */
  facilitatorUrl: string;
  /** The claim ID to execute */
  claimId: string;
  /** Optional signature for verification (recommended in production) */
  signature?: string;
}

export interface ExecuteClaimResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Execute a claim payout (claim must be approved)
 */
export async function executeClaim(params: ExecuteClaimParams): Promise<ExecuteClaimResponse> {
  const { facilitatorUrl, claimId, signature } = params;
  const baseUrl = facilitatorUrl.replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/api/claims/${claimId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ signature }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

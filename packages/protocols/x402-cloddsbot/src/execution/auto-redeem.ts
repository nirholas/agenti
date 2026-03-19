/**
 * Auto-Redeem - Automatically redeem resolved Polymarket positions for USDC
 *
 * Features:
 * - Polls positions via CLOB API for resolved markets
 * - Checks on-chain payout status before attempting redemption
 * - Handles both standard and negRisk markets
 * - Emits events for redemption success/failure/expiry
 * - Tracks already-redeemed conditions to avoid duplicates
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '../utils/logger';
import { buildPolymarketHeadersForUrl, type PolymarketApiKeyAuth } from '../utils/polymarket-auth';
import { writeContract, callContract } from '../evm/contracts';
import { CTF_ADDRESS, NEG_RISK_ADAPTER } from '../utils/polymarket-setup';

// =============================================================================
// CONSTANTS
// =============================================================================

const POLY_CLOB_URL = 'https://clob.polymarket.com';

const CTF_REDEEM_ABI = [
  'function redeemPositions(bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function payoutNumerators(bytes32 conditionId, uint256 index) view returns (uint256)',
  'function payoutDenominator(bytes32 conditionId) view returns (uint256)',
];

const NEG_RISK_ADAPTER_ABI = [
  'function redeemPositions(bytes32 conditionId, uint256[] indexSets)',
];

/** Standard binary market index sets: [1] = outcome A, [2] = outcome B */
const BINARY_INDEX_SETS = [1, 2];

/**
 * Check if a token is a negative risk market (inlined to avoid circular import with ./index)
 */
async function checkNegRisk(tokenId: string): Promise<boolean> {
  try {
    const response = await fetch(`${POLY_CLOB_URL}/neg-risk?token_id=${tokenId}`);
    if (!response.ok) return false;
    const data = (await response.json()) as { neg_risk?: boolean };
    return data.neg_risk === true;
  } catch {
    return false;
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface AutoRedeemConfig {
  /** Polymarket HMAC auth for position fetching */
  polymarketAuth: PolymarketApiKeyAuth;
  /** Private key for on-chain redemption tx signing */
  privateKey: string;
  /** Funder/proxy wallet address */
  funderAddress: string;
  /** Poll interval in ms (default: 60000 = 1 minute) */
  pollIntervalMs?: number;
  /** Polygon RPC URL (default: from multichain config) */
  rpcUrl?: string;
  /** Dry run mode - log but don't execute */
  dryRun?: boolean;
}

export interface RedemptionResult {
  conditionId: string;
  tokenId: string;
  shares: number;
  usdcRedeemed: number;
  txHash?: string;
  success: boolean;
  error?: string;
}

export interface PendingRedemption {
  conditionId: string;
  tokenId: string;
  shares: number;
  marketQuestion?: string;
  outcome?: string;
}

interface PolymarketClobPosition {
  asset: string;
  condition_id: string;
  size: string;
  avgPrice: string;
  cur_price: string;
  pnl?: string;
  realized_pnl?: string;
  market?: string;
  outcome?: string;
}

export interface AutoRedeemer extends EventEmitter {
  /** Start polling for resolved positions */
  start(): void;
  /** Stop polling */
  stop(): void;
  /** Force check + redeem all resolved positions now */
  redeemAll(): Promise<RedemptionResult[]>;
  /** Redeem a specific position */
  redeemPosition(conditionId: string, tokenId: string): Promise<RedemptionResult>;
  /** Get positions pending redemption */
  getPendingRedemptions(): PendingRedemption[];
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export function createAutoRedeemer(config: AutoRedeemConfig): AutoRedeemer {
  const emitter = new EventEmitter() as AutoRedeemer;

  const pollIntervalMs = config.pollIntervalMs ?? 60_000;
  const dryRun = config.dryRun ?? false;

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const redeemedConditions = new Set<string>();
  const pendingRedemptions = new Map<string, PendingRedemption>();

  /**
   * Fetch positions from Polymarket CLOB API
   */
  async function fetchPositions(): Promise<PolymarketClobPosition[]> {
    const url = `${POLY_CLOB_URL}/positions`;
    const headers = buildPolymarketHeadersForUrl(config.polymarketAuth, 'GET', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: { ...headers, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch positions: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as PolymarketClobPosition[];
  }

  /**
   * Check if a market is resolved via on-chain payout denominator
   */
  async function isMarketResolved(conditionId: string): Promise<boolean> {
    try {
      const result = await callContract({
        chain: 'polygon',
        contractAddress: CTF_ADDRESS,
        abi: CTF_REDEEM_ABI,
        method: 'payoutDenominator',
        args: [conditionId],
      });

      if (!result.success || result.result === undefined) return false;

      // payoutDenominator > 0 means the market has been resolved
      const denominator = BigInt(String(result.result));
      return denominator > 0n;
    } catch {
      return false;
    }
  }

  /**
   * Check on-chain balance for a token
   */
  async function getOnChainBalance(tokenId: string): Promise<bigint> {
    try {
      const result = await callContract({
        chain: 'polygon',
        contractAddress: CTF_ADDRESS,
        abi: CTF_REDEEM_ABI,
        method: 'balanceOf',
        args: [config.funderAddress, tokenId],
      });

      if (!result.success || result.result === undefined) return 0n;
      return BigInt(String(result.result));
    } catch {
      return 0n;
    }
  }

  /**
   * Execute on-chain redemption for a resolved position
   */
  async function executeRedemption(
    conditionId: string,
    tokenId: string,
    isNegRisk: boolean
  ): Promise<RedemptionResult> {
    const balance = await getOnChainBalance(tokenId);
    const shares = Number(balance) / 1e6;

    if (balance === 0n) {
      return {
        conditionId,
        tokenId,
        shares: 0,
        usdcRedeemed: 0,
        success: false,
        error: 'No on-chain balance to redeem',
      };
    }

    if (dryRun) {
      logger.info({ conditionId, tokenId, shares, isNegRisk }, 'DRY RUN: Would redeem position');
      return {
        conditionId,
        tokenId,
        shares,
        usdcRedeemed: shares, // Approximate — winning tokens redeem 1:1
        success: true,
      };
    }

    try {
      let writeResult;

      if (isNegRisk) {
        // NegRisk markets go through the adapter
        writeResult = await writeContract({
          chain: 'polygon',
          contractAddress: NEG_RISK_ADAPTER,
          abi: NEG_RISK_ADAPTER_ABI,
          method: 'redeemPositions',
          args: [conditionId, BINARY_INDEX_SETS],
          privateKey: config.privateKey,
        });
      } else {
        // Standard markets go through CTF directly
        const parentCollectionId = '0x' + '0'.repeat(64);
        writeResult = await writeContract({
          chain: 'polygon',
          contractAddress: CTF_ADDRESS,
          abi: CTF_REDEEM_ABI,
          method: 'redeemPositions',
          args: [parentCollectionId, conditionId, BINARY_INDEX_SETS],
          privateKey: config.privateKey,
        });
      }

      if (!writeResult.success) {
        return {
          conditionId,
          tokenId,
          shares,
          usdcRedeemed: 0,
          success: false,
          error: writeResult.error || 'Transaction failed',
        };
      }

      logger.info(
        { conditionId, tokenId, shares, txHash: writeResult.txHash },
        'Position redeemed successfully'
      );

      return {
        conditionId,
        tokenId,
        shares,
        usdcRedeemed: shares,
        txHash: writeResult.txHash,
        success: true,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        conditionId,
        tokenId,
        shares,
        usdcRedeemed: 0,
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Scan positions and redeem any that are resolved
   */
  async function scanAndRedeem(): Promise<RedemptionResult[]> {
    const results: RedemptionResult[] = [];

    try {
      const positions = await fetchPositions();

      for (const pos of positions) {
        const conditionId = pos.condition_id;
        const tokenId = pos.asset;
        const size = parseFloat(pos.size);

        // Skip zero-size or already-redeemed
        if (size <= 0 || redeemedConditions.has(conditionId)) continue;

        // Check if market is resolved on-chain
        const resolved = await isMarketResolved(conditionId);
        if (!resolved) continue;

        logger.info(
          { conditionId, tokenId, size, market: pos.market, outcome: pos.outcome },
          'Found resolved position, attempting redemption'
        );

        // Check if negRisk
        let isNegRisk = false;
        try {
          isNegRisk = await checkNegRisk(tokenId);
        } catch {
          // Non-critical, default to standard
        }

        const result = await executeRedemption(conditionId, tokenId, isNegRisk);
        results.push(result);

        if (result.success) {
          redeemedConditions.add(conditionId);
          pendingRedemptions.delete(conditionId);
          emitter.emit('redemption_success', result);
        } else if (result.error === 'No on-chain balance to redeem') {
          // Position expired (losing side) — mark as done
          redeemedConditions.add(conditionId);
          pendingRedemptions.delete(conditionId);
          emitter.emit('position_expired', {
            conditionId,
            tokenId,
            shares: size,
            market: pos.market,
            outcome: pos.outcome,
          });
        } else {
          // Track as pending for retry
          pendingRedemptions.set(conditionId, {
            conditionId,
            tokenId,
            shares: size,
            marketQuestion: pos.market,
            outcome: pos.outcome,
          });
          emitter.emit('redemption_failed', result);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg }, 'Error during auto-redeem scan');
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  function start(): void {
    if (pollTimer) return;

    logger.info({ pollIntervalMs, dryRun }, 'Auto-redeemer started');

    // Run immediately, then on interval
    scanAndRedeem().catch((err) => {
      logger.error({ error: String(err) }, 'Initial auto-redeem scan failed');
    });

    pollTimer = setInterval(() => {
      scanAndRedeem().catch((err) => {
        logger.error({ error: String(err) }, 'Auto-redeem scan failed');
      });
    }, pollIntervalMs);

    emitter.emit('started');
  }

  function stop(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    logger.info('Auto-redeemer stopped');
    emitter.emit('stopped');
  }

  async function redeemAll(): Promise<RedemptionResult[]> {
    return scanAndRedeem();
  }

  async function redeemPosition(conditionId: string, tokenId: string): Promise<RedemptionResult> {
    let isNegRisk = false;
    try {
      isNegRisk = await checkNegRisk(tokenId);
    } catch {
      // Default to standard
    }

    const result = await executeRedemption(conditionId, tokenId, isNegRisk);

    if (result.success) {
      redeemedConditions.add(conditionId);
      pendingRedemptions.delete(conditionId);
      emitter.emit('redemption_success', result);
    } else {
      emitter.emit('redemption_failed', result);
    }

    return result;
  }

  function getPendingRedemptions(): PendingRedemption[] {
    return Array.from(pendingRedemptions.values());
  }

  Object.assign(emitter, {
    start,
    stop,
    redeemAll,
    redeemPosition,
    getPendingRedemptions,
  });

  return emitter;
}

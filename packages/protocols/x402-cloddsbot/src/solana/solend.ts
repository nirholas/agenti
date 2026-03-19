/**
 * Solend SDK Integration
 *
 * Lending: deposit, withdraw, borrow, repay
 */

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { signAndSendTransaction } from './wallet';
import BN from 'bn.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('solana:solend');

// ============================================
// INTERFACES
// ============================================

export interface SolendReserveInfo {
  address: string;
  symbol: string;
  mint: string;
  decimals: number;
  depositRate: number;
  borrowRate: number;
  totalDeposits: string;
  totalBorrows: string;
  availableLiquidity: string;
  utilizationRate: number;
  ltv: number;
  liquidationThreshold: number;
}

export interface SolendObligationInfo {
  address: string;
  owner: string;
  deposits: SolendPositionInfo[];
  borrows: SolendPositionInfo[];
  totalDepositValue: string;
  totalBorrowValue: string;
  borrowLimit: string;
  liquidationThreshold: string;
  healthFactor: number;
  ltv: number;
}

export interface SolendPositionInfo {
  reserveAddress: string;
  symbol: string;
  mint: string;
  amount: string;
  amountUsd: string;
}

export interface SolendDepositParams {
  reserveMint: string;
  amount: string;
  market?: string;
}

export interface SolendWithdrawParams {
  reserveMint: string;
  amount: string;
  withdrawAll?: boolean;
  market?: string;
}

export interface SolendBorrowParams {
  reserveMint: string;
  amount: string;
  market?: string;
}

export interface SolendRepayParams {
  reserveMint: string;
  amount: string;
  repayAll?: boolean;
  market?: string;
}

export interface SolendResult {
  signature: string;
  amount?: string;
  symbol?: string;
}

// ============================================
// DEFAULT MARKET
// ============================================

const SOLEND_MAIN_MARKET = 'DdZR6zRFiUt4S5mg7AV1uKB2z1116sp1ObwbKhmYwjGh';

// ============================================
// FUNCTIONS
// ============================================

/**
 * Get all Solend reserves with rates and utilization
 * @param connection - Solana RPC connection
 * @param market - Market address (defaults to main pool)
 * @returns Array of reserves with APY and utilization
 */
export async function getSolendReserves(
  connection: Connection,
  market?: string
): Promise<SolendReserveInfo[]> {
  try {
    const { SolendMarket } = await import('@solendprotocol/solend-sdk');

    const solendMarket = await SolendMarket.initialize(
      connection as any,
      'production',
      new PublicKey(market || SOLEND_MAIN_MARKET)
    );

    await solendMarket.loadReserves();

    const reserves: SolendReserveInfo[] = [];
    for (const reserve of solendMarket.reserves || []) {
      try {
        const stats = (reserve as any).stats;
        if (!stats) continue;

        reserves.push({
          address: (reserve as any).pubkey?.toBase58?.() || '',
          symbol: stats.symbol || 'UNKNOWN',
          mint: stats.mintAddress || '',
          decimals: stats.decimals ?? 6,
          depositRate: (stats.supplyInterestAPY ?? 0) * 100,
          borrowRate: (stats.borrowInterestAPY ?? 0) * 100,
          totalDeposits: (stats.totalDepositsWads?.toString?.() ?? '0'),
          totalBorrows: (stats.totalBorrowsWads?.toString?.() ?? '0'),
          availableLiquidity: (stats.availableAmount?.toString?.() ?? '0'),
          utilizationRate: (stats.utilizationRatio ?? 0) * 100,
          ltv: (stats.loanToValueRatio ?? 0) * 100,
          liquidationThreshold: (stats.liquidationThreshold ?? 0) * 100,
        });
      } catch {
        // Skip reserves that fail to parse
      }
    }

    return reserves;
  } catch (error) {
    logger.error({ error }, 'Failed to get Solend reserves');
    return [];
  }
}

/**
 * Get user's Solend obligation (deposits, borrows, health factor)
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair
 * @param market - Market address (defaults to main pool)
 * @returns Obligation with positions and health metrics, or null if none
 */
export async function getSolendObligation(
  connection: Connection,
  keypair: Keypair,
  market?: string
): Promise<SolendObligationInfo | null> {
  try {
    const { SolendMarket } = await import('@solendprotocol/solend-sdk');

    const solendMarket = await SolendMarket.initialize(
      connection as any,
      'production',
      new PublicKey(market || SOLEND_MAIN_MARKET)
    );

    await solendMarket.loadReserves();
    await solendMarket.loadObligations();

    const obligations = (solendMarket as any).obligations || [];
    const userObligation = obligations.find(
      (o: any) => o.owner?.toBase58?.() === keypair.publicKey.toBase58()
    );

    if (!userObligation) {
      return null;
    }

    const deposits: SolendPositionInfo[] = [];
    const borrows: SolendPositionInfo[] = [];

    for (const dep of (userObligation as any).deposits || []) {
      deposits.push({
        reserveAddress: dep.reserveAddress?.toBase58?.() || '',
        symbol: dep.symbol || 'UNKNOWN',
        mint: dep.mintAddress || '',
        amount: dep.amount?.toString?.() || '0',
        amountUsd: dep.marketValue?.toString?.() || '0',
      });
    }

    for (const bor of (userObligation as any).borrows || []) {
      borrows.push({
        reserveAddress: bor.reserveAddress?.toBase58?.() || '',
        symbol: bor.symbol || 'UNKNOWN',
        mint: bor.mintAddress || '',
        amount: bor.amount?.toString?.() || '0',
        amountUsd: bor.marketValue?.toString?.() || '0',
      });
    }

    const totalDeposit = parseFloat((userObligation as any).totalDepositValue?.toString?.() || '0');
    const totalBorrow = parseFloat((userObligation as any).totalBorrowValue?.toString?.() || '0');
    const ltv = totalDeposit > 0 ? totalBorrow / totalDeposit : 0;
    const healthFactor = ltv > 0 ? 1 / ltv : Infinity;

    return {
      address: (userObligation as any).pubkey?.toBase58?.() || '',
      owner: keypair.publicKey.toBase58(),
      deposits,
      borrows,
      totalDepositValue: totalDeposit.toString(),
      totalBorrowValue: totalBorrow.toString(),
      borrowLimit: (userObligation as any).borrowLimit?.toString?.() || '0',
      liquidationThreshold: (userObligation as any).liquidationThreshold?.toString?.() || '0',
      healthFactor,
      ltv: ltv * 100,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get Solend obligation');
    return null;
  }
}

/**
 * Deposit collateral to Solend
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair (signs transaction)
 * @param params - Deposit params: reserveMint, amount (in base units)
 * @returns Transaction signature and amount deposited
 */
export async function solendDeposit(
  connection: Connection,
  keypair: Keypair,
  params: SolendDepositParams
): Promise<SolendResult> {
  const { SolendAction } = await import('@solendprotocol/solend-sdk');

  const amount = new BN(params.amount);

  const action = await SolendAction.buildDepositTxns(
    connection as any,
    amount.toString(),
    params.reserveMint,
    keypair.publicKey,
    'production',
    new PublicKey(params.market || SOLEND_MAIN_MARKET)
  );

  const txns = await (action as any).getTransactions();
  const allTxs = [txns.preLendingTxn, txns.lendingTxn, txns.postLendingTxn].filter(Boolean) as Transaction[];
  let signature = '';

  for (const tx of allTxs) {
    signature = await signAndSendTransaction(connection, keypair, tx);
  }

  return {
    signature,
    amount: params.amount,
  };
}

/**
 * Withdraw collateral from Solend
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair (signs transaction)
 * @param params - Withdraw params: reserveMint, amount, withdrawAll flag
 * @returns Transaction signature and amount withdrawn
 */
export async function solendWithdraw(
  connection: Connection,
  keypair: Keypair,
  params: SolendWithdrawParams
): Promise<SolendResult> {
  const { SolendAction } = await import('@solendprotocol/solend-sdk');

  const amount = params.withdrawAll ? 'max' : new BN(params.amount).toString();

  const action = await SolendAction.buildWithdrawTxns(
    connection as any,
    amount,
    params.reserveMint,
    keypair.publicKey,
    'production',
    new PublicKey(params.market || SOLEND_MAIN_MARKET)
  );

  const txns = await (action as any).getTransactions();
  const allTxs = [txns.preLendingTxn, txns.lendingTxn, txns.postLendingTxn].filter(Boolean) as Transaction[];
  let signature = '';

  for (const tx of allTxs) {
    signature = await signAndSendTransaction(connection, keypair, tx);
  }

  return {
    signature,
    amount: params.amount,
  };
}

/**
 * Borrow assets from Solend (requires collateral)
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair (signs transaction)
 * @param params - Borrow params: reserveMint, amount (in base units)
 * @returns Transaction signature and amount borrowed
 */
export async function solendBorrow(
  connection: Connection,
  keypair: Keypair,
  params: SolendBorrowParams
): Promise<SolendResult> {
  const { SolendAction } = await import('@solendprotocol/solend-sdk');

  const amount = new BN(params.amount).toString();

  const action = await SolendAction.buildBorrowTxns(
    connection as any,
    amount,
    params.reserveMint,
    keypair.publicKey,
    'production',
    new PublicKey(params.market || SOLEND_MAIN_MARKET)
  );

  const txns = await (action as any).getTransactions();
  const allTxs = [txns.preLendingTxn, txns.lendingTxn, txns.postLendingTxn].filter(Boolean) as Transaction[];
  let signature = '';

  for (const tx of allTxs) {
    signature = await signAndSendTransaction(connection, keypair, tx);
  }

  return {
    signature,
    amount: params.amount,
  };
}

/**
 * Repay borrowed assets to Solend
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair (signs transaction)
 * @param params - Repay params: reserveMint, amount, repayAll flag
 * @returns Transaction signature and amount repaid
 */
export async function solendRepay(
  connection: Connection,
  keypair: Keypair,
  params: SolendRepayParams
): Promise<SolendResult> {
  const { SolendAction } = await import('@solendprotocol/solend-sdk');

  const amount = params.repayAll ? 'max' : new BN(params.amount).toString();

  const action = await SolendAction.buildRepayTxns(
    connection as any,
    amount,
    params.reserveMint,
    keypair.publicKey,
    'production',
    new PublicKey(params.market || SOLEND_MAIN_MARKET)
  );

  const txns = await (action as any).getTransactions();
  const allTxs = [txns.preLendingTxn, txns.lendingTxn, txns.postLendingTxn].filter(Boolean) as Transaction[];
  let signature = '';

  for (const tx of allTxs) {
    signature = await signAndSendTransaction(connection, keypair, tx);
  }

  return {
    signature,
    amount: params.amount,
  };
}

/**
 * Get health factor and risk level for user's Solend position
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair
 * @returns Obligation info with health metrics, or null if no position
 */
export async function getSolendHealth(
  connection: Connection,
  keypair: Keypair
): Promise<SolendObligationInfo | null> {
  return getSolendObligation(connection, keypair);
}

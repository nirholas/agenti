/**
 * MarginFi SDK Integration
 *
 * Lending: deposit, withdraw, borrow, repay
 */

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { signAndSendTransaction } from './wallet';
import BN from 'bn.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('solana:marginfi');

// ============================================
// INTERFACES
// ============================================

export interface MarginfiAccountInfo {
  address: string;
  owner: string;
  deposits: MarginfiPositionInfo[];
  borrows: MarginfiPositionInfo[];
  totalDepositValue: string;
  totalBorrowValue: string;
  healthFactor: number;
  ltv: number;
}

export interface MarginfiBankInfo {
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

export interface MarginfiPositionInfo {
  bankAddress: string;
  symbol: string;
  mint: string;
  amount: string;
  amountUsd: string;
}

export interface MarginfiDepositParams {
  bankMint: string;
  amount: string;
}

export interface MarginfiWithdrawParams {
  bankMint: string;
  amount: string;
  withdrawAll?: boolean;
}

export interface MarginfiBorrowParams {
  bankMint: string;
  amount: string;
}

export interface MarginfiRepayParams {
  bankMint: string;
  amount: string;
  repayAll?: boolean;
}

export interface MarginfiResult {
  signature: string;
  amount?: string;
  symbol?: string;
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Get user's marginfi account with positions
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair
 * @returns Account info with deposits, borrows, and health, or null if none
 */
export async function getMarginfiAccount(
  connection: Connection,
  keypair: Keypair
): Promise<MarginfiAccountInfo | null> {
  try {
    const { MarginfiClient, getConfig } = await import('@mrgnlabs/marginfi-client-v2');

    const config = getConfig('production');
    const client = await MarginfiClient.fetch(config, {} as any, connection as any);

    const accounts = await client.getMarginfiAccountsForAuthority(keypair.publicKey);
    if (!accounts || accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    const deposits: MarginfiPositionInfo[] = [];
    const borrows: MarginfiPositionInfo[] = [];
    let totalDepositValue = 0;
    let totalBorrowValue = 0;

    const balances = (account as any).activeBalances || (account as any).balances || [];
    for (const balance of balances) {
      try {
        const bank = (client as any).getBankByPk?.(balance.bankPk) ?? (client as any).banks?.get(balance.bankPk?.toBase58?.());
        if (!bank) continue;

        const symbol = (bank as any).tokenSymbol || (bank as any).label || 'UNKNOWN';
        const mint = (bank as any).mint?.toBase58?.() || '';
        const depositAmount = (balance as any).computeQuantity?.((bank as any))?.assets?.toNumber?.() ?? 0;
        const borrowAmount = (balance as any).computeQuantity?.((bank as any))?.liabilities?.toNumber?.() ?? 0;
        const depositUsd = (balance as any).computeUsdValue?.((bank as any))?.assets?.toNumber?.() ?? 0;
        const borrowUsd = (balance as any).computeUsdValue?.((bank as any))?.liabilities?.toNumber?.() ?? 0;

        if (depositAmount > 0) {
          deposits.push({
            bankAddress: balance.bankPk?.toBase58?.() || '',
            symbol,
            mint,
            amount: depositAmount.toString(),
            amountUsd: depositUsd.toString(),
          });
          totalDepositValue += depositUsd;
        }

        if (borrowAmount > 0) {
          borrows.push({
            bankAddress: balance.bankPk?.toBase58?.() || '',
            symbol,
            mint,
            amount: borrowAmount.toString(),
            amountUsd: borrowUsd.toString(),
          });
          totalBorrowValue += borrowUsd;
        }
      } catch {
        // Skip balances that fail to parse
      }
    }

    const ltv = totalDepositValue > 0 ? totalBorrowValue / totalDepositValue : 0;
    const healthFactor = ltv > 0 ? 1 / ltv : Infinity;

    return {
      address: (account as any).address?.toBase58?.() || (account as any).publicKey?.toBase58?.() || '',
      owner: keypair.publicKey.toBase58(),
      deposits,
      borrows,
      totalDepositValue: totalDepositValue.toString(),
      totalBorrowValue: totalBorrowValue.toString(),
      healthFactor,
      ltv: ltv * 100,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get MarginFi account');
    return null;
  }
}

/**
 * Get all MarginFi banks (lending pools) with rates and utilization
 * @param connection - Solana RPC connection
 * @returns Array of banks with APY, utilization, and LTV
 */
export async function getMarginfiBanks(
  connection: Connection
): Promise<MarginfiBankInfo[]> {
  try {
    const { MarginfiClient, getConfig } = await import('@mrgnlabs/marginfi-client-v2');

    const config = getConfig('production');
    const client = await MarginfiClient.fetch(config, {} as any, connection as any);

    const banks: MarginfiBankInfo[] = [];
    const bankMap = (client as any).banks || new Map();

    for (const [, bank] of bankMap) {
      try {
        const depositRate = (bank as any).computeInterestRates?.()?.lendingRate?.toNumber?.() ?? 0;
        const borrowRate = (bank as any).computeInterestRates?.()?.borrowingRate?.toNumber?.() ?? 0;
        const totalDeposits = (bank as any).computeAssetUsdValue?.()?.toNumber?.() ?? 0;
        const totalBorrows = (bank as any).computeLiabilityUsdValue?.()?.toNumber?.() ?? 0;
        const utilization = totalDeposits > 0 ? (totalBorrows / totalDeposits) * 100 : 0;

        banks.push({
          address: (bank as any).address?.toBase58?.() || (bank as any).publicKey?.toBase58?.() || '',
          symbol: (bank as any).tokenSymbol || (bank as any).label || 'UNKNOWN',
          mint: (bank as any).mint?.toBase58?.() || '',
          decimals: (bank as any).mintDecimals?.toNumber?.() ?? (bank as any).mintDecimals ?? 6,
          depositRate: depositRate * 100,
          borrowRate: borrowRate * 100,
          totalDeposits: totalDeposits.toString(),
          totalBorrows: totalBorrows.toString(),
          availableLiquidity: (totalDeposits - totalBorrows).toString(),
          utilizationRate: utilization,
          ltv: (bank as any).config?.assetWeightInit?.toNumber?.() ?? 0,
          liquidationThreshold: (bank as any).config?.liabilityWeightInit?.toNumber?.() ?? 0,
        });
      } catch {
        // Skip banks that fail to parse
      }
    }

    return banks;
  } catch (error) {
    logger.error({ error }, 'Failed to get MarginFi banks');
    return [];
  }
}

/**
 * Deposit collateral to MarginFi
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair (signs transaction)
 * @param params - Deposit params: bankMint, amount (in base units)
 * @returns Transaction signature and amount deposited
 */
export async function marginfiDeposit(
  connection: Connection,
  keypair: Keypair,
  params: MarginfiDepositParams
): Promise<MarginfiResult> {
  const { MarginfiClient, getConfig } = await import('@mrgnlabs/marginfi-client-v2');

  const config = getConfig('production');
  const client = await MarginfiClient.fetch(config, {} as any, connection as any);

  // Find bank by mint
  const bank = findBankByMint(client, params.bankMint);
  if (!bank) {
    throw new Error(`Bank not found for mint: ${params.bankMint}`);
  }

  // Get or create marginfi account
  let accounts = await client.getMarginfiAccountsForAuthority(keypair.publicKey);
  let account = accounts?.[0];
  if (!account) {
    await client.createMarginfiAccount(keypair.publicKey);
    accounts = await client.getMarginfiAccountsForAuthority(keypair.publicKey);
    account = accounts?.[0];
    if (!account) throw new Error('Failed to create MarginFi account');
  }

  const amount = new BN(params.amount);
  const tx = await (account as any).deposit(amount, (bank as any).address || (bank as any).publicKey);

  let signature: string;
  if (typeof tx === 'string') {
    signature = tx;
  } else {
    signature = await signAndSendTransaction(connection, keypair, tx as Transaction);
  }

  return {
    signature,
    amount: params.amount,
    symbol: (bank as any).tokenSymbol || (bank as any).label,
  };
}

/**
 * Withdraw collateral from MarginFi
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair (signs transaction)
 * @param params - Withdraw params: bankMint, amount, withdrawAll flag
 * @returns Transaction signature and amount withdrawn
 */
export async function marginfiWithdraw(
  connection: Connection,
  keypair: Keypair,
  params: MarginfiWithdrawParams
): Promise<MarginfiResult> {
  const { MarginfiClient, getConfig } = await import('@mrgnlabs/marginfi-client-v2');

  const config = getConfig('production');
  const client = await MarginfiClient.fetch(config, {} as any, connection as any);

  const bank = findBankByMint(client, params.bankMint);
  if (!bank) {
    throw new Error(`Bank not found for mint: ${params.bankMint}`);
  }

  const accounts = await client.getMarginfiAccountsForAuthority(keypair.publicKey);
  const account = accounts?.[0];
  if (!account) throw new Error('No MarginFi account found');

  const amount = params.withdrawAll ? undefined : new BN(params.amount);
  const tx = await (account as any).withdraw(
    amount,
    (bank as any).address || (bank as any).publicKey,
    params.withdrawAll
  );

  let signature: string;
  if (typeof tx === 'string') {
    signature = tx;
  } else {
    signature = await signAndSendTransaction(connection, keypair, tx as Transaction);
  }

  return {
    signature,
    amount: params.amount,
    symbol: (bank as any).tokenSymbol || (bank as any).label,
  };
}

/**
 * Borrow assets from MarginFi (requires collateral)
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair (signs transaction)
 * @param params - Borrow params: bankMint, amount (in base units)
 * @returns Transaction signature and amount borrowed
 */
export async function marginfiBorrow(
  connection: Connection,
  keypair: Keypair,
  params: MarginfiBorrowParams
): Promise<MarginfiResult> {
  const { MarginfiClient, getConfig } = await import('@mrgnlabs/marginfi-client-v2');

  const config = getConfig('production');
  const client = await MarginfiClient.fetch(config, {} as any, connection as any);

  const bank = findBankByMint(client, params.bankMint);
  if (!bank) {
    throw new Error(`Bank not found for mint: ${params.bankMint}`);
  }

  const accounts = await client.getMarginfiAccountsForAuthority(keypair.publicKey);
  const account = accounts?.[0];
  if (!account) throw new Error('No MarginFi account found. Deposit collateral first.');

  const amount = new BN(params.amount);
  const tx = await (account as any).borrow(amount, (bank as any).address || (bank as any).publicKey);

  let signature: string;
  if (typeof tx === 'string') {
    signature = tx;
  } else {
    signature = await signAndSendTransaction(connection, keypair, tx as Transaction);
  }

  return {
    signature,
    amount: params.amount,
    symbol: (bank as any).tokenSymbol || (bank as any).label,
  };
}

/**
 * Repay borrowed assets to MarginFi
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair (signs transaction)
 * @param params - Repay params: bankMint, amount, repayAll flag
 * @returns Transaction signature and amount repaid
 */
export async function marginfiRepay(
  connection: Connection,
  keypair: Keypair,
  params: MarginfiRepayParams
): Promise<MarginfiResult> {
  const { MarginfiClient, getConfig } = await import('@mrgnlabs/marginfi-client-v2');

  const config = getConfig('production');
  const client = await MarginfiClient.fetch(config, {} as any, connection as any);

  const bank = findBankByMint(client, params.bankMint);
  if (!bank) {
    throw new Error(`Bank not found for mint: ${params.bankMint}`);
  }

  const accounts = await client.getMarginfiAccountsForAuthority(keypair.publicKey);
  const account = accounts?.[0];
  if (!account) throw new Error('No MarginFi account found');

  const amount = params.repayAll ? undefined : new BN(params.amount);
  const tx = await (account as any).repay(
    amount,
    (bank as any).address || (bank as any).publicKey,
    params.repayAll
  );

  let signature: string;
  if (typeof tx === 'string') {
    signature = tx;
  } else {
    signature = await signAndSendTransaction(connection, keypair, tx as Transaction);
  }

  return {
    signature,
    amount: params.amount,
    symbol: (bank as any).tokenSymbol || (bank as any).label,
  };
}

/**
 * Get health factor and risk level for user's MarginFi position
 * @param connection - Solana RPC connection
 * @param keypair - User's wallet keypair
 * @returns Account info with health metrics, or null if no account
 */
export async function getMarginfiHealth(
  connection: Connection,
  keypair: Keypair
): Promise<MarginfiAccountInfo | null> {
  return getMarginfiAccount(connection, keypair);
}

// ============================================
// HELPERS
// ============================================

function findBankByMint(client: any, mint: string): any {
  const bankMap = client.banks || new Map();
  for (const [, bank] of bankMap) {
    const bankMint = (bank as any).mint?.toBase58?.() || '';
    if (bankMint === mint) return bank;
  }
  return null;
}

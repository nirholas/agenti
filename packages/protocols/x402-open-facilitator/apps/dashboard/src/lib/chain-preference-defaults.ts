import type { SubscriptionPayment, SubscriptionWallet } from './api';

/**
 * Determines the default chain preference based on:
 * 1. Most recent payment chain (if any payments exist)
 * 2. Highest balance wallet (if no payments)
 * 3. Solana (if both wallets empty)
 */
export function getDefaultChainPreference(
  payments: SubscriptionPayment[],
  wallets: SubscriptionWallet[]
): 'base' | 'solana' {
  // Priority 1: Most recent payment chain
  if (payments.length > 0) {
    const sorted = [...payments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const mostRecentChain = sorted[0].chain.toLowerCase();
    if (mostRecentChain === 'base' || mostRecentChain === 'solana') {
      return mostRecentChain;
    }
  }

  // Priority 2: Highest balance wallet
  const baseWallet = wallets.find(w => w.network === 'base');
  const solanaWallet = wallets.find(w => w.network === 'solana');

  const baseBalance = baseWallet ? parseFloat(baseWallet.balance) : 0;
  const solanaBalance = solanaWallet ? parseFloat(solanaWallet.balance) : 0;

  if (baseBalance > solanaBalance) return 'base';
  if (solanaBalance > baseBalance) return 'solana';

  // Priority 3: Default to Solana
  return 'solana';
}

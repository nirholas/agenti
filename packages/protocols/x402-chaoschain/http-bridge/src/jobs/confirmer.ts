import { createClient } from '@supabase/supabase-js';
import { checkTransactionFinality } from '../managed/settlement';

// Lazy load Supabase (optional for testing)
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return null;
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

/**
 * Background job to confirm pending transactions
 * Run this every 30 seconds
 */
export async function confirmPendingTransactions() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    // Skip confirmation if no Supabase (OK for testing)
    return;
  }
  
  const { data: pending } = await supabase
    .from('transactions')
    .select('*')
    .in('status', ['pending', 'partial_settlement'])
    .limit(50);

  if (!pending) return;

  for (const tx of pending) {
    try {
      const result = await checkTransactionFinality(
        tx.tx_hash,
        tx.chain,
        tx.chain.includes('base') ? 2 : 3
      );

      if (result.confirmed) {
        await supabase
          .from('transactions')
          .update({
            status: result.status === 'success' ? 'confirmed' : 'failed',
            confirmations: result.confirmations,
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', tx.id);
      } else {
        // Update confirmation count
        await supabase
          .from('transactions')
          .update({ confirmations: result.confirmations })
          .eq('id', tx.id);
      }
    } catch (error) {
      console.error(`Failed to check finality for tx ${tx.id}:`, error);
    }
  }
}

// Export function to start the confirmer
export function startConfirmer() {
  // Run immediately
  confirmPendingTransactions().catch(console.error);
  
  // Run every 30 seconds
  setInterval(() => {
    confirmPendingTransactions().catch(console.error);
  }, 30000);
}


import { createClient } from '@supabase/supabase-js';

// Lazy load Supabase client only when needed
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return null;
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export interface FeeCalculation {
  feeAmount: bigint;
  netAmount: bigint;
  feeBps: number;
  tier: 'public';  // Simplified - everyone gets the same tier (no API keys like PayAI)
  treasuryAddress: string;
}

// Simple flat fee for everyone (like PayAI - no API keys needed)
export async function calculateFee(
  amount: bigint
): Promise<FeeCalculation> {
  const feeBps = parseInt(process.env.FEE_BPS_DEFAULT || '100'); // 1% default
  
  // Calculate fee: feeAmount = amount * feeBps / 10000
  const feeAmount = (amount * BigInt(feeBps)) / BigInt(10000);
  const netAmount = amount - feeAmount;

  return {
    feeAmount,
    netAmount,
    feeBps,
    tier: 'public',  // Everyone gets the same tier
    treasuryAddress: process.env.TREASURY_ADDRESS!,
  };
}

// No spend limits or API keys for public service (like PayAI)
// Future: Add IP-based rate limiting or optional spend caps


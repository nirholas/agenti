/**
 * Agenti Fee Configuration
 * @description Revenue configuration for swap fees and platform charges
 * @author nirholas
 */

// Fee recipient wallet address - UPDATE THIS TO YOUR ADDRESS
export const FEE_RECIPIENT = process.env.NEXT_PUBLIC_FEE_RECIPIENT || "0x742d35Cc6634C0532925a3b844Bc9e7595f5bB0D";

// Fee percentage (0.15 = 0.15%)
export const SWAP_FEE_PERCENTAGE = 0.15;

// Minimum fee in USD (to cover gas on small swaps)
export const MIN_FEE_USD = 0.01;

// Maximum fee in USD (cap for large swaps)
export const MAX_FEE_USD = 100;

// Fee-free threshold (swaps under this amount have no fee)
export const FEE_FREE_THRESHOLD_USD = 1;

// Referral fee split (referrer gets this % of the fee)
export const REFERRAL_FEE_SPLIT = 0.20; // 20% to referrer

// Supported fee tokens per chain
export const FEE_TOKENS: Record<number, { address: string; symbol: string; decimals: number }> = {
  // Ethereum
  1: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
  // Polygon  
  137: { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC", decimals: 6 },
  // Arbitrum
  42161: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
  // Optimism
  10: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
  // Base
  8453: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
  // BSC
  56: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 },
  // Avalanche
  43114: { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC", decimals: 6 },
};

/**
 * Calculate swap fee
 * @param amountUSD - The swap amount in USD
 * @param referrer - Optional referrer address
 * @returns Fee breakdown
 */
export function calculateSwapFee(
  amountUSD: number,
  referrer?: string
): {
  feeUSD: number;
  feePercentage: number;
  platformFeeUSD: number;
  referralFeeUSD: number;
  referrer: string | null;
} {
  // No fee for tiny swaps
  if (amountUSD < FEE_FREE_THRESHOLD_USD) {
    return {
      feeUSD: 0,
      feePercentage: 0,
      platformFeeUSD: 0,
      referralFeeUSD: 0,
      referrer: null,
    };
  }

  // Calculate base fee
  let feeUSD = (amountUSD * SWAP_FEE_PERCENTAGE) / 100;

  // Apply min/max
  feeUSD = Math.max(feeUSD, MIN_FEE_USD);
  feeUSD = Math.min(feeUSD, MAX_FEE_USD);

  // Calculate referral split
  const referralFeeUSD = referrer ? feeUSD * REFERRAL_FEE_SPLIT : 0;
  const platformFeeUSD = feeUSD - referralFeeUSD;

  return {
    feeUSD,
    feePercentage: SWAP_FEE_PERCENTAGE,
    platformFeeUSD,
    referralFeeUSD,
    referrer: referrer || null,
  };
}

/**
 * Calculate fee in token amount
 * @param amountUSD - The swap amount in USD
 * @param tokenPrice - Price of the token in USD
 * @param tokenDecimals - Token decimals
 * @returns Fee in token units (with decimals)
 */
export function calculateFeeInTokens(
  amountUSD: number,
  tokenPrice: number,
  tokenDecimals: number
): bigint {
  const { feeUSD } = calculateSwapFee(amountUSD);
  const feeInTokens = feeUSD / tokenPrice;
  return BigInt(Math.floor(feeInTokens * 10 ** tokenDecimals));
}

/**
 * Get fee display string
 */
export function getFeeDisplayString(amountUSD: number): string {
  const { feeUSD, feePercentage } = calculateSwapFee(amountUSD);
  
  if (feeUSD === 0) {
    return "No fee";
  }
  
  return `$${feeUSD.toFixed(2)} (${feePercentage}%)`;
}

/**
 * Build fee transfer transaction data
 * For including in swap transaction as additional transfer
 */
export function buildFeeTransferData(
  chainId: number,
  feeAmountWei: bigint,
  referrer?: string
): Array<{ to: string; value: string; data: string }> {
  const transfers: Array<{ to: string; value: string; data: string }> = [];
  const feeToken = FEE_TOKENS[chainId];
  
  if (!feeToken || feeAmountWei === 0n) {
    return transfers;
  }

  const { platformFeeUSD, referralFeeUSD } = calculateSwapFee(Number(feeAmountWei) / 10 ** feeToken.decimals);
  
  // Platform fee transfer
  if (platformFeeUSD > 0) {
    const platformFeeWei = BigInt(Math.floor(platformFeeUSD * 10 ** feeToken.decimals));
    transfers.push({
      to: FEE_RECIPIENT,
      value: platformFeeWei.toString(),
      data: "0x", // Native transfer, or ERC20 transfer data
    });
  }
  
  // Referral fee transfer
  if (referralFeeUSD > 0 && referrer) {
    const referralFeeWei = BigInt(Math.floor(referralFeeUSD * 10 ** feeToken.decimals));
    transfers.push({
      to: referrer,
      value: referralFeeWei.toString(),
      data: "0x",
    });
  }
  
  return transfers;
}

export default {
  FEE_RECIPIENT,
  SWAP_FEE_PERCENTAGE,
  calculateSwapFee,
  calculateFeeInTokens,
  getFeeDisplayString,
  buildFeeTransferData,
  FEE_TOKENS,
};

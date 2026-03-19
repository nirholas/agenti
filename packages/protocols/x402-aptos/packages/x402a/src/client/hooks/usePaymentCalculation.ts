export interface PaymentAmounts {
  totalOctas: bigint;
  recipientAmount: bigint;
  platformFee: bigint;
  platformAddress: string;
}

export interface PaymentCalculationOptions {
  /** Payment amount in APT */
  amount: number;
  /** Primary recipient address */
  recipientAddress: string;
  /** Platform fee percentage (default: 0.015 = 1.5%) */
  platformFeePercentage?: number;
  /** Platform fee recipient address */
  platformAddress?: string;
}

const DEFAULT_PLATFORM_FEE_PERCENTAGE = 0.015; // 1.5%

/**
 * Calculate payment amounts including platform fees
 * Pure function for easy testing and reuse
 */
export function calculatePaymentAmounts(
  options: PaymentCalculationOptions
): PaymentAmounts {
  const {
    amount,
    recipientAddress,
    platformFeePercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE,
    platformAddress,
  } = options;

  // Convert APT to octas (1 APT = 100,000,000 octas)
  const totalOctas = BigInt(Math.floor(amount * 100_000_000));
  const platformFee = BigInt(Math.floor(Number(totalOctas) * platformFeePercentage));
  const recipientAmount = totalOctas - platformFee;

  const platformAddr =
    platformAddress ||
    (typeof window !== "undefined"
      ? window.X402_PLATFORM_ADDRESS || window.X402_FACILITATOR_ADDRESS
      : undefined) ||
    recipientAddress; // Fallback to recipient if no platform address

  return {
    totalOctas,
    recipientAmount,
    platformFee,
    platformAddress: platformAddr,
  };
}

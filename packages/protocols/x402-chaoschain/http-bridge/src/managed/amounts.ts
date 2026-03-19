import { formatUnits } from 'viem';
import { calculateFee } from './fees';

/**
 * Fee and amount breakdown with both human-readable and base unit representations
 */
export interface AmountBreakdown {
  amount: {
    human: string;      // "1.00"
    base: string;       // "1000000"
    symbol: string;     // "USDC"
    decimals: number;   // 6
  };
  fee: {
    human: string;      // "0.01"
    base: string;       // "10000"
    bps: number;        // 100
  };
  net: {
    human: string;      // "0.99"
    base: string;       // "990000"
  };
}

/**
 * Compute fee breakdown with both human and base units
 * Always call this to ensure transparency in all responses
 */
export async function computeFeeBreakdown(
  maxAmountRequired: string,
  apiKey?: string
): Promise<AmountBreakdown> {
  // USDC default 6 decimals; if you later add dynamic decimals, fold it in here
  const decimals = 6;
  // maxAmountRequired is already in base units per x402 spec
  const baseAmount = BigInt(maxAmountRequired);
  const { feeAmount, netAmount, feeBps } = await calculateFee(baseAmount);

  return {
    amount: {
      human: formatUnits(baseAmount, decimals),
      base: baseAmount.toString(),
      symbol: 'USDC',
      decimals,
    },
    fee: {
      human: formatUnits(feeAmount, decimals),
      base: feeAmount.toString(),
      bps: feeBps,
    },
    net: {
      human: formatUnits(netAmount, decimals),
      base: netAmount.toString(),
    },
  };
}


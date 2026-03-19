import { generateRequirementsMatcher } from "@faremeter/types/x402";
import {
  lookupX402Network,
  type SolanaCAIP2Network,
} from "@faremeter/info/solana";

export const x402Scheme = "exact";

export function generateMatcher(
  network: string | SolanaCAIP2Network,
  asset: string,
) {
  const solanaNetwork = lookupX402Network(network);

  return generateRequirementsMatcher(
    [x402Scheme],
    [solanaNetwork.caip2],
    [asset],
  );
}

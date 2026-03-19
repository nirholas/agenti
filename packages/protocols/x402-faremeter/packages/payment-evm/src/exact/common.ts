import type { PublicClient, Hex } from "viem";
import { generateRequirementsMatcher } from "@faremeter/types/x402";

import {
  TRANSFER_WITH_AUTHORIZATION_ABI,
  X402_EXACT_SCHEME,
} from "./constants";

export async function generateDomain(
  publicClient: PublicClient,
  chainId: number,
  asset: Hex,
) {
  // Read domain parameters from chain
  let tokenName: string;
  let tokenVersion: string;
  try {
    [tokenName, tokenVersion] = await Promise.all([
      publicClient.readContract({
        address: asset,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: "name",
      }),
      publicClient.readContract({
        address: asset,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: "version",
      }),
    ]);
  } catch (cause) {
    throw new Error("Failed to read contract parameters", { cause });
  }

  const domain = {
    name: tokenName,
    version: tokenVersion,
    chainId,
    verifyingContract: asset,
  };

  return domain;
}

export function generateForwarderDomain(
  chainId: number,
  domainInfo: {
    version: string;
    name: string;
    verifyingContract: `0x${string}`;
  },
) {
  return {
    ...domainInfo,
    chainId,
  };
}

export function generateMatcher(network: string, asset: string) {
  return generateRequirementsMatcher([X402_EXACT_SCHEME], [network], [asset]);
}

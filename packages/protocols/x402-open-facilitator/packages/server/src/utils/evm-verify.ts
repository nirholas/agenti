import { verifyMessage, getAddress, isAddress } from 'viem';

/**
 * Create verification message for EVM address.
 * MUST match client-side createVerificationMessage exactly.
 */
export function createEVMVerificationMessage(address: string): string {
  return `OpenFacilitator Rewards

Sign to verify ownership of:
${address}

This will not cost any ETH.`;
}

/**
 * Verify an EIP-191 signature from an EVM wallet.
 * Uses viem's verifyMessage which handles the Ethereum prefix internally.
 */
export async function verifyEVMSignature(
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    if (!isAddress(address, { strict: false })) {
      return false;
    }

    // verifyMessage needs checksum address
    const checksumAddress = getAddress(address);

    return await verifyMessage({
      address: checksumAddress,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

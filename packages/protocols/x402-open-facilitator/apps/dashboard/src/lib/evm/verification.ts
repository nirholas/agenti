'use client';

import { api } from '@/lib/api';

/**
 * Create the verification message for an EVM address.
 * MUST match server-side createEVMVerificationMessage exactly.
 */
export function createVerificationMessage(address: string): string {
  return `OpenFacilitator Rewards

Sign to verify ownership of:
${address}

This will not cost any ETH.`;
}

/**
 * Sign verification message and enroll EVM address.
 * @param signMessageAsync - From useSignMessage hook
 * @param address - Connected wallet address
 */
export async function signAndEnrollEVM(
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>,
  address: string
): Promise<{ success: boolean; error?: string }> {
  const message = createVerificationMessage(address);

  try {
    const signature = await signMessageAsync({ message });

    await api.enrollInRewards({
      chain_type: 'evm',
      address,
      signature,
      message,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      // Handle user rejection gracefully
      if (error.message.includes('rejected') || error.message.includes('denied') || error.message.includes('User rejected')) {
        return { success: false, error: 'Signature request was rejected' };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown error' };
  }
}

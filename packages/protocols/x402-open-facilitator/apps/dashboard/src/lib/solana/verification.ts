'use client';

import { WalletContextState } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { api } from '@/lib/api';

/**
 * Create the verification message for a Solana address.
 * MUST match server-side createVerificationMessage exactly.
 */
export function createVerificationMessage(address: string): string {
  return `OpenFacilitator Rewards

Sign to verify ownership of:
${address}

This will not cost any SOL.`;
}

/**
 * Sign verification message and enroll address.
 * Combines wallet signing with API enrollment in atomic flow.
 */
export async function signAndEnroll(
  wallet: WalletContextState
): Promise<{ success: boolean; error?: string }> {
  if (!wallet.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  if (!wallet.signMessage) {
    return { success: false, error: 'Wallet does not support message signing' };
  }

  const address = wallet.publicKey.toBase58();
  const message = createVerificationMessage(address);

  try {
    // Sign the message
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await wallet.signMessage(messageBytes);
    const signature = bs58.encode(signatureBytes);

    // Enroll with signature
    await api.enrollInRewards({
      chain_type: 'solana',
      address,
      signature,
      message,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

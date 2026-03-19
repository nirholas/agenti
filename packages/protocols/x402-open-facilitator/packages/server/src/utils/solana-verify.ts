import { ed25519 } from '@noble/curves/ed25519.js';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

/**
 * Creates the verification message that must be signed by the wallet.
 *
 * IMPORTANT: This message format must match exactly what the client sends.
 * Any difference in whitespace, newlines, or content will cause verification to fail.
 *
 * Message format:
 * - Title line
 * - Blank line
 * - "Sign to verify ownership of:" line
 * - Address on its own line
 * - Blank line
 * - Cost disclaimer
 *
 * @param address - The Solana address being verified (base58)
 * @returns The message string to be signed
 */
export function createVerificationMessage(address: string): string {
  return `OpenFacilitator Rewards

Sign to verify ownership of:
${address}

This will not cost any SOL.`;
}

/**
 * Verifies an Ed25519 signature from a Solana wallet.
 *
 * Solana uses Ed25519 for all signing operations. The wallet adapter's signMessage
 * function returns a Uint8Array signature which the client encodes as base58.
 *
 * @param address - The Solana address (base58 encoded public key)
 * @param signature - The signature (base58 encoded)
 * @param message - The exact message that was signed (string)
 * @returns true if signature is valid, false otherwise
 */
export function verifySolanaSignature(
  address: string,
  signature: string,
  message: string
): boolean {
  try {
    // Validate the address is a valid Solana public key
    const publicKey = new PublicKey(address);

    // Decode the base58 signature (wallet adapter standard encoding)
    const signatureBytes = bs58.decode(signature);

    // Encode the message to bytes (same as TextEncoder on client)
    const messageBytes = new TextEncoder().encode(message);

    // Verify using Ed25519 curve (Solana's signing algorithm)
    return ed25519.verify(signatureBytes, messageBytes, publicKey.toBytes());
  } catch {
    // Return false on any error:
    // - Invalid address format
    // - Invalid signature encoding
    // - Signature verification failure
    return false;
  }
}
